// ─────────────────────────────────────────────
//  Army System — Creation, movement, collision
//  Pure functions, no side effects.
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldMapData } from '../data/types/World';
import type { ArmyState } from '../data/types/Army';
import type { WorldState, BattleContext } from '../state/WorldState';
import { WorldEventBus } from '../WorldEventBus';
import { getAdjacentTerritories, getEdge } from './TerritorySystem';

let armyIdCounter = 0;

export function resetArmyIdCounter(): void {
  armyIdCounter = 0;
}

// --- Creation / Disbanding ---

export function getMaxArmies(state: WorldState, factionId: string): number {
  const faction = state.factions[factionId];
  return faction ? faction.territories.length : 0;
}

export function canCreateArmy(state: WorldState, factionId: string): boolean {
  const faction = state.factions[factionId];
  if (!faction) return false;
  return faction.armies.length < getMaxArmies(state, factionId);
}

export function createArmy(
  state: WorldState,
  factionId: string,
  generalIds: string[],
  locationNodeId: string,
): WorldState {
  if (!canCreateArmy(state, factionId)) return state;
  if (generalIds.length === 0) return state;

  // Validate generals: must belong to faction, not already in an army
  for (const gId of generalIds) {
    const gen = state.generals[gId];
    if (!gen || gen.faction !== factionId) return state;
    if (gen.status === 'army' || gen.status === 'injured') return state;
  }

  const armyId = `army_${factionId}_${++armyIdCounter}`;

  const newState = produce(state, draft => {
    const army: ArmyState = {
      id: armyId,
      factionId,
      generals: [...generalIds],
      locationNodeId,
      status: 'idle',
    };
    draft.armies[armyId] = army;
    draft.factions[factionId]!.armies.push(armyId);

    for (const gId of generalIds) {
      draft.generals[gId]!.status = 'army';
      draft.generals[gId]!.location = armyId;
    }
  });

  WorldEventBus.emit('armyCreated', { armyId, factionId });
  return newState;
}

export function disbandArmy(state: WorldState, armyId: string): WorldState {
  const army = state.armies[armyId];
  if (!army) return state;

  const newState = produce(state, draft => {
    // Return generals to territory
    for (const gId of army.generals) {
      if (draft.generals[gId]) {
        draft.generals[gId]!.status = 'idle';
        draft.generals[gId]!.location = army.locationNodeId;
      }
    }

    // Remove from faction
    const faction = draft.factions[army.factionId];
    if (faction) {
      const idx = faction.armies.indexOf(armyId);
      if (idx !== -1) faction.armies.splice(idx, 1);
    }

    // Remove army
    delete draft.armies[armyId];
  });

  WorldEventBus.emit('armyDisbanded', { armyId });
  return newState;
}

// --- Movement ---

export function setArmyMovementOrder(
  state: WorldState,
  armyId: string,
  targetNodeId: string,
  path: string[],
): WorldState {
  const army = state.armies[armyId];
  if (!army || army.status === 'in_battle') return state;

  return produce(state, draft => {
    const a = draft.armies[armyId]!;
    a.status = 'moving';
    a.targetNodeId = targetNodeId;
    // path includes current node at [0], remaining nodes after
    a.movementPath = path.length > 1 ? path.slice(1) : [];
    a.movementProgress = 0;
  });
}

/** Advance army by one edge (one world turn of movement). */
export function advanceArmyMovement(state: WorldState, armyId: string): WorldState {
  const army = state.armies[armyId];
  if (!army || army.status !== 'moving') return state;
  if (!army.movementPath || army.movementPath.length === 0) {
    // Already at destination
    return produce(state, draft => {
      const a = draft.armies[armyId]!;
      a.status = 'idle';
      delete a.movementPath;
      delete a.targetNodeId;
      delete a.movementProgress;
    });
  }

  const fromNode = army.locationNodeId;
  const nextNode = army.movementPath[0]!;

  const newState = produce(state, draft => {
    const a = draft.armies[armyId]!;
    a.locationNodeId = nextNode;
    a.movementPath = a.movementPath!.slice(1);
    a.movementProgress = 0;

    // If no more path, movement complete
    if (a.movementPath.length === 0) {
      a.status = 'idle';
      delete a.targetNodeId;
      delete a.movementPath;
      delete a.movementProgress;
    }
  });

  WorldEventBus.emit('armyMoved', { armyId, fromNode, toNode: nextNode });
  return newState;
}

