import type { Pos } from '@/engine/data/types/Map';
import type { SkillData } from '@/engine/data/types/Skill';

export const RangeCalc = {
  /**
   * Returns all tiles within Manhattan-distance `range` from the unit's position.
   * If range === 0, returns just the unit's own tile (self-cast).
   */
  skillRange(origin: Pos, sk: SkillData, width: number, height: number): Pos[] {
    if (sk.range === 0) return [{ x: origin.x, y: origin.y }];
    const tiles: Pos[] = [];
    for (let dx = -sk.range; dx <= sk.range; dx++) {
      for (
        let dy = -(sk.range - Math.abs(dx));
        dy <= sk.range - Math.abs(dx);
        dy++
      ) {
        const nx = origin.x + dx;
        const ny = origin.y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          tiles.push({ x: nx, y: ny });
        }
      }
    }
    return tiles;
  },

  /**
   * Returns all tiles within `radius` of a centre (for AOE impact).
   */
  aoeArea(centre: Pos, radius: number, width: number, height: number): Pos[] {
    if (radius === 0) return [centre];
    const tiles: Pos[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (
        let dy = -(radius - Math.abs(dx));
        dy <= radius - Math.abs(dx);
        dy++
      ) {
        const nx = centre.x + dx;
        const ny = centre.y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          tiles.push({ x: nx, y: ny });
        }
      }
    }
    return tiles;
  },
};
