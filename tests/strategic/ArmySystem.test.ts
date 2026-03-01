import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { WorldState } from '@/engine/strategic/state/WorldState';
import type { GeneralState } from '@/engine/strategic/data/types/General';
import {
  createArmy, disbandArmy, canCreateArmy, getMaxArmies,
  setArmyMovementOrder, advanceArmyMovement,
  detectCollisions, mergeArmies, splitArmy,
  resetArmyIdCounter,
} from '@/engine/strategic/systems/ArmySystem';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';

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

describe('ArmySystem', () => {
  describe('getMaxArmies', () => {
    it('equals number of owned territories', () => {
      const state = makeState();
      expect(getMaxArmies(state, 'f1')).toBe(2);
      expect(getMaxArmies(state, 'f2')).toBe(1);
    });
  });

  describe('createArmy', () => {
    it('creates army and updates generals', () => {
      const state = makeState();
      const next = createArmy(state, 'f1', ['g1', 'g2'], 'A');

      expect(Object.keys(next.armies)).toHaveLength(1);
      const armyId = Object.keys(next.armies)[0]!;
      expect(next.armies[armyId]!.generals).toEqual(['g1', 'g2']);
      expect(next.armies[armyId]!.locationNodeId).toBe('A');
      expect(next.armies[armyId]!.status).toBe('idle');
      expect(next.generals['g1']!.status).toBe('army');
      expect(next.generals['g1']!.location).toBe(armyId);
      expect(next.factions['f1']!.armies).toContain(armyId);
    });

    it('rejects creation when maxArmies reached', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      state = createArmy(state, 'f1', ['g2'], 'A');
      // f1 has 2 territories, so max 2 armies. Third should fail.
      const next = createArmy(state, 'f1', ['g3'], 'B');
      expect(Object.keys(next.armies)).toHaveLength(2); // Still 2
    });

    it('rejects creation with empty generals', () => {
      const state = makeState();
      expect(createArmy(state, 'f1', [], 'A')).toBe(state);
    });

    it('rejects general from different faction', () => {
      const state = makeState();
      expect(createArmy(state, 'f1', ['g4'], 'A')).toBe(state); // g4 belongs to f2
    });

    it('rejects injured general', () => {
      let state = makeState();
      state = { ...state, generals: { ...state.generals, g1: { ...state.generals['g1']!, status: 'injured' } } };
      expect(createArmy(state, 'f1', ['g1'], 'A')).toBe(state);
    });
  });

  describe('disbandArmy', () => {
    it('returns generals to territory', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1', 'g2'], 'A');
      const armyId = Object.keys(state.armies)[0]!;

      const next = disbandArmy(state, armyId);
      expect(next.armies[armyId]).toBeUndefined();
      expect(next.generals['g1']!.status).toBe('idle');
      expect(next.generals['g1']!.location).toBe('A');
      expect(next.factions['f1']!.armies).not.toContain(armyId);
    });
  });

  describe('movement', () => {
    it('setArmyMovementOrder sets path and status', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      const armyId = Object.keys(state.armies)[0]!;

      const next = setArmyMovementOrder(state, armyId, 'C', ['A', 'B', 'C']);
      expect(next.armies[armyId]!.status).toBe('moving');
      expect(next.armies[armyId]!.targetNodeId).toBe('C');
      expect(next.armies[armyId]!.movementPath).toEqual(['B', 'C']);
    });

    it('advanceArmyMovement moves one edge', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      const armyId = Object.keys(state.armies)[0]!;
      state = setArmyMovementOrder(state, armyId, 'C', ['A', 'B', 'C']);

      const next = advanceArmyMovement(state, armyId);
      expect(next.armies[armyId]!.locationNodeId).toBe('B');
      expect(next.armies[armyId]!.movementPath).toEqual(['C']);
      expect(next.armies[armyId]!.status).toBe('moving');
    });

    it('army becomes idle when movement complete', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      const armyId = Object.keys(state.armies)[0]!;
      state = setArmyMovementOrder(state, armyId, 'B', ['A', 'B']);

      const next = advanceArmyMovement(state, armyId);
      expect(next.armies[armyId]!.locationNodeId).toBe('B');
      expect(next.armies[armyId]!.status).toBe('idle');
      expect(next.armies[armyId]!.movementPath).toBeUndefined();
    });
  });

  describe('detectCollisions', () => {
    it('detects hostile armies at same node', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'B');
      state = createArmy(state, 'f2', ['g4'], 'B');
      // Move f2 army to same location conceptually (both at B)
      const f2ArmyId = state.factions['f2']!.armies[0]!;
      state = { ...state, armies: { ...state.armies, [f2ArmyId]: { ...state.armies[f2ArmyId]!, locationNodeId: 'B' } } };

      const battles = detectCollisions(state, testMap);
      expect(battles).toHaveLength(1);
      expect(battles[0]!.type).toBe('siege'); // B is owned by f1
    });

    it('no collision for friendly armies at same node', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      state = createArmy(state, 'f1', ['g2'], 'A');

      expect(detectCollisions(state, testMap)).toHaveLength(0);
    });

    it('no collision for neutral factions', () => {
      let state = makeState();
      // Change diplomacy to neutral
      state = {
        ...state,
        diplomacy: { relations: {
          f1: { f2: { status: 'neutral', favorability: 0, treatyTurnsLeft: 0 } },
          f2: { f1: { status: 'neutral', favorability: 0, treatyTurnsLeft: 0 } },
        }},
      };
      state = createArmy(state, 'f1', ['g1'], 'B');
      state = createArmy(state, 'f2', ['g4'], 'B');
      const f2ArmyId = state.factions['f2']!.armies[0]!;
      state = { ...state, armies: { ...state.armies, [f2ArmyId]: { ...state.armies[f2ArmyId]!, locationNodeId: 'B' } } };

      expect(detectCollisions(state, testMap)).toHaveLength(0);
    });
  });

  describe('merge / split', () => {
    it('mergeArmies combines generals', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      state = createArmy(state, 'f1', ['g2'], 'A');
      const [id1, id2] = state.factions['f1']!.armies;

      const next = mergeArmies(state, id1!, id2!);
      expect(next.armies[id1!]!.generals).toEqual(['g1', 'g2']);
      expect(next.armies[id2!]).toBeUndefined();
      expect(next.factions['f1']!.armies).toHaveLength(1);
    });

    it('splitArmy creates new army with selected generals', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1', 'g2'], 'A');
      const armyId = state.factions['f1']!.armies[0]!;

      const next = splitArmy(state, armyId, ['g2']);
      expect(next.armies[armyId]!.generals).toEqual(['g1']);
      expect(state.factions['f1']!.armies).toHaveLength(1);
      expect(next.factions['f1']!.armies).toHaveLength(2);

      const newArmyId = next.factions['f1']!.armies.find(id => id !== armyId)!;
      expect(next.armies[newArmyId]!.generals).toEqual(['g2']);
    });

    it('splitArmy rejects splitting all generals out', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      const armyId = state.factions['f1']!.armies[0]!;

      expect(splitArmy(state, armyId, ['g1'])).toBe(state);
    });

    it('mergeArmies rejects different locations', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      state = createArmy(state, 'f1', ['g3'], 'B'); // g3 is at B
      const [id1, id2] = state.factions['f1']!.armies;

      expect(mergeArmies(state, id1!, id2!)).toBe(state);
    });
  });
});
