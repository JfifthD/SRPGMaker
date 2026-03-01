import { describe, it, expect, beforeEach } from 'vitest';
import { StrategicAI } from '@/engine/strategic/systems/StrategicAI';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';
import { resetArmyIdCounter } from '@/engine/strategic/systems/ArmySystem';
import type { WorldState } from '@/engine/strategic/state/WorldState';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { GeneralState } from '@/engine/strategic/data/types/General';
import { createArmy } from '@/engine/strategic/systems/ArmySystem';

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

function makeGeneral(id: string, faction: string, location: string): GeneralState {
  return {
    id, name: id, unitDataId: 'warrior',
    leadership: 10, intellect: 5, politics: 5, charm: 5,
    faction, location, status: 'idle', injuryTurns: 0,
    loyalty: 70, currentTroops: 10000,
  };
}

function makeState(): WorldState {
  return {
    turn: 1, day: 30, phase: 'player_actions',
    factions: {
      f1: { id: 'f1', territories: ['A', 'B'], generals: ['g1', 'g2', 'g3'], armies: [], resources: { gold: 5000, food: 3000, troops: 10000 }, alive: true },
      f2: { id: 'f2', territories: ['C'], generals: ['g4'], armies: [], resources: { gold: 3000, food: 2000, troops: 5000 }, alive: true },
    },
    territories: {
      A: { id: 'A', owner: 'f1', garrison: [], upgrades: [], population: 5000, morale: 50, underSiege: false, turnsOwned: 5 },
      B: { id: 'B', owner: 'f1', garrison: [], upgrades: [], population: 2000, morale: 50, underSiege: false, turnsOwned: 5 },
      C: { id: 'C', owner: 'f2', garrison: [], upgrades: [], population: 3000, morale: 50, underSiege: false, turnsOwned: 3 },
    },
    armies: {},
    generals: {
      g1: makeGeneral('g1', 'f1', 'A'),
      g2: makeGeneral('g2', 'f1', 'A'),
      g3: makeGeneral('g3', 'f1', 'B'),
      g4: makeGeneral('g4', 'f2', 'C'),
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

describe('StrategicAI', () => {
  describe('tryCreateArmy', () => {
    it('creates army from idle generals', () => {
      const state = makeState();
      const action = StrategicAI.tryCreateArmy(state, 'f1', 'A');

      expect(action).not.toBeNull();
      expect(action!.type).toBe('CREATE_ARMY');
      // Action should be valid and executable
      expect(action!.validate(state)).toBe(true);
      const next = action!.execute(state);
      expect(Object.keys(next.armies)).toHaveLength(1);
    });

    it('returns null when no idle generals', () => {
      let state = makeState();
      // Put all f2 generals into an army so none are idle
      state = createArmy(state, 'f2', ['g4'], 'C');

      const action = StrategicAI.tryCreateArmy(state, 'f2', 'C');
      expect(action).toBeNull();
    });

    it('returns null when army cap reached', () => {
      let state = makeState();
      // f2 has 1 territory → max 1 army
      state = createArmy(state, 'f2', ['g4'], 'C');

      // Add another idle general to f2 so there's someone to recruit
      state = {
        ...state,
        generals: {
          ...state.generals,
          g5: makeGeneral('g5', 'f2', 'C'),
        },
        factions: {
          ...state.factions,
          f2: { ...state.factions['f2']!, generals: ['g4', 'g5'] },
        },
      };

      const action = StrategicAI.tryCreateArmy(state, 'f2', 'C');
      expect(action).toBeNull();
    });

    it('returns null when locationNodeId is empty', () => {
      const state = makeState();
      const action = StrategicAI.tryCreateArmy(state, 'f1', '');
      expect(action).toBeNull();
    });
  });

  describe('planArmyMovements', () => {
    it('moves idle army toward nearest enemy territory', () => {
      let state = makeState();
      // Create an idle army for f1 at node A
      state = createArmy(state, 'f1', ['g1'], 'A');

      const actions = StrategicAI.planArmyMovements(state, 'f1', testMap);

      expect(actions).toHaveLength(1);
      expect(actions[0]!.type).toBe('MOVE_ARMY');
      // The army should move from A toward C (enemy territory)
      // Path: A → B → C, so MoveArmyAction path should be ['A', 'B', 'C']
      expect(actions[0]!.validate(state)).toBe(true);
    });

    it('returns empty when no enemies at war', () => {
      let state = makeState();
      // Change diplomacy to neutral
      state = {
        ...state,
        diplomacy: { relations: {
          f1: { f2: { status: 'neutral', favorability: 0, treatyTurnsLeft: 0 } },
          f2: { f1: { status: 'neutral', favorability: 0, treatyTurnsLeft: 0 } },
        }},
      };
      state = createArmy(state, 'f1', ['g1'], 'A');

      const actions = StrategicAI.planArmyMovements(state, 'f1', testMap);
      expect(actions).toHaveLength(0);
    });

    it('skips armies that are not idle', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      const armyId = Object.keys(state.armies)[0]!;
      // Set army status to moving (not idle)
      state = {
        ...state,
        armies: {
          ...state.armies,
          [armyId]: { ...state.armies[armyId]!, status: 'moving' as const },
        },
      };

      const actions = StrategicAI.planArmyMovements(state, 'f1', testMap);
      expect(actions).toHaveLength(0);
    });

    it('handles army already adjacent to enemy', () => {
      let state = makeState();
      // Create army at B, which is adjacent to C (enemy)
      state = createArmy(state, 'f1', ['g3'], 'B');

      const actions = StrategicAI.planArmyMovements(state, 'f1', testMap);
      expect(actions).toHaveLength(1);
      // Path from B to C is just [B, C]
      expect(actions[0]!.validate(state)).toBe(true);
    });
  });

  describe('decideFactionActions', () => {
    it('returns create + move actions for AI faction', () => {
      const state = makeState();
      const actions = StrategicAI.decideFactionActions(state, 'f1', testMap);

      // Should have at least 1 action: create army from idle generals
      // After creating army, the army would still be idle so it could move too
      // But decideFactionActions creates army action then plans movements on original state
      // So the create action is returned, and movements are planned on original state (no armies yet)
      expect(actions.length).toBeGreaterThanOrEqual(1);
      // First action should be CreateArmyAction
      expect(actions[0]!.type).toBe('CREATE_ARMY');
    });

    it('returns empty for dead faction', () => {
      let state = makeState();
      state = {
        ...state,
        factions: {
          ...state.factions,
          f1: { ...state.factions['f1']!, alive: false },
        },
      };

      const actions = StrategicAI.decideFactionActions(state, 'f1', testMap);
      expect(actions).toHaveLength(0);
    });

    it("doesn't crash when no armies exist yet", () => {
      const state = makeState();
      // f2 has idle generals but no armies
      const actions = StrategicAI.decideFactionActions(state, 'f2', testMap);
      // Should not throw; should return create action at minimum
      expect(actions).toBeDefined();
      expect(Array.isArray(actions)).toBe(true);
    });

    it('returns empty for non-existent faction', () => {
      const state = makeState();
      const actions = StrategicAI.decideFactionActions(state, 'f_nonexistent', testMap);
      expect(actions).toHaveLength(0);
    });

    it('returns move actions when armies already exist', () => {
      let state = makeState();
      // Pre-create an army for f1 at A (so generals are no longer idle for army creation)
      state = createArmy(state, 'f1', ['g1', 'g2', 'g3'], 'A');

      const actions = StrategicAI.decideFactionActions(state, 'f1', testMap);

      // No idle generals left → no create action
      // 1 idle army at A → should have a move action toward C
      const moveActions = actions.filter(a => a.type === 'MOVE_ARMY');
      expect(moveActions).toHaveLength(1);
    });
  });
});
