// ─────────────────────────────────────────────
//  Map / Stage Types
// ─────────────────────────────────────────────

import type { TerrainKey } from './Terrain';

export interface Pos {
  x: number;
  y: number;
}

export interface UnitSpawn {
  unitDataId: string;
  x: number;
  y: number;
}

// ── Stage Condition Types (discriminated union) ────────────────────

/** All supported condition types for win AND loss rules */
export type ConditionType =
  | 'defeat_all'           // Win: all enemies dead
  | 'defeat_target'        // Win: specific unit(s) killed
  | 'all_allies_dead'      // Lose: all player units dead
  | 'protect_target'       // Lose: a specific unit dies
  | 'reach_tile'           // Win: unit arrives at (x,y)
  | 'survive_turns'        // Win: survive N turns
  | 'turn_limit';          // Lose: N turns elapsed without winning

export interface StageCondition {
  type: ConditionType;
  /** For defeat_target / protect_target */
  targetUnitId?: string;
  /** For reach_tile */
  x?: number;
  y?: number;
  /** Which unit must reach the tile. 'any_ally' = any living ally unit */
  reachUnitId?: string;
  /** For survive_turns / turn_limit */
  turns?: number;
}

// ── Legacy aliases (deprecated, kept for backward compat) ─────────

/** @deprecated Use StageCondition in winConditions[] instead */
export type VictoryCondition = StageCondition;

/** @deprecated Use StageCondition in lossConditions[] instead */
export type DefeatCondition = StageCondition;

// ── MapData ───────────────────────────────────────────────────────

export interface MapData {
  id: string;
  name: string;
  /** Map dimensions */
  width: number;
  height: number;
  /**
   * 2D grid [y][x] of TerrainKey strings.
   * Row 0 = top row.
   */
  terrain: TerrainKey[][];
  /**
   * 2D grid [y][x] of elevation integers. Higher values = higher ground.
   * Row 0 = top row. If not present, elevation defaults to 0.
   */
  elevation?: number[][];
  allySpawns: UnitSpawn[];
  enemySpawns: UnitSpawn[];

  /**
   * Win conditions — evaluated as OR (any one met = VICTORY).
   * If omitted, defaults to [{ type: 'defeat_all' }].
   */
  winConditions?: StageCondition[];

  /**
   * Loss conditions — evaluated as OR (any one met = DEFEAT).
   * If omitted, defaults to [{ type: 'all_allies_dead' }].
   */
  lossConditions?: StageCondition[];

  // ── Legacy fields (deprecated but still read for backward compat) ──

  /** @deprecated Use winConditions[] */
  victoryCondition?: VictoryCondition;
  /** @deprecated Use lossConditions[] */
  defeatCondition?: DefeatCondition;

  /** Phaser tilemap key (for Tiled-based maps) */
  tilemapKey?: string;
}

