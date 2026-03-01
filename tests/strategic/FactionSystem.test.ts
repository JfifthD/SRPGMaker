import { describe, it, expect } from 'vitest';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { FactionData } from '@/engine/strategic/data/types/Faction';
import type { GeneralData } from '@/engine/strategic/data/types/General';
import type { DiplomacyState } from '@/engine/strategic/data/types/Diplomacy';
import { FactionSystem } from '@/engine/strategic/systems/FactionSystem';

const testMap: WorldMapData = {
  mapWidth: 400, mapHeight: 400,
  nodes: [
    { id: 'A', name: 'A', type: 'city', x: 0, y: 0, visionRadius: 7, defenseBonus: 30, maxUpgradeSlots: 4, terrain: 'plains' },
    { id: 'B', name: 'B', type: 'fortress', x: 100, y: 0, visionRadius: 7, defenseBonus: 50, maxUpgradeSlots: 3, terrain: 'mountain' },
    { id: 'C', name: 'C', type: 'village', x: 200, y: 0, visionRadius: 5, defenseBonus: 10, maxUpgradeSlots: 2, terrain: 'forest' },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', bidirectional: true, moveCost: 1, terrain: 'plains', passable: true },
    { id: 'e2', from: 'B', to: 'C', bidirectional: true, moveCost: 1, terrain: 'mountain', passable: true },
  ],
};

const factions: FactionData[] = [
  {
    id: 'f1', name: 'Faction 1', color: 0xFF0000, leader: 'g1', capital: 'A',
    aiProfile: { preset: 'steady_expander' },
    isPlayer: true,
    startTerritories: ['A', 'B'], startGenerals: ['g1', 'g2'],
    startResources: { gold: 5000, food: 3000, troops: 10000 },
  },
  {
    id: 'f2', name: 'Faction 2', color: 0x0000FF, leader: 'g3', capital: 'C',
    aiProfile: { preset: 'blitz_conqueror' },
    startTerritories: ['C'], startGenerals: ['g3'],
    startResources: { gold: 3000, food: 2000, troops: 5000 },
  },
];

const generals: GeneralData[] = [
  { id: 'g1', name: 'General 1', unitDataId: 'warrior', leadership: 12, intellect: 6, politics: 5, charm: 8 },
  { id: 'g2', name: 'General 2', unitDataId: 'archer', leadership: 8, intellect: 9, politics: 4, charm: 7 },
  { id: 'g3', name: 'General 3', unitDataId: 'knight', leadership: 10, intellect: 5, politics: 3, charm: 4 },
];

const diplomacy: DiplomacyState = {
  relations: {
    f1: { f2: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
    f2: { f1: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
  },
};

describe('FactionSystem', () => {
  describe('initWorldState', () => {
    it('creates initial state with correct structure', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');

      expect(state.turn).toBe(1);
      expect(state.day).toBe(30);
      expect(state.phase).toBe('player_actions');
      expect(state.playerFactionId).toBe('f1');
      expect(state.protagonistId).toBe('g1');
    });

    it('initializes factions correctly', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');

      expect(Object.keys(state.factions)).toHaveLength(2);
      expect(state.factions['f1']!.territories).toEqual(['A', 'B']);
      expect(state.factions['f1']!.alive).toBe(true);
      expect(state.factions['f1']!.resources.gold).toBe(5000);
    });

    it('assigns territory ownership', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');

      expect(state.territories['A']!.owner).toBe('f1');
      expect(state.territories['B']!.owner).toBe('f1');
      expect(state.territories['C']!.owner).toBe('f2');
    });

    it('initializes generals with correct stats', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');

      expect(Object.keys(state.generals)).toHaveLength(3);
      expect(state.generals['g1']!.leadership).toBe(12);
      expect(state.generals['g1']!.faction).toBe('f1');
      expect(state.generals['g1']!.currentTroops).toBe(12000); // leadership * 1000
      expect(state.generals['g3']!.faction).toBe('f2');
    });

    it('sets up diplomacy', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');

      expect(state.diplomacy.relations['f1']!['f2']!.status).toBe('war');
    });

    it('starts with empty armies and battles', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');

      expect(Object.keys(state.armies)).toHaveLength(0);
      expect(state.pendingBattles).toHaveLength(0);
    });
  });

  describe('eliminateFaction', () => {
    it('marks faction as dead and scatters generals', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');
      const next = FactionSystem.eliminateFaction(state, 'f2');

      expect(next.factions['f2']!.alive).toBe(false);
      expect(next.factions['f2']!.territories).toHaveLength(0);
      expect(next.factions['f2']!.generals).toHaveLength(0);
      expect(next.generals['g3']!.faction).toBeNull();
      expect(next.availableGenerals).toHaveLength(1);
    });

    it('does nothing for already dead faction', () => {
      let state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');
      state = FactionSystem.eliminateFaction(state, 'f2');
      expect(FactionSystem.eliminateFaction(state, 'f2')).toBe(state);
    });
  });

  describe('checkFactionElimination', () => {
    it('auto-eliminates faction with 0 territories', () => {
      let state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');
      // Manually empty f2 territories
      state = { ...state, factions: { ...state.factions, f2: { ...state.factions['f2']!, territories: [] } } };

      const next = FactionSystem.checkFactionElimination(state);
      expect(next.factions['f2']!.alive).toBe(false);
    });
  });

  describe('isGameOver', () => {
    it('detects victory when only player remains', () => {
      let state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');
      state = FactionSystem.eliminateFaction(state, 'f2');

      const result = FactionSystem.isGameOver(state);
      expect(result.gameOver).toBe(true);
      expect(result.reason).toBe('victory');
    });

    it('detects player elimination', () => {
      let state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');
      state = FactionSystem.eliminateFaction(state, 'f1');

      const result = FactionSystem.isGameOver(state);
      expect(result.gameOver).toBe(true);
      expect(result.reason).toBe('player_eliminated');
    });

    it('returns false when game is ongoing', () => {
      const state = FactionSystem.initWorldState(testMap, factions, generals, diplomacy, 'f1', 'g1');
      expect(FactionSystem.isGameOver(state).gameOver).toBe(false);
    });
  });
});
