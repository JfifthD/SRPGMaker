// ─────────────────────────────────────────────
//  Faction System — Initialization, elimination, game over
//  Pure functions (except initWorldState which builds initial state).
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldMapData, WorldNode } from '../data/types/World';
import type { FactionData, FactionState, ResourcePool } from '../data/types/Faction';
import type { GeneralData } from '../data/types/General';
import { createGeneralState, type GeneralState } from '../data/types/General';
import type { TerritoryState } from '../data/types/Territory';
import type { DiplomacyState } from '../data/types/Diplomacy';
import type { WorldState } from '../state/WorldState';

// --- Initialization ---

export const FactionSystem = {
  /** Build initial WorldState from game data. */
  initWorldState(
    worldMap: WorldMapData,
    factionDataList: FactionData[],
    generalDataList: GeneralData[],
    diplomacy: DiplomacyState,
    playerFactionId: string,
    protagonistId: string,
  ): WorldState {
    const factions: Record<string, FactionState> = {};
    const territories: Record<string, TerritoryState> = {};
    const generals: Record<string, GeneralState> = {};

    // Initialize all territories as neutral
    for (const node of worldMap.nodes) {
      territories[node.id] = createTerritoryState(node);
    }

    // Initialize factions
    for (const fd of factionDataList) {
      factions[fd.id] = {
        id: fd.id,
        territories: [...fd.startTerritories],
        generals: [...fd.startGenerals],
        armies: [],
        resources: { ...fd.startResources },
        alive: true,
      };

      // Assign territory ownership
      for (const tId of fd.startTerritories) {
        if (territories[tId]) {
          territories[tId]!.owner = fd.id;
        }
      }

      // Initialize generals
      for (const gId of fd.startGenerals) {
        const gData = generalDataList.find(g => g.id === gId);
        if (gData) {
          generals[gData.id] = createGeneralState(gData, fd.id, fd.capital);
        }
      }
    }

    return {
      turn: 1,
      day: 30,
      phase: 'player_actions',
      factions,
      territories,
      armies: {},
      generals,
      diplomacy,
      pendingBattles: [],
      playerFactionId,
      protagonistId,
      availableGenerals: [],
      stateHistory: [],
    };
  },

  /** Mark faction as dead, scatter generals to wandering pool. */
  eliminateFaction(state: WorldState, factionId: string): WorldState {
    const faction = state.factions[factionId];
    if (!faction || !faction.alive) return state;

    return produce(state, draft => {
      draft.factions[factionId]!.alive = false;
      draft.factions[factionId]!.territories = [];
      draft.factions[factionId]!.armies = [];

      // Scatter generals to wandering pool
      for (const gId of faction.generals) {
        if (draft.generals[gId]) {
          draft.generals[gId]!.faction = null;
          draft.generals[gId]!.status = 'idle';
          draft.generals[gId]!.location = '';
          draft.availableGenerals.push(draft.generals[gId]!);
        }
      }
      draft.factions[factionId]!.generals = [];

      // Disband armies
      for (const aId of faction.armies) {
        delete draft.armies[aId];
      }
    });
  },

  /** Check all factions for elimination (0 territories). */
  checkFactionElimination(state: WorldState): WorldState {
    let result = state;
    for (const faction of Object.values(state.factions)) {
      if (faction.alive && faction.territories.length === 0) {
        result = FactionSystem.eliminateFaction(result, faction.id);
      }
    }
    return result;
  },

  /** Check if the game is over. */
  isGameOver(state: WorldState): { gameOver: boolean; reason?: 'player_eliminated' | 'protagonist_dead' | 'victory' } {
    // Player faction eliminated
    const playerFaction = state.factions[state.playerFactionId];
    if (!playerFaction?.alive) {
      return { gameOver: true, reason: 'player_eliminated' };
    }

    // Protagonist dead
    const protagonist = state.generals[state.protagonistId];
    if (!protagonist || protagonist.faction !== state.playerFactionId) {
      return { gameOver: true, reason: 'protagonist_dead' };
    }

    // Victory: all other factions eliminated
    const aliveFactions = Object.values(state.factions).filter(f => f.alive);
    if (aliveFactions.length === 1 && aliveFactions[0]!.id === state.playerFactionId) {
      return { gameOver: true, reason: 'victory' };
    }

    return { gameOver: false };
  },
};

// --- Helpers ---

function createTerritoryState(node: WorldNode): TerritoryState {
  return {
    id: node.id,
    owner: null,
    garrison: [],
    upgrades: [],
    population: getDefaultPopulation(node.type),
    morale: 50,
    underSiege: false,
    turnsOwned: 0,
  };
}

function getDefaultPopulation(type: string): number {
  switch (type) {
    case 'city': return 5000;
    case 'fortress': return 2000;
    case 'village': return 3000;
    case 'port': return 4000;
    case 'pass': return 500;
    case 'camp': return 200;
    default: return 1000;
  }
}
