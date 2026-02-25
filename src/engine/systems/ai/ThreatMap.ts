// ─────────────────────────────────────────────
//  Threat Map — per-tile danger score for AI
// ─────────────────────────────────────────────

import type { BattleState } from '@/engine/state/BattleState';
import { StateQuery } from '@/engine/state/BattleState';
import { DamageCalc } from '@/engine/systems/combat/DamageCalc';
import { RangeCalc } from '@/engine/systems/movement/RangeCalc';
import type { TerrainData } from '@/engine/data/types/Terrain';
import terrainJson from '@/assets/data/terrains.json';
import type { TerrainKey } from '@/engine/data/types/Terrain';

const TERRAIN_MAP: Record<string, TerrainData> = Object.fromEntries(
  (terrainJson as TerrainData[]).map(t => [t.key, t]),
);
const DEFAULT_TERRAIN = TERRAIN_MAP['plain']!;

export type ThreatGrid = number[][];

export const ThreatMapCalc = {
  /**
   * Build a grid[y][x] of threat scores for the given unit.
   * Score = max potential damage any enemy can deal on that tile.
   */
  build(state: BattleState, forUnit: { team: 'ally' | 'enemy' }): ThreatGrid {
    const { width, height } = state.mapData;
    const grid: ThreatGrid = Array.from({ length: height }, () => new Array(width).fill(0));

    const enemies = forUnit.team === 'ally'
      ? StateQuery.liveEnemies(state)
      : StateQuery.liveAllies(state);

    for (const enemy of enemies) {
      // Collect all attackable positions (attack range tiles)
      const atkRange = enemy.atkRange;
      const rangeTiles = RangeCalc.skillRange(
        { x: enemy.x, y: enemy.y },
        { range: atkRange, aoe: false } as never,
        width, height,
      );

      for (const tile of rangeTiles) {
        const atkTerrain = TERRAIN_MAP[state.mapData.terrain[enemy.y]?.[enemy.x] as TerrainKey] ?? DEFAULT_TERRAIN;
        const defTerrain = TERRAIN_MAP[state.mapData.terrain[tile.y]?.[tile.x] as TerrainKey] ?? DEFAULT_TERRAIN;

        // Estimate damage as if a generic unit stands there
        const preview = DamageCalc.preview(
          enemy as never,
          { atk: 0, def: 0, affinity: 'phys', hp: 1, maxHp: 1, skl: 10 } as never,
          { mult: 1.0, type: 'phys' },
          atkTerrain,
          defTerrain,
        );

        if (grid[tile.y]?.[tile.x] !== undefined) {
          grid[tile.y]![tile.x] = Math.max(grid[tile.y]![tile.x]!, preview.baseDmg);
        }
      }
    }

    return grid;
  },

  threatAt(grid: ThreatGrid, x: number, y: number): number {
    return grid[y]?.[x] ?? 0;
  },
};
