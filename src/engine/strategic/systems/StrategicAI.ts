// ─────────────────────────────────────────────
//  Strategic AI — MVP decision-making for AI factions
//  Returns WorldAction[] to be dispatched by the coordinator.
//  No personality system yet — just basic aggression.
//  Zero Phaser imports.
// ─────────────────────────────────────────────

import type { WorldMapData } from '../data/types/World';
import type { WorldState } from '../state/WorldState';
import type { WorldAction } from '../state/WorldAction';
import { CreateArmyAction } from '../state/actions/CreateArmyAction';
import { MoveArmyAction } from '../state/actions/MoveArmyAction';
import { canCreateArmy } from './ArmySystem';
import { findShortestPath } from './TerritorySystem';

export const StrategicAI = {
  /**
   * Decide actions for a single AI faction.
   * MVP: create armies from idle generals, move idle armies toward nearest enemy.
   */
  decideFactionActions(
    state: WorldState,
    factionId: string,
    worldMap: WorldMapData,
  ): WorldAction[] {
    const faction = state.factions[factionId];
    if (!faction || !faction.alive) return [];

    const actions: WorldAction[] = [];

    // 1. Create armies from idle generals at the capital
    const createAction = StrategicAI.tryCreateArmy(state, factionId, faction.territories[0] ?? '');
    if (createAction) actions.push(createAction);

    // 2. Move idle armies toward nearest enemy territory
    const moveActions = StrategicAI.planArmyMovements(state, factionId, worldMap);
    actions.push(...moveActions);

    return actions;
  },

  /**
   * Try to create an army from idle generals at the given location.
   * Groups all idle generals into one army (MVP simplicity).
   */
  tryCreateArmy(
    state: WorldState,
    factionId: string,
    locationNodeId: string,
  ): CreateArmyAction | null {
    if (!canCreateArmy(state, factionId)) return null;
    if (!locationNodeId) return null;

    const idleGenerals = Object.values(state.generals).filter(
      g => g.faction === factionId && g.status === 'idle',
    );
    if (idleGenerals.length === 0) return null;

    const generalIds = idleGenerals.map(g => g.id);
    const action = new CreateArmyAction(factionId, generalIds, locationNodeId);
    if (!action.validate(state)) return null;

    return action;
  },

  /**
   * For each idle army, find the nearest enemy territory and issue movement.
   */
  planArmyMovements(
    state: WorldState,
    factionId: string,
    worldMap: WorldMapData,
  ): MoveArmyAction[] {
    const actions: MoveArmyAction[] = [];

    const factionArmies = Object.values(state.armies).filter(
      a => a.factionId === factionId && a.status === 'idle',
    );

    // Find all enemy territories
    const enemyTerritories = Object.values(state.territories).filter(
      t => t.owner !== null && t.owner !== factionId,
    );
    if (enemyTerritories.length === 0) return actions;

    for (const army of factionArmies) {
      // Find shortest path to any enemy territory
      let bestPath: string[] | null = null;
      let bestLength = Infinity;

      for (const target of enemyTerritories) {
        // Only target factions we're at war with
        const isWar = state.diplomacy.relations[factionId]?.[target.owner!]?.status === 'war';
        if (!isWar) continue;

        const path = findShortestPath(worldMap, army.locationNodeId, target.id);
        if (path && path.length < bestLength) {
          bestPath = path;
          bestLength = path.length;
        }
      }

      if (bestPath && bestPath.length >= 2) {
        const action = new MoveArmyAction(army.id, bestPath);
        if (action.validate(state)) {
          actions.push(action);
        }
      }
    }

    return actions;
  },
};
