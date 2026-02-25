// ─────────────────────────────────────────────
//  Danger Zone Calculator
//  Computes the union of all enemy (move + attack) ranges.
//  Pure logic — no Phaser dependency.
// ─────────────────────────────────────────────

import type { BattleState } from '@/engine/state/BattleState';
import type { BFSContext } from './BFS';
import { BFS } from './BFS';

/**
 * Build a set of "x,y" tile keys representing all tiles
 * that at least one enemy can reach AND attack from.
 * Uses maxAP (not currentAP) to show the worst-case threat range.
 */
export function buildDangerZone(state: BattleState, ctx: BFSContext): Set<string> {
  const dangerTiles = new Set<string>();
  const enemies = Object.values(state.units).filter(u => u.hp > 0 && u.team === 'enemy');

  for (const enemy of enemies) {
    // Use maxAP (full potential) instead of currentAP for threat calculation
    const shadow = { ...enemy, currentAP: enemy.maxAP };
    const reachable = BFS.reachable(shadow, ctx);

    for (const tile of reachable) {
      // From each reachable tile, compute the attack range (Manhattan distance)
      const atkRange = enemy.atkRange;
      for (let dx = -atkRange; dx <= atkRange; dx++) {
        const maxDy = atkRange - Math.abs(dx);
        for (let dy = -maxDy; dy <= maxDy; dy++) {
          const ax = tile.x + dx;
          const ay = tile.y + dy;
          if (ax >= 0 && ax < ctx.width && ay >= 0 && ay < ctx.height) {
            dangerTiles.add(`${ax},${ay}`);
          }
        }
      }
    }
  }

  return dangerTiles;
}

