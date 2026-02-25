// ─────────────────────────────────────────────
//  Terrain Types
// ─────────────────────────────────────────────

export type TerrainKey = 'plain' | 'forest' | 'mountain' | 'water' | 'wall' | 'ruins';

export interface TerrainData {
  key: TerrainKey;
  name: string;
  /** Phaser tile index or tileset frame */
  tileIndex: number;
  /** DEF bonus when standing on this tile */
  defBonus: number;
  /** ATK bonus when standing on this tile */
  atkBonus: number;
  /** Movement cost (99 = impassable) */
  moveCost: number;
  /** Whether any unit can stand here */
  passable: boolean;
}
