import { describe, it, expect, beforeEach } from 'vitest';
import { CasualtySystem } from '@/engine/strategic/systems/CasualtySystem';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';
import { resetArmyIdCounter } from '@/engine/strategic/systems/ArmySystem';
import type { WorldState } from '@/engine/strategic/state/WorldState';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { GeneralBattleResult, BattleResult, CasualtyReport, GeneralCasualtyDetail } from '@/engine/strategic/data/types/BattleResult';
import type { GeneralState } from '@/engine/strategic/data/types/General';

function makeState(): WorldState {
  return {
    turn: 1, day: 30, phase: 'resolution',
    factions: {
      f1: { id: 'f1', territories: ['A', 'B'], generals: ['g1'], armies: ['army1'], resources: { gold: 0, food: 0, troops: 0 }, alive: true },
      f2: { id: 'f2', territories: ['C'], generals: ['g2'], armies: ['army2'], resources: { gold: 0, food: 0, troops: 0 }, alive: true },
    },
    territories: {
      A: { id: 'A', owner: 'f1', garrison: [], upgrades: [], population: 1000, morale: 80, underSiege: false, turnsOwned: 5 },
      B: { id: 'B', owner: 'f1', garrison: [], upgrades: [], population: 500, morale: 70, underSiege: false, turnsOwned: 3 },
      C: { id: 'C', owner: 'f2', garrison: [], upgrades: [], population: 800, morale: 75, underSiege: false, turnsOwned: 2 },
    },
    armies: {
      army1: { id: 'army1', factionId: 'f1', generals: ['g1'], locationNodeId: 'C', status: 'in_battle' as const },
      army2: { id: 'army2', factionId: 'f2', generals: ['g2'], locationNodeId: 'C', status: 'in_battle' as const },
    },
    generals: {
      g1: { id: 'g1', name: 'General A', unitDataId: 'knight', leadership: 10, intellect: 5, politics: 3, charm: 4, faction: 'f1', location: 'army1', status: 'army' as const, injuryTurns: 0, loyalty: 80, currentTroops: 10000 },
      g2: { id: 'g2', name: 'General B', unitDataId: 'mage', leadership: 8, intellect: 7, politics: 5, charm: 6, faction: 'f2', location: 'army2', status: 'army' as const, injuryTurns: 0, loyalty: 70, currentTroops: 8000 },
    },
    diplomacy: { relations: {
      f1: { f2: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
      f2: { f1: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
    }},
    pendingBattles: [],
    playerFactionId: 'f1', protagonistId: 'g1',
    availableGenerals: [],
    stateHistory: [],
  } as WorldState;
}

const worldMap: WorldMapData = {
  mapWidth: 800, mapHeight: 600,
  nodes: [
    { id: 'A', name: 'A', x: 100, y: 100, type: 'city' as const, terrain: 'plains' as const, visionRadius: 5, defenseBonus: 0, maxUpgradeSlots: 2 },
    { id: 'B', name: 'B', x: 300, y: 100, type: 'village' as const, terrain: 'plains' as const, visionRadius: 5, defenseBonus: 0, maxUpgradeSlots: 1 },
    { id: 'C', name: 'C', x: 500, y: 100, type: 'city' as const, terrain: 'plains' as const, visionRadius: 5, defenseBonus: 0, maxUpgradeSlots: 2 },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', terrain: 'plains' as const, passable: true, bidirectional: true, moveCost: 1 },
    { id: 'e2', from: 'B', to: 'C', terrain: 'plains' as const, passable: true, bidirectional: true, moveCost: 1 },
  ],
};

beforeEach(() => {
  WorldEventBus.clear();
  resetArmyIdCounter();
});

describe('CasualtySystem', () => {
  describe('calculateCasualties', () => {
    it('calculates troop loss proportional to HP lost', () => {
      const generalResults: GeneralBattleResult[] = [
        { generalId: 'g1', unitDataId: 'knight', maxHp: 100, finalHp: 50, wasDefeated: false, team: 'ally' },
      ];
      const generals: Record<string, GeneralState> = {
        g1: makeState().generals.g1!,
      };

      const report = CasualtySystem.calculateCasualties(generalResults, generals);

      // leadership=10, maxTroops=10000, hpPercent=0.5, troopsLost=floor(10000*0.5)=5000
      expect(report.totalTroopsLost).toBe(5000);
      expect(report.generalReports).toHaveLength(1);
      expect(report.generalReports[0]!.troopsLost).toBe(5000);
      expect(report.generalReports[0]!.hpPercent).toBe(0.5);
    });

    it('returns max troop loss when HP is zero', () => {
      const generalResults: GeneralBattleResult[] = [
        { generalId: 'g2', unitDataId: 'mage', maxHp: 80, finalHp: 0, wasDefeated: true, team: 'enemy' },
      ];
      const generals: Record<string, GeneralState> = {
        g2: makeState().generals.g2!,
      };

      const report = CasualtySystem.calculateCasualties(generalResults, generals);

      // leadership=8, maxTroops=8000, hpPercent=0, troopsLost=floor(8000*1)=8000
      expect(report.totalTroopsLost).toBe(8000);
      expect(report.generalReports[0]!.troopsLost).toBe(8000);
      expect(report.generalReports[0]!.wasDefeated).toBe(true);
    });

    it('returns zero troop loss when HP is full', () => {
      const generalResults: GeneralBattleResult[] = [
        { generalId: 'g1', unitDataId: 'knight', maxHp: 100, finalHp: 100, wasDefeated: false, team: 'ally' },
      ];
      const generals: Record<string, GeneralState> = {
        g1: makeState().generals.g1!,
      };

      const report = CasualtySystem.calculateCasualties(generalResults, generals);

      expect(report.totalTroopsLost).toBe(0);
      expect(report.generalReports[0]!.troopsLost).toBe(0);
      expect(report.generalReports[0]!.hpPercent).toBe(1);
    });

    it('preserves wasDefeated flag in report', () => {
      const generalResults: GeneralBattleResult[] = [
        { generalId: 'g1', unitDataId: 'knight', maxHp: 100, finalHp: 0, wasDefeated: true, team: 'ally' },
        { generalId: 'g2', unitDataId: 'mage', maxHp: 80, finalHp: 60, wasDefeated: false, team: 'enemy' },
      ];
      const state = makeState();
      const report = CasualtySystem.calculateCasualties(generalResults, state.generals);

      expect(report.generalReports[0]!.wasDefeated).toBe(true);
      expect(report.generalReports[1]!.wasDefeated).toBe(false);
    });
  });

  describe('rollDeathAndInjury', () => {
    it('triggers death when rng returns 0.0 on losing side (8% threshold)', () => {
      const reports: GeneralCasualtyDetail[] = [
        { generalId: 'g2', troopsLost: 8000, hpPercent: 0, wasDefeated: true, died: false },
      ];

      CasualtySystem.rollDeathAndInjury(reports, false, [], () => 0.0);

      expect(reports[0]!.died).toBe(true);
    });

    it('never triggers death when rng returns 1.0', () => {
      const reports: GeneralCasualtyDetail[] = [
        { generalId: 'g2', troopsLost: 8000, hpPercent: 0, wasDefeated: true, died: false },
      ];

      CasualtySystem.rollDeathAndInjury(reports, false, [], () => 1.0);

      expect(reports[0]!.died).toBe(false);
      expect(reports[0]!.injury).toBeDefined();
    });

    it('applies severe injury (7-10 turns) to defeated general who survives', () => {
      const reports: GeneralCasualtyDetail[] = [
        { generalId: 'g1', troopsLost: 10000, hpPercent: 0, wasDefeated: true, died: false },
      ];

      // rng call 1: death roll (1.0 → miss), rng call 2: injury turns
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount === 1) return 1.0; // skip death
        return 0.0; // min injury turns
      };

      CasualtySystem.rollDeathAndInjury(reports, false, [], rng);

      expect(reports[0]!.died).toBe(false);
      expect(reports[0]!.injury).toBeDefined();
      expect(reports[0]!.injury!.turns).toBeGreaterThanOrEqual(7);
      expect(reports[0]!.injury!.turns).toBeLessThanOrEqual(10);
    });

    it('excluded IDs never die even with rng 0.0', () => {
      const reports: GeneralCasualtyDetail[] = [
        { generalId: 'g1', troopsLost: 10000, hpPercent: 0, wasDefeated: true, died: false },
      ];

      CasualtySystem.rollDeathAndInjury(reports, false, ['g1'], () => 0.0);

      expect(reports[0]!.died).toBe(false);
      expect(reports[0]!.injury).toBeDefined();
    });

    it('non-defeated generals only get injury if hpPercent < 0.5 and rng triggers', () => {
      const reports: GeneralCasualtyDetail[] = [
        { generalId: 'g1', troopsLost: 3000, hpPercent: 0.3, wasDefeated: false, died: false },
      ];

      CasualtySystem.rollDeathAndInjury(reports, false, [], () => 0.0);

      expect(reports[0]!.died).toBe(false);
      expect(reports[0]!.injury).toBeDefined();
    });

    it('non-defeated generals with hpPercent >= 0.5 get no consequences', () => {
      const reports: GeneralCasualtyDetail[] = [
        { generalId: 'g1', troopsLost: 2000, hpPercent: 0.8, wasDefeated: false, died: false },
      ];

      CasualtySystem.rollDeathAndInjury(reports, false, [], () => 0.0);

      expect(reports[0]!.died).toBe(false);
      expect(reports[0]!.injury).toBeUndefined();
    });

    it('winner side has lower death chance (3%) than loser side (8%)', () => {
      const reportsWin: GeneralCasualtyDetail[] = [
        { generalId: 'g1', troopsLost: 10000, hpPercent: 0, wasDefeated: true, died: false },
      ];
      const reportsLose: GeneralCasualtyDetail[] = [
        { generalId: 'g2', troopsLost: 8000, hpPercent: 0, wasDefeated: true, died: false },
      ];

      // rng = 0.05 → between 3% and 8%
      // Winner (3% threshold): 0.05 >= 0.03 → no death
      // Loser (8% threshold): 0.05 < 0.08 → death
      CasualtySystem.rollDeathAndInjury(reportsWin, true, [], () => 0.05);
      CasualtySystem.rollDeathAndInjury(reportsLose, false, [], () => 0.05);

      expect(reportsWin[0]!.died).toBe(false);
      expect(reportsLose[0]!.died).toBe(true);
    });
  });

  describe('applyBattleResult', () => {
    function makeBattleResult(overrides: Partial<BattleResult> = {}): BattleResult {
      return {
        winnerId: 'f1',
        loserId: 'f2',
        turns: 5,
        attackerCasualties: { totalTroopsLost: 2000, generalReports: [
          { generalId: 'g1', troopsLost: 2000, hpPercent: 0.8, wasDefeated: false, died: false },
        ]},
        defenderCasualties: { totalTroopsLost: 5000, generalReports: [
          { generalId: 'g2', troopsLost: 5000, hpPercent: 0.3, wasDefeated: false, died: false },
        ]},
        territoryCaptured: false,
        generalResults: [],
        ...overrides,
      };
    }

    it('captures territory when attacker wins siege', () => {
      const state = makeState();
      const battle = {
        type: 'siege' as const,
        territoryId: 'C',
        attacker: { factionId: 'f1', armyId: 'army1' },
        defender: { factionId: 'f2', armyId: 'army2' },
      };
      const result = makeBattleResult({ territoryCaptured: true });

      const events: string[] = [];
      WorldEventBus.on('territoryCapture', (e) => events.push(e.newOwner));

      const next = CasualtySystem.applyBattleResult(state, battle, result, worldMap);

      expect(next.territories.C!.owner).toBe('f1');
      expect(next.factions.f1!.territories).toContain('C');
      expect(next.factions.f2!.territories).not.toContain('C');
      expect(events).toEqual(['f1']);
    });

    it('does not capture territory on field battle even if territoryCaptured is true', () => {
      const state = makeState();
      const battle = {
        type: 'field' as const,
        territoryId: 'C',
        attacker: { factionId: 'f1', armyId: 'army1' },
        defender: { factionId: 'f2', armyId: 'army2' },
      };
      const result = makeBattleResult({ territoryCaptured: true });

      const next = CasualtySystem.applyBattleResult(state, battle, result, worldMap);

      expect(next.territories.C!.owner).toBe('f2');
    });

    it('removes dead generals from armies, factions, and state', () => {
      const state = makeState();
      const battle = {
        type: 'siege' as const,
        territoryId: 'C',
        attacker: { factionId: 'f1', armyId: 'army1' },
        defender: { factionId: 'f2', armyId: 'army2' },
      };
      const result = makeBattleResult({
        defenderCasualties: { totalTroopsLost: 8000, generalReports: [
          { generalId: 'g2', troopsLost: 8000, hpPercent: 0, wasDefeated: true, died: true },
        ]},
      });

      const died: string[] = [];
      WorldEventBus.on('generalDied', (e) => died.push(e.generalId));

      const next = CasualtySystem.applyBattleResult(state, battle, result, worldMap);

      expect(next.generals.g2).toBeUndefined();
      expect(next.factions.f2!.generals).not.toContain('g2');
      expect(died).toEqual(['g2']);
    });

    it('retreats loser army to nearest friendly territory', () => {
      const state = makeState();
      const battle = {
        type: 'siege' as const,
        territoryId: 'C',
        attacker: { factionId: 'f1', armyId: 'army1' },
        defender: { factionId: 'f2', armyId: 'army2' },
      };
      // f1 wins → f2 loses → army2 retreats
      // army2 is at C, nearest f2 friendly is... none after C is captured
      // Without capture, C is still f2's → but the loser needs to retreat to a *different* friendly
      // Let's test without territory capture: f2 still owns C but loser retreats anyway
      const result = makeBattleResult();

      // army2 at C (f2 territory), nearest friendly *neighbor* via BFS from C:
      // C→B (f1 owned) → no, B→A (f1 owned) → no. No f2 neighbor found.
      // So army2 gets disbanded (no friendly retreat found).

      // For a proper retreat test, give f2 territory B so they can retreat there.
      const stateWithRetreat = {
        ...state,
        factions: {
          ...state.factions,
          f1: { ...state.factions.f1!, territories: ['A'] },
          f2: { ...state.factions.f2!, territories: ['B', 'C'] },
        },
        territories: {
          ...state.territories,
          B: { ...state.territories.B!, owner: 'f2' },
        },
      } as WorldState;

      const next = CasualtySystem.applyBattleResult(stateWithRetreat, battle, result, worldMap);

      expect(next.armies.army2!.locationNodeId).toBe('B');
      expect(next.armies.army2!.status).toBe('idle');
    });

    it('resets winner army status to idle', () => {
      const state = makeState();
      const battle = {
        type: 'siege' as const,
        territoryId: 'C',
        attacker: { factionId: 'f1', armyId: 'army1' },
        defender: { factionId: 'f2', armyId: 'army2' },
      };
      const result = makeBattleResult();

      // Give f2 a retreat route so they don't get disbanded
      const stateWithRetreat = {
        ...state,
        factions: {
          ...state.factions,
          f1: { ...state.factions.f1!, territories: ['A'] },
          f2: { ...state.factions.f2!, territories: ['B', 'C'] },
        },
        territories: {
          ...state.territories,
          B: { ...state.territories.B!, owner: 'f2' },
        },
      } as WorldState;

      const next = CasualtySystem.applyBattleResult(stateWithRetreat, battle, result, worldMap);

      expect(next.armies.army1!.status).toBe('idle');
    });

    it('auto-disbands army when all generals die', () => {
      const state = makeState();
      const battle = {
        type: 'siege' as const,
        territoryId: 'C',
        attacker: { factionId: 'f1', armyId: 'army1' },
        defender: { factionId: 'f2', armyId: 'army2' },
      };
      const result = makeBattleResult({
        defenderCasualties: { totalTroopsLost: 8000, generalReports: [
          { generalId: 'g2', troopsLost: 8000, hpPercent: 0, wasDefeated: true, died: true },
        ]},
      });

      const disbanded: string[] = [];
      WorldEventBus.on('armyDisbanded', (e) => disbanded.push(e.armyId));

      const next = CasualtySystem.applyBattleResult(state, battle, result, worldMap);

      expect(next.armies.army2).toBeUndefined();
      expect(disbanded).toContain('army2');
    });

    it('applies troop loss and injury to surviving generals', () => {
      const state = makeState();
      const battle = {
        type: 'siege' as const,
        territoryId: 'C',
        attacker: { factionId: 'f1', armyId: 'army1' },
        defender: { factionId: 'f2', armyId: 'army2' },
      };
      const result = makeBattleResult({
        defenderCasualties: { totalTroopsLost: 5000, generalReports: [
          { generalId: 'g2', troopsLost: 5000, hpPercent: 0.3, wasDefeated: false, died: false, injury: { turns: 3 } },
        ]},
      });

      // Give f2 a retreat route
      const stateWithRetreat = {
        ...state,
        factions: {
          ...state.factions,
          f1: { ...state.factions.f1!, territories: ['A'] },
          f2: { ...state.factions.f2!, territories: ['B', 'C'] },
        },
        territories: {
          ...state.territories,
          B: { ...state.territories.B!, owner: 'f2' },
        },
      } as WorldState;

      const injured: { id: string; turns: number }[] = [];
      WorldEventBus.on('generalInjured', (e) => injured.push({ id: e.generalId, turns: e.turns }));

      const next = CasualtySystem.applyBattleResult(stateWithRetreat, battle, result, worldMap);

      expect(next.generals.g2!.currentTroops).toBe(3000); // 8000 - 5000
      expect(next.generals.g2!.status).toBe('injured');
      expect(next.generals.g2!.injuryTurns).toBe(3);
      expect(injured).toEqual([{ id: 'g2', turns: 3 }]);
    });
  });
});