// --- Collision Detection ---

/** Detect hostile armies at the same node. Returns BattleContext[] for all conflicts. */
export function detectCollisions(state: WorldState, worldMap: WorldMapData): BattleContext[] {
  const battles: BattleContext[] = [];
  const processed = new Set<string>();

  // Group armies by location
  const armiesByNode: Record<string, ArmyState[]> = {};
  for (const army of Object.values(state.armies)) {
    if (army.status === 'in_battle') continue;
    if (!armiesByNode[army.locationNodeId]) armiesByNode[army.locationNodeId] = [];
    armiesByNode[army.locationNodeId]!.push(army);
  }

  // Check each node for hostile encounters
  for (const [nodeId, armies] of Object.entries(armiesByNode)) {
    if (armies.length < 2) continue;

    // Find pairs of hostile factions
    for (let i = 0; i < armies.length; i++) {
      for (let j = i + 1; j < armies.length; j++) {
        const a = armies[i]!;
        const b = armies[j]!;
        if (a.factionId === b.factionId) continue;

        const pairKey = [a.id, b.id].sort().join(':');
        if (processed.has(pairKey)) continue;

        // Check if at war
        const isWar = state.diplomacy.relations[a.factionId]?.[b.factionId]?.status === 'war';
        if (!isWar) continue;

        processed.add(pairKey);

        // Determine attacker/defender: the one who moved is the attacker
        const node = worldMap.nodes.find(n => n.id === nodeId);
        const territoryOwner = state.territories[nodeId]?.owner;
        const isASiege = a.factionId !== territoryOwner;
        const attackerArmy = isASiege ? a : b;
        const defenderArmy = isASiege ? b : a;

        battles.push({
          id: `battle_${state.turn}_${battles.length}`,
          type: territoryOwner ? 'siege' : 'field',
          territoryId: nodeId,
          edgeId: null,
          attacker: { factionId: attackerArmy.factionId, armyId: attackerArmy.id },
          defender: { factionId: defenderArmy.factionId, armyId: defenderArmy.id },
          mode: 'auto', // Default; player can override to 'manual'
          battleMapId: node?.battleMapId ?? `field_${node?.terrain ?? 'plains'}`,
        });
      }
    }
  }

  return battles;
}

// --- Merge / Split ---

export function mergeArmies(state: WorldState, armyId1: string, armyId2: string): WorldState {
  const army1 = state.armies[armyId1];
  const army2 = state.armies[armyId2];
  if (!army1 || !army2) return state;
  if (army1.factionId !== army2.factionId) return state;
  if (army1.locationNodeId !== army2.locationNodeId) return state;

  return produce(state, draft => {
    // Move army2 generals into army1
    for (const gId of army2.generals) {
      draft.armies[armyId1]!.generals.push(gId);
      if (draft.generals[gId]) {
        draft.generals[gId]!.location = armyId1;
      }
    }

    // Remove army2 from faction
    const faction = draft.factions[army2.factionId];
    if (faction) {
      const idx = faction.armies.indexOf(armyId2);
      if (idx !== -1) faction.armies.splice(idx, 1);
    }

    delete draft.armies[armyId2];
  });
}

export function splitArmy(state: WorldState, armyId: string, generalIds: string[]): WorldState {
  const army = state.armies[armyId];
  if (!army) return state;
  if (generalIds.length === 0) return state;
  if (!canCreateArmy(state, army.factionId)) return state;

  // Validate generals belong to this army
  for (const gId of generalIds) {
    if (!army.generals.includes(gId)) return state;
  }

  // Don't allow splitting all generals out (would leave empty army)
  if (generalIds.length >= army.generals.length) return state;

  const newArmyId = `army_${army.factionId}_${++armyIdCounter}`;

  return produce(state, draft => {
    // Remove generals from original army
    const remaining = draft.armies[armyId]!.generals.filter(g => !generalIds.includes(g));
    draft.armies[armyId]!.generals = remaining;

    // Create new army
    const newArmy: ArmyState = {
      id: newArmyId,
      factionId: army.factionId,
      generals: [...generalIds],
      locationNodeId: army.locationNodeId,
      status: 'idle',
    };
    draft.armies[newArmyId] = newArmy;
    draft.factions[army.factionId]!.armies.push(newArmyId);

    for (const gId of generalIds) {
      if (draft.generals[gId]) {
        draft.generals[gId]!.location = newArmyId;
      }
    }
  });
}
