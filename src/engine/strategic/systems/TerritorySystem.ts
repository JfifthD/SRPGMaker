// ─────────────────────────────────────────────
//  Territory System — Graph queries + ownership
//  Pure functions, no side effects.
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldMapData, WorldEdge } from '../data/types/World';
import type { WorldState } from '../state/WorldState';

// --- Adjacency Graph Helpers ---

/** Build an adjacency list from edges for fast neighbor lookups. */
export function buildAdjacencyMap(worldMap: WorldMapData): Record<string, string[]> {
  const adj: Record<string, string[]> = {};

  for (const node of worldMap.nodes) {
    adj[node.id] = [];
  }

  for (const edge of worldMap.edges) {
    if (!edge.passable) continue;
    adj[edge.from]?.push(edge.to);
    if (edge.bidirectional) {
      adj[edge.to]?.push(edge.from);
    }
  }

  return adj;
}

/** Get neighbor node ids reachable from a given node. */
export function getAdjacentTerritories(worldMap: WorldMapData, nodeId: string): string[] {
  const neighbors: string[] = [];

  for (const edge of worldMap.edges) {
    if (!edge.passable) continue;
    if (edge.from === nodeId) neighbors.push(edge.to);
    if (edge.bidirectional && edge.to === nodeId) neighbors.push(edge.from);
  }

  return neighbors;
}

/** Get edge between two adjacent nodes, or undefined. */
export function getEdge(worldMap: WorldMapData, fromId: string, toId: string): WorldEdge | undefined {
  return worldMap.edges.find(e => {
    if (e.from === fromId && e.to === toId) return true;
    if (e.bidirectional && e.to === fromId && e.from === toId) return true;
    return false;
  });
}

// --- BFS Path Finding ---

/** Find shortest path between two nodes (by hop count). Returns node ids including start and end. */
export function findShortestPath(worldMap: WorldMapData, fromNode: string, toNode: string): string[] | null {
  if (fromNode === toNode) return [fromNode];

  const adj = buildAdjacencyMap(worldMap);
  const visited = new Set<string>([fromNode]);
  const queue: string[][] = [[fromNode]];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1]!;

    for (const neighbor of (adj[current] ?? [])) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);

      const newPath = [...path, neighbor];
      if (neighbor === toNode) return newPath;
      queue.push(newPath);
    }
  }

  return null; // No path exists
}

/** Get all reachable nodes within maxHops from a starting node. */
export function getReachableNodes(worldMap: WorldMapData, fromNode: string, maxHops: number): string[] {
  const adj = buildAdjacencyMap(worldMap);
  const visited = new Set<string>([fromNode]);
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: fromNode, depth: 0 }];
  const reachable: string[] = [];

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (depth > 0) reachable.push(nodeId);
    if (depth >= maxHops) continue;

    for (const neighbor of (adj[nodeId] ?? [])) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ nodeId: neighbor, depth: depth + 1 });
    }
  }

  return reachable;
}

// --- Ownership ---

/** Transfer territory ownership. Updates territory state + faction territory arrays. */
export function transferTerritory(state: WorldState, territoryId: string, newOwner: string): WorldState {
  const territory = state.territories[territoryId];
  if (!territory) return state;

  const oldOwner = territory.owner;
  if (oldOwner === newOwner) return state;

  return produce(state, draft => {
    // Update territory
    draft.territories[territoryId]!.owner = newOwner;
    draft.territories[territoryId]!.turnsOwned = 0;

    // Remove from old owner's faction
    if (oldOwner && draft.factions[oldOwner]) {
      const idx = draft.factions[oldOwner]!.territories.indexOf(territoryId);
      if (idx !== -1) draft.factions[oldOwner]!.territories.splice(idx, 1);
    }

    // Add to new owner's faction
    if (draft.factions[newOwner]) {
      draft.factions[newOwner]!.territories.push(territoryId);
    }
  });
}

// --- Retreat Helper ---

/** Find nearest territory owned by the given faction. Returns node id or null. */
export function findNearestFriendly(
  worldMap: WorldMapData,
  state: WorldState,
  fromNode: string,
  factionId: string,
): string | null {
  const adj = buildAdjacencyMap(worldMap);
  const visited = new Set<string>([fromNode]);
  const queue: string[] = [fromNode];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighbor of (adj[current] ?? [])) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);

      const territory = state.territories[neighbor];
      if (territory?.owner === factionId) return neighbor;

      queue.push(neighbor);
    }
  }

  return null;
}
