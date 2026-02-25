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

export interface VictoryCondition {
  type: 'defeat_all' | 'seize_point' | 'survive_turns';
  /** For seize_point: target tile */
  target?: Pos;
  /** For survive_turns: number of turns */
  turns?: number;
}

export interface DefeatCondition {
  type: 'all_allies_dead' | 'key_unit_dead';
  /** Unit instanceId that must survive */
  keyUnitId?: string;
}

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
  victoryCondition: VictoryCondition;
  defeatCondition: DefeatCondition;
  /** Phaser tilemap key (for Tiled-based maps) */
  tilemapKey?: string;
}
