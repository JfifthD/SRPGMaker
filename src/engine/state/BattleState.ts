// ─────────────────────────────────────────────
//  Battle State — Immutable snapshot of all game state
// ─────────────────────────────────────────────

import type { UnitInstance } from '@/engine/data/types/Unit';
import type { MapData } from '@/engine/data/types/Map';
import type { BattlePhase } from '@/engine/systems/turn/TurnManager';

/** A record of all units by instanceId for O(1) lookup */
export type UnitMap = Record<string, UnitInstance>;

export interface BattleState {
  readonly mapData: MapData;

  /** All units (allies + enemies) keyed by instanceId */
  readonly units: UnitMap;

  readonly turn: number;
  readonly phase: BattlePhase;

  /** Currently selected unit's instanceId, or null */
  readonly selectedUnitId: string | null;

  /** The unit whose turn it currently is */
  readonly activeUnitId: string | null;

  /** UI interaction mode */
  readonly inputMode: InputMode;

  /** Active skill the player has selected for casting */
  readonly activeSkillId: string | null;

  /** Whether an animation is currently playing (blocks input) */
  readonly busy: boolean;

  /** Action history for potential undo support */
  readonly actionLog: string[];

  /** Immutable history of previous states for perfect Undo/Rewind */
  readonly stateHistory: BattleState[];
}

export type InputMode = 'idle' | 'move' | 'skill' | 'attack' | 'facing';

/** Utility helpers for querying BattleState */
export const StateQuery = {
  allies(state: BattleState): UnitInstance[] {
    return Object.values(state.units).filter(u => u.team === 'ally');
  },

  enemies(state: BattleState): UnitInstance[] {
    return Object.values(state.units).filter(u => u.team === 'enemy');
  },

  liveAllies(state: BattleState): UnitInstance[] {
    return StateQuery.allies(state).filter(u => u.hp > 0);
  },

  liveEnemies(state: BattleState): UnitInstance[] {
    return StateQuery.enemies(state).filter(u => u.hp > 0);
  },

  at(state: BattleState, x: number, y: number): UnitInstance | undefined {
    return Object.values(state.units).find(u => u.hp > 0 && u.x === x && u.y === y);
  },

  unit(state: BattleState, id: string): UnitInstance | undefined {
    return state.units[id];
  },

  terrain(state: BattleState, x: number, y: number) {
    return state.mapData.terrain[y]?.[x] ?? 'plain';
  },
};
