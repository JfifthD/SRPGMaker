import { describe, it, expect, beforeEach } from 'vitest';
import { BattleMapBuilder } from '@/engine/strategic/systems/BattleMapBuilder';
import type { WorldState, BattleContext } from '@/engine/strategic/state/WorldState';
import type { GeneralState } from '@/engine/strategic/data/types/General';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';
import { resetArmyIdCounter, createArmy } from '@/engine/strategic/systems/ArmySystem';

function makeGeneral(id: string, faction: string, location: string, overrides?: Partial<GeneralState>): GeneralState {
  return {
    id, name: id, unitDataId: 'warrior',
    leadership: 10, intellect: 5, politics: 5, charm: 5,
    faction, location, status: 'idle', injuryTurns: 0,
    loyalty: 70, currentTroops: 10000,
    ...overrides,
  };
}

function makeState(): WorldState {
  return {
    turn: 1, day: 30, phase: 'player_actions',
    factions: {
      f1: { id: 'f1', territories: ['A', 'B'], generals: ['g1', 'g2'], armies: [], resources: { gold: 5000, food: 3000, troops: 10000 }, alive: true },
      f2: { id: 'f2', territories: ['C'], generals: ['g3', 'g4'], armies: [], resources: { gold: 3000, food: 2000, troops: 5000 }, alive: true },
    },
    territories: {
      A: { id: 'A', owner: 'f1', garrison: [], upgrades: [], population: 5000, morale: 50, underSiege: false, turnsOwned: 5 },
      B: { id: 'B', owner: 'f1', garrison: [], upgrades: [], population: 2000, morale: 50, underSiege: false, turnsOwned: 5 },
      C: { id: 'C', owner: 'f2', garrison: [], upgrades: [], population: 3000, morale: 50, underSiege: false, turnsOwned: 3 },
    },
    armies: {},
    generals: {
      g1: makeGeneral('g1', 'f1', 'A'),
      g2: makeGeneral('g2', 'f1', 'A', { leadership: 15 }),
      g3: makeGeneral('g3', 'f2', 'C'),
      g4: makeGeneral('g4', 'f2', 'C', { leadership: 8, unitDataId: 'mage' }),
    },
    diplomacy: { relations: {
      f1: { f2: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
      f2: { f1: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
    }},
    pendingBattles: [],
    playerFactionId: 'f1', protagonistId: 'g1',
    availableGenerals: [], stateHistory: [],
  };
}

beforeEach(() => {
  WorldEventBus.clear();
  resetArmyIdCounter();
});

describe('BattleMapBuilder', () => {
  function setupBattle(state: WorldState): { state: WorldState; battle: BattleContext } {
    // Create armies for both factions
    let s = createArmy(state, 'f1', ['g1', 'g2'], 'B');
    s = createArmy(s, 'f2', ['g3', 'g4'], 'B');

    const f1ArmyId = s.factions['f1']!.armies[0]!;
    const f2ArmyId = s.factions['f2']!.armies[0]!;

    const battle: BattleContext = {
      id: 'battle_1_0',
      type: 'siege',
      territoryId: 'B',
      edgeId: null,
      attacker: { factionId: 'f2', armyId: f2ArmyId },
      defender: { factionId: 'f1', armyId: f1ArmyId },
      mode: 'auto',
      battleMapId: 'field_mountain',
    };

    return { state: s, battle };
  }

  describe('build', () => {
    it('creates MapData with correct dimensions', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state, 15, 12);

      expect(result.mapData.width).toBe(15);
      expect(result.mapData.height).toBe(12);
      expect(result.mapData.terrain).toHaveLength(12); // height rows
      expect(result.mapData.terrain[0]).toHaveLength(15); // width columns
    });

    it('uses default dimensions when not specified', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state);

      expect(result.mapData.width).toBe(12); // DEFAULT_WIDTH
      expect(result.mapData.height).toBe(10); // DEFAULT_HEIGHT
    });

    it('places attacker as ally spawns and defender as enemy spawns', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state, 12, 10);

      // Attacker (f2: g3, g4) → allySpawns at x=1 (left side)
      expect(result.mapData.allySpawns).toHaveLength(2);
      for (const spawn of result.mapData.allySpawns) {
        expect(spawn.x).toBe(1);
      }

      // Defender (f1: g1, g2) → enemySpawns at x=width-2=10 (right side)
      expect(result.mapData.enemySpawns).toHaveLength(2);
      for (const spawn of result.mapData.enemySpawns) {
        expect(spawn.x).toBe(10);
      }
    });

    it('returns correct generalId mappings', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state);

      // Attacker is f2 (g3, g4) → allyGeneralIds
      expect(result.allyGeneralIds).toEqual(['g3', 'g4']);
      // Defender is f1 (g1, g2) → enemyGeneralIds
      expect(result.enemyGeneralIds).toEqual(['g1', 'g2']);
    });

    it('computes commander buffs from each side', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state);

      // Attacker f2 generals: g3 (leadership 10), g4 (leadership 8) → max 10
      expect(result.allyCommanderBuff).toBe(10);
      // Defender f1 generals: g1 (leadership 10), g2 (leadership 15) → max 15
      expect(result.enemyCommanderBuff).toBe(15);
    });

    it('sets map id from battle context', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state);

      expect(result.mapData.id).toBe('field_mountain');
      expect(result.mapData.name).toBe('Battle at B');
    });

    it('fills terrain grid with plain', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state, 4, 3);

      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 4; x++) {
          expect(result.mapData.terrain[y]![x]).toBe('plain');
        }
      }
    });

    it('sets default win/loss conditions', () => {
      const { state, battle } = setupBattle(makeState());

      const result = BattleMapBuilder.build(battle, state);

      expect(result.mapData.winConditions).toEqual([{ type: 'defeat_all' }]);
      expect(result.mapData.lossConditions).toEqual([{ type: 'all_allies_dead' }]);
    });
  });

  describe('createSpawns', () => {
    it('centers spawns vertically', () => {
      const generals: GeneralState[] = [
        makeGeneral('g1', 'f1', 'A'),
        makeGeneral('g2', 'f1', 'A'),
      ];

      // mapHeight=10, 2 generals → startY = floor((10-2)/2) = 4
      const spawns = BattleMapBuilder.createSpawns(generals, 1, 10);

      expect(spawns).toHaveLength(2);
      expect(spawns[0]!.y).toBe(4);
      expect(spawns[1]!.y).toBe(5);
      expect(spawns[0]!.x).toBe(1);
      expect(spawns[1]!.x).toBe(1);
    });

    it('uses correct unitDataId from generals', () => {
      const generals: GeneralState[] = [
        makeGeneral('g1', 'f1', 'A', { unitDataId: 'knight' }),
        makeGeneral('g2', 'f1', 'A', { unitDataId: 'archer' }),
      ];

      const spawns = BattleMapBuilder.createSpawns(generals, 5, 10);

      expect(spawns[0]!.unitDataId).toBe('knight');
      expect(spawns[1]!.unitDataId).toBe('archer');
    });

    it('returns empty array for no generals', () => {
      const spawns = BattleMapBuilder.createSpawns([], 1, 10);
      expect(spawns).toHaveLength(0);
    });

    it('clamps startY to 0 when generals exceed map height', () => {
      const generals: GeneralState[] = Array.from({ length: 12 }, (_, i) =>
        makeGeneral(`g${i}`, 'f1', 'A'),
      );

      // mapHeight=10, 12 generals → floor((10-12)/2) = floor(-1) = -1, clamped to 0
      const spawns = BattleMapBuilder.createSpawns(generals, 1, 10);

      expect(spawns[0]!.y).toBe(0);
      expect(spawns[11]!.y).toBe(11);
    });
  });

  describe('getCommanderBuff', () => {
    it('returns highest leadership capped at 20', () => {
      const generals: GeneralState[] = [
        makeGeneral('g1', 'f1', 'A', { leadership: 18 }),
        makeGeneral('g2', 'f1', 'A', { leadership: 25 }), // exceeds cap
      ];

      expect(BattleMapBuilder.getCommanderBuff(generals)).toBe(20);
    });

    it('returns 0 for empty generals', () => {
      expect(BattleMapBuilder.getCommanderBuff([])).toBe(0);
    });

    it('returns exact leadership when below cap', () => {
      const generals: GeneralState[] = [
        makeGeneral('g1', 'f1', 'A', { leadership: 7 }),
        makeGeneral('g2', 'f1', 'A', { leadership: 12 }),
      ];

      expect(BattleMapBuilder.getCommanderBuff(generals)).toBe(12);
    });
  });
});
