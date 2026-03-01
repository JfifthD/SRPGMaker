import { describe, it, expect } from 'vitest';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { WorldState } from '@/engine/strategic/state/WorldState';
import {
  getAdjacentTerritories,
  findShortestPath,
  getReachableNodes,
  transferTerritory,
  findNearestFriendly,
  getEdge,
  buildAdjacencyMap,
} from '@/engine/strategic/systems/TerritorySystem';

// --- Test World Map ---
// A -> B -> C
// |         |
// D -> E -> F
const testMap: WorldMapData = {
  mapWidth: 600,
  mapHeight: 400,
  nodes: [
    { id: 'A', name: 'A', type: 'city', x: 0, y: 0, visionRadius: 7, defenseBonus: 30, maxUpgradeSlots: 4, terrain: 'plains' },
    { id: 'B', name: 'B', type: 'fortress', x: 100, y: 0, visionRadius: 7, defenseBonus: 50, maxUpgradeSlots: 3, terrain: 'mountain' },
    { id: 'C', name: 'C', type: 'village', x: 200, y: 0, visionRadius: 5, defenseBonus: 10, maxUpgradeSlots: 2, terrain: 'forest' },
    { id: 'D', name: 'D', type: 'port', x: 0, y: 100, visionRadius: 5, defenseBonus: 20, maxUpgradeSlots: 3, terrain: 'coastal' },
    { id: 'E', name: 'E', type: 'pass', x: 100, y: 100, visionRadius: 5, defenseBonus: 40, maxUpgradeSlots: 1, terrain: 'mountain' },
    { id: 'F', name: 'F', type: 'camp', x: 200, y: 100, visionRadius: 3, defenseBonus: 5, maxUpgradeSlots: 1, terrain: 'desert' },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', bidirectional: true, moveCost: 1, terrain: 'plains', passable: true },
    { id: 'e2', from: 'B', to: 'C', bidirectional: true, moveCost: 1, terrain: 'mountain', passable: true },
    { id: 'e3', from: 'A', to: 'D', bidirectional: true, moveCost: 1, terrain: 'coastal', passable: true },
    { id: 'e4', from: 'D', to: 'E', bidirectional: true, moveCost: 1, terrain: 'mountain', passable: true },
    { id: 'e5', from: 'E', to: 'F', bidirectional: true, moveCost: 1, terrain: 'desert', passable: true },
    { id: 'e6', from: 'C', to: 'F', bidirectional: true, moveCost: 1, terrain: 'forest', passable: true },
  ],
};

function makeState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    turn: 1, day: 30, phase: 'player_actions',
    factions: {
      f1: { id: 'f1', territories: ['A', 'B'], generals: [], armies: [], resources: { gold: 0, food: 0, troops: 0 }, alive: true },
      f2: { id: 'f2', territories: ['E', 'F'], generals: [], armies: [], resources: { gold: 0, food: 0, troops: 0 }, alive: true },
    },
    territories: {
      A: { id: 'A', owner: 'f1', garrison: [], upgrades: [], population: 5000, morale: 50, underSiege: false, turnsOwned: 5 },
      B: { id: 'B', owner: 'f1', garrison: [], upgrades: [], population: 2000, morale: 50, underSiege: false, turnsOwned: 5 },
      C: { id: 'C', owner: null, garrison: [], upgrades: [], population: 3000, morale: 50, underSiege: false, turnsOwned: 0 },
      D: { id: 'D', owner: null, garrison: [], upgrades: [], population: 4000, morale: 50, underSiege: false, turnsOwned: 0 },
      E: { id: 'E', owner: 'f2', garrison: [], upgrades: [], population: 500, morale: 50, underSiege: false, turnsOwned: 3 },
      F: { id: 'F', owner: 'f2', garrison: [], upgrades: [], population: 200, morale: 50, underSiege: false, turnsOwned: 3 },
    },
    armies: {}, generals: {},
    diplomacy: { relations: {} },
    pendingBattles: [],
    playerFactionId: 'f1', protagonistId: 'gen1',
    availableGenerals: [], stateHistory: [],
    ...overrides,
  };
}

