import type { Pos } from '@/engine/data/types/Map';

export const MathUtils = {
  /** Manhattan distance */
  dist(a: Pos, b: Pos): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  },

  /** Clamp a value between min and max */
  clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  },

  /** Random integer in [min, max] inclusive */
  randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /** Random float in [0, 1) */
  rand(): number {
    return Math.random();
  },

  /** Linear interpolation */
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  /** Determines the compass direction pointing from -> to */
  getHitDirection(fromX: number, fromY: number, toX: number, toY: number): 'N' | 'E' | 'S' | 'W' {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'E' : 'W';
    } else {
      return dy > 0 ? 'S' : 'N';
    }
  },

  /** Determines whether an attack hits the front, side, or back based on defender's facing */
  getHitAngle(fromX: number, fromY: number, toX: number, toY: number, defenderFacing: 'N'|'E'|'S'|'W'): 'FRONT' | 'SIDE' | 'BACK' {
    const attackDir = this.getHitDirection(fromX, fromY, toX, toY);
    const oppStr: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E' };
    
    // Attacker moving East hits the West side of the target.
    // If the target is facing West, they meet face-to-face (FRONT).
    if (defenderFacing === oppStr[attackDir]) return 'FRONT';
    
    // If target is facing East, they are hit in the back (BACK).
    if (defenderFacing === attackDir) return 'BACK';

    // Otherwise it's from the side (SIDE).
    return 'SIDE';
  },
};
