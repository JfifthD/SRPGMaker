// ─────────────────────────────────────────────
//  World State — Immutable strategic layer state
//  Mirrors BattleState from tactical layer.
// ─────────────────────────────────────────────

import type { FactionState } from '../data/types/Faction';
import type { TerritoryState } from '../data/types/Territory';
import type { ArmyState } from '../data/types/Army';
import type { GeneralState } from '../data/types/General';
import type { DiplomacyState } from '../data/types/Diplomacy';
import type { BattleResult } from '../data/types/BattleResult';

// --- World Phase FSM ---

export type WorldPhase =
  | 'player_actions'
  | 'ai_actions'
  | 'resolution'
  | 'battle_selection'
  | 'battle_active'
  | 'results'
  | 'advance';

// --- Battle Context (simplified for S-1) ---

export interface BattlePartyRef {
  factionId: string;
  armyId: string;
}

export interface BattleContext {
  id: string;
  type: 'siege' | 'field';
  territoryId: string | null;
  edgeId: string | null;
  attacker: BattlePartyRef;
  defender: BattlePartyRef;
  mode: 'manual' | 'auto';
  battleMapId: string;
  result?: BattleResult;
}

// --- World State ---

export interface WorldState {
  readonly turn: number;
  readonly day: number;                     // turn * 30
  readonly phase: WorldPhase;

  readonly factions: Record<string, FactionState>;
  readonly territories: Record<string, TerritoryState>;
  readonly armies: Record<string, ArmyState>;
  readonly generals: Record<string, GeneralState>;

  readonly diplomacy: DiplomacyState;
  readonly pendingBattles: BattleContext[];

  readonly playerFactionId: string;
  readonly protagonistId: string;

  readonly availableGenerals: GeneralState[];

  readonly stateHistory: WorldState[];
}

// --- Query Utilities ---

export const WorldStateQuery = {
  faction(state: WorldState, id: string): FactionState | undefined {
    return state.factions[id];
  },

  territory(state: WorldState, id: string): TerritoryState | undefined {
    return state.territories[id];
  },

  army(state: WorldState, id: string): ArmyState | undefined {
    return state.armies[id];
  },

  general(state: WorldState, id: string): GeneralState | undefined {
    return state.generals[id];
  },

  factionsAlive(state: WorldState): FactionState[] {
    return Object.values(state.factions).filter(f => f.alive);
  },

  armiesOfFaction(state: WorldState, factionId: string): ArmyState[] {
    return Object.values(state.armies).filter(a => a.factionId === factionId);
  },

  generalsOfFaction(state: WorldState, factionId: string): GeneralState[] {
    return Object.values(state.generals).filter(g => g.faction === factionId);
  },

  armiesAtNode(state: WorldState, nodeId: string): ArmyState[] {
    return Object.values(state.armies).filter(a => a.locationNodeId === nodeId);
  },

  isAtWar(state: WorldState, factionA: string, factionB: string): boolean {
    return state.diplomacy.relations[factionA]?.[factionB]?.status === 'war';
  },

  playerFaction(state: WorldState): FactionState | undefined {
    return state.factions[state.playerFactionId];
  },
};