describe('TerritorySystem', () => {
  describe('getAdjacentTerritories', () => {
    it('returns correct neighbors for node A', () => {
      const adj = getAdjacentTerritories(testMap, 'A');
      expect(adj).toContain('B');
      expect(adj).toContain('D');
      expect(adj).toHaveLength(2);
    });

    it('returns correct neighbors for node E (center)', () => {
      const adj = getAdjacentTerritories(testMap, 'E');
      expect(adj).toContain('D');
      expect(adj).toContain('F');
      expect(adj).toHaveLength(2);
    });

    it('returns empty for unknown node', () => {
      expect(getAdjacentTerritories(testMap, 'Z')).toHaveLength(0);
    });
  });

  describe('buildAdjacencyMap', () => {
    it('builds adjacency for all nodes', () => {
      const adj = buildAdjacencyMap(testMap);
      expect(Object.keys(adj)).toHaveLength(6);
      expect(adj['A']).toContain('B');
      expect(adj['B']).toContain('A'); // bidirectional
    });
  });

  describe('getEdge', () => {
    it('finds edge between A and B', () => {
      const edge = getEdge(testMap, 'A', 'B');
      expect(edge).toBeDefined();
      expect(edge!.id).toBe('e1');
    });

    it('finds reverse direction for bidirectional edge', () => {
      const edge = getEdge(testMap, 'B', 'A');
      expect(edge).toBeDefined();
      expect(edge!.id).toBe('e1');
    });

    it('returns undefined for non-adjacent nodes', () => {
      expect(getEdge(testMap, 'A', 'F')).toBeUndefined();
    });
  });

  describe('findShortestPath', () => {
    it('finds direct path A -> B', () => {
      const path = findShortestPath(testMap, 'A', 'B');
      expect(path).toEqual(['A', 'B']);
    });

    it('finds multi-hop path A -> F', () => {
      const path = findShortestPath(testMap, 'A', 'F');
      expect(path).not.toBeNull();
      // Two possible shortest paths: A-B-C-F or A-D-E-F (both 4 hops)
      expect(path!.length).toBe(4);
      expect(path![0]).toBe('A');
      expect(path![path!.length - 1]).toBe('F');
    });

    it('returns single-node path for same start/end', () => {
      expect(findShortestPath(testMap, 'A', 'A')).toEqual(['A']);
    });

    it('returns null for disconnected nodes', () => {
      // Map with isolated node
      const isolated: WorldMapData = {
        ...testMap,
        nodes: [...testMap.nodes, { id: 'Z', name: 'Z', type: 'camp', x: 500, y: 500, visionRadius: 3, defenseBonus: 0, maxUpgradeSlots: 0, terrain: 'desert' }],
      };
      expect(findShortestPath(isolated, 'A', 'Z')).toBeNull();
    });
  });

  describe('getReachableNodes', () => {
    it('returns 2-hop neighbors from A', () => {
      const reachable = getReachableNodes(testMap, 'A', 2);
      expect(reachable).toContain('B');
      expect(reachable).toContain('D');
      expect(reachable).toContain('C'); // 2 hops
      expect(reachable).toContain('E'); // 2 hops
      expect(reachable).not.toContain('A'); // self excluded
    });

    it('returns only direct neighbors at maxHops=1', () => {
      const reachable = getReachableNodes(testMap, 'A', 1);
      expect(reachable).toEqual(expect.arrayContaining(['B', 'D']));
      expect(reachable).toHaveLength(2);
    });
  });

  describe('transferTerritory', () => {
    it('changes territory owner and updates faction arrays', () => {
      const state = makeState();
      const next = transferTerritory(state, 'C', 'f1');

      expect(next.territories['C']!.owner).toBe('f1');
      expect(next.factions['f1']!.territories).toContain('C');
      expect(next.territories['C']!.turnsOwned).toBe(0);
    });

    it('moves territory between factions', () => {
      const state = makeState();
      const next = transferTerritory(state, 'A', 'f2');

      expect(next.territories['A']!.owner).toBe('f2');
      expect(next.factions['f1']!.territories).not.toContain('A');
      expect(next.factions['f2']!.territories).toContain('A');
    });

    it('returns same state if same owner', () => {
      const state = makeState();
      expect(transferTerritory(state, 'A', 'f1')).toBe(state);
    });

    it('preserves immutability', () => {
      const state = makeState();
      const next = transferTerritory(state, 'C', 'f1');
      expect(next).not.toBe(state);
      expect(state.territories['C']!.owner).toBeNull();
    });
  });

  describe('findNearestFriendly', () => {
    it('finds nearest f1 territory from C', () => {
      const state = makeState();
      const nearest = findNearestFriendly(testMap, state, 'C', 'f1');
      expect(nearest).toBe('B'); // C->B is 1 hop, C->F->E but E is f2
    });

    it('finds nearest f2 territory from D', () => {
      const state = makeState();
      const nearest = findNearestFriendly(testMap, state, 'D', 'f2');
      expect(nearest).toBe('E'); // D->E is 1 hop
    });

    it('returns null if no friendly territory reachable', () => {
      const state = makeState({
        factions: {
          ...makeState().factions,
          f3: { id: 'f3', territories: [], generals: [], armies: [], resources: { gold: 0, food: 0, troops: 0 }, alive: true },
        },
      });
      expect(findNearestFriendly(testMap, state, 'A', 'f3')).toBeNull();
    });
  });
});
