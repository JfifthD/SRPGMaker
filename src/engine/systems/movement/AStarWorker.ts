// ─────────────────────────────────────────────
//  AStarWorker — Web Worker for Pathfinding
//  Runs BFS and A* off the main thread to prevent UI freezing
// ─────────────────────────────────────────────

import type { Pos } from '@/engine/data/types/Map';
import type { TerrainData } from '@/engine/data/types/Terrain';
import type { ReachableTile } from './BFS';

export type WorkerJobType = 'REACHABLE' | 'FIND_PATH';

export interface WorkerRequest {
  id: string; // Job ID to match callbacks
  type: WorkerJobType;
  unit: any; // Serialised UnitInstance
  
  // Flattened Context
  mapWidth: number;
  mapHeight: number;
  terrainData: Record<string, TerrainData>; // Pre-mapped TerrainData lookup via y,x string
  unitMap: Record<string, 'ally' | 'enemy'>; // Pre-mapped Occupancy map

  // Extra config for path finding
  startPos?: Pos;
  goalPos?: Pos;
}

export interface WorkerResponse {
  id: string;
  type: WorkerJobType;
  reachable?: ReachableTile[];
  path?: Pos[] | null;
  error?: string;
}

// Minimal DIRS logic for Worker
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'REACHABLE') {
      const reachable = calcReachable(req);
      self.postMessage({ id: req.id, type: req.type, reachable } as WorkerResponse);
    } else if (req.type === 'FIND_PATH') {
      const path = calcAStar(req);
      self.postMessage({ id: req.id, type: req.type, path } as WorkerResponse);
    }
  } catch (error: any) {
    self.postMessage({ id: req.id, type: req.type, error: error.message } as WorkerResponse);
  }
};

function calcReachable(req: WorkerRequest): ReachableTile[] {
  const { unit, mapWidth, mapHeight, terrainData, unitMap } = req;
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

      if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;

      const tKey = `${nx},${ny}`;
      const terrain = terrainData[tKey];
      if (!terrain || !terrain.passable) continue;

      const newCost = current.cost + terrain.moveCost;
      if (newCost > maxCost) continue;

      if (visited.has(tKey) && visited.get(tKey)! <= newCost) continue;

      // Can pass through allies but not enemies
      const occupierTeam = unitMap[tKey];
      if (occupierTeam && occupierTeam !== unit.team) continue;

      visited.set(tKey, newCost);
      queue.push({ x: nx, y: ny, cost: newCost, parent: current });
    }
  }

  return result;
}

function calcAStar(req: WorkerRequest): Pos[] | null {
  const { startPos, goalPos, unit, mapWidth, mapHeight, terrainData, unitMap } = req;
  if (!startPos || !goalPos) return null;

  const key = (p: Pos): string => `${p.x},${p.y}`;
  const h = (p: Pos): number => Math.abs(p.x - goalPos.x) + Math.abs(p.y - goalPos.y);

  const open = new Map<string, { pos: Pos; g: number; f: number }>();
  const cameFrom = new Map<string, Pos>();
  const gScore = new Map<string, number>();

  const startKey = key(startPos);
  open.set(startKey, { pos: startPos, g: 0, f: h(startPos) });
  gScore.set(startKey, 0);

  while (open.size > 0) {
    let current: { pos: Pos; g: number; f: number } | undefined;
    let minF = Infinity;
    for (const v of open.values()) {
      if (v.f < minF) { minF = v.f; current = v; }
    }
    if (!current) break;

    if (current.pos.x === goalPos.x && current.pos.y === goalPos.y) {
      const path: Pos[] = [];
      let c: Pos = goalPos;
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
      
      if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
      
      const tKey = key({x: nx, y: ny});
      const terrain = terrainData[tKey];
      if (!terrain || !terrain.passable) continue;
      
      const occupierTeam = unitMap[tKey];
      if (occupierTeam && occupierTeam !== unit.team && !(nx === goalPos.x && ny === goalPos.y)) continue;

      const neighbor: Pos = { x: nx, y: ny };
      const tentativeG = (gScore.get(key(current.pos)) ?? Infinity) + terrain.moveCost;
      if (tentativeG < (gScore.get(tKey) ?? Infinity)) {
        cameFrom.set(tKey, current.pos);
        gScore.set(tKey, tentativeG);
        open.set(tKey, { pos: neighbor, g: tentativeG, f: tentativeG + h(neighbor) });
      }
    }
  }
  return null;
}
