// ─────────────────────────────────────────────
//  BFS — Movement Range Calculator
//  Returns all tiles reachable within unit's SPD.
// ─────────────────────────────────────────────

import type { Pos } from '@/engine/data/types/Map';
import type { TerrainData } from '@/engine/data/types/Terrain';
import type { UnitInstance } from '@/engine/data/types/Unit';

export interface BFSContext {
  /** Grid dimensions */
  width: number;
  height: number;
  /** Get terrain at (x, y) */
  getTerrain(x: number, y: number): TerrainData;
  /** Get the unit occupying (x, y) if any */
  getUnit(x: number, y: number): UnitInstance | undefined;
}

export interface ReachableTile extends Pos {
  cost: number;
  /** Link back to the node we came from to reconstruct paths */
  parent?: ReachableTile;
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const BFS = {
  /**
   * Returns all tiles the unit can reach this turn.
   * Allied units can pass through (but not end on occupied tiles).
   */
  reachable(unit: UnitInstance, ctx: BFSContext): ReachableTile[] {
    const maxCost = unit.currentAP;
    const visited = new Map<string, number>();
    const queue: ReachableTile[] = [{ x: unit.x, y: unit.y, cost: 0 }];
    const result: ReachableTile[] = [];
    visited.set(`${unit.x},${unit.y}`, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const [dx, dy] of DIRS) {
        const nx = current.x + dx;
        const ny = current.y + dy;

        if (nx < 0 || nx >= ctx.width || ny < 0 || ny >= ctx.height) continue;

        const terrain = ctx.getTerrain(nx, ny);
        if (!terrain.passable) continue;

        const newCost = current.cost + terrain.moveCost;
        if (newCost > maxCost) continue;

        const key = `${nx},${ny}`;
        if (visited.has(key) && visited.get(key)! <= newCost) continue;

        // Can pass through allies but not enemies
        const occ = ctx.getUnit(nx, ny);
        if (occ && occ.team !== unit.team) continue;

        visited.set(key, newCost);
        queue.push({ x: nx, y: ny, cost: newCost, parent: current });
      }
    }

    return result;
  },

  /**
   * Reconstructs the exact path from start to a reachable tile.
   */
  reconstructPath(dest: ReachableTile): Pos[] {
    const path: Pos[] = [];
    let current: ReachableTile | undefined = dest;
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path;
  },

  /**
   * A* pathfinding — returns the shortest path from start to goal
   * or null if unreachable.
   */
  findPath(
    start: Pos,
    goal: Pos,
    unit: UnitInstance,
    ctx: BFSContext,
  ): Pos[] | null {
    const key = (p: Pos): string => `${p.x},${p.y}`;
    const h = (p: Pos): number => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);

    const open = new Map<string, { pos: Pos; g: number; f: number }>();
    const cameFrom = new Map<string, Pos>();
    const gScore = new Map<string, number>();

    const startKey = key(start);
    open.set(startKey, { pos: start, g: 0, f: h(start) });
    gScore.set(startKey, 0);

    while (open.size > 0) {
      // Pick node with lowest f score
      let current: { pos: Pos; g: number; f: number } | undefined;
      let minF = Infinity;
      for (const v of open.values()) {
        if (v.f < minF) { minF = v.f; current = v; }
      }
      if (!current) break;

      if (current.pos.x === goal.x && current.pos.y === goal.y) {
        // Reconstruct path
        const path: Pos[] = [];
        let c: Pos = goal;
        while (key(c) !== startKey) {
          path.unshift(c);
          c = cameFrom.get(key(c))!;
        }
        return path;
      }

      open.delete(key(current.pos));

      for (const [dx, dy] of DIRS) {
        const nx = current.pos.x + dx;
        const ny = current.pos.y + dy;
        if (nx < 0 || nx >= ctx.width || ny < 0 || ny >= ctx.height) continue;
        const terrain = ctx.getTerrain(nx, ny);
        if (!terrain.passable) continue;
        const occ = ctx.getUnit(nx, ny);
        if (occ && occ.team !== unit.team && !(nx === goal.x && ny === goal.y)) continue;

        const neighbor: Pos = { x: nx, y: ny };
        const nKey = key(neighbor);
        const tentativeG = (gScore.get(key(current.pos)) ?? Infinity) + terrain.moveCost;
        if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
          cameFrom.set(nKey, current.pos);
          gScore.set(nKey, tentativeG);
          open.set(nKey, { pos: neighbor, g: tentativeG, f: tentativeG + h(neighbor) });
        }
      }
    }
    return null;
  },
};
