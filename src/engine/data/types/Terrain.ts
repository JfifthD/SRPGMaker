// ─────────────────────────────────────────────
//  Terrain Types
// ─────────────────────────────────────────────

import type { EffectNode } from './EffectNode';

/** Built-in terrain keys. Games can define additional keys via string. */
export type TerrainKey = 'plain' | 'forest' | 'mountain' | 'water' | 'wall' | 'ruins'
  | 'burning_forest' | 'frozen_water' | (string & {});

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
  /** Semantic tags for this terrain (e.g. "Forest", "Water", "Fire") */
  tags?: string[];
  /** Reactive Effect Nodes — trigger on hit, entry, etc. */
  reactions?: EffectNode[];
}

