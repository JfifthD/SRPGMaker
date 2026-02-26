import type { Pos } from '@/engine/data/types/Map';
import type { ReachableTile } from './BFS';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { WorkerRequest, WorkerResponse, WorkerJobType } from './AStarWorker';
import terrainJson from '@/assets/data/terrains.json';
import type { TerrainKey, TerrainData } from '@/engine/data/types/Terrain';
import { getEquipmentBonuses } from '@/engine/systems/progression/EquipmentSystem';

// Import the worker as a URL using Vite's ?worker feature
import WorkerURL from './AStarWorker?worker&url';

/** Wraps state into serializable structures for the Web Worker */
export class PathfindingWorkerClient {
  private worker: Worker;
  private resolvers: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private jobId = 0;
  private premappedTerrain: Record<string, TerrainData> = {};

  constructor() {
    this.worker = new Worker(new URL(WorkerURL, import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
    
    // Build static terrain map once
    const tm: Record<string, TerrainData> = Object.fromEntries(
      (terrainJson as TerrainData[]).map(t => [t.key, t]),
    );
    this.premappedTerrain = tm;
  }

  private handleMessage(e: MessageEvent<WorkerResponse>) {
    const { id, type, reachable, path, error } = e.data;
    const promiseCtx = this.resolvers.get(id);
    if (!promiseCtx) return;
    
    this.resolvers.delete(id);

    if (error) {
      promiseCtx.reject(new Error(`Worker Failed [${type}]: ${error}`));
      return;
    }

    if (type === 'REACHABLE') {
      promiseCtx.resolve(reachable || []);
    } else if (type === 'FIND_PATH') {
       promiseCtx.resolve(path || null);
    }
  }

  private handleError(e: ErrorEvent) {
    console.error('Pathfinding Worker hit a fatal error:', e);
  }

  private buildContext(state: BattleState): Omit<WorkerRequest, 'id' | 'type' | 'unit'> {
    const terrainData: Record<string, TerrainData> = {};
    const unitMap: Record<string, 'ally' | 'enemy'> = {};

    // Flatten Terrain
    for (let y = 0; y < state.mapData.height; y++) {
      for (let x = 0; x < state.mapData.width; x++) {
        const key = state.mapData.terrain[y]?.[x] as TerrainKey ?? 'plain';
        terrainData[`${x},${y}`] = this.premappedTerrain[key]!;
      }
    }

    // Flatten Units
    for (const u of Object.values(state.units)) {
      if (u.hp > 0) {
        unitMap[`${u.x},${u.y}`] = u.team;
      }
    }

    return {
      mapWidth: state.mapData.width,
      mapHeight: state.mapData.height,
      terrainData,
      unitMap
    };
  }

  async getReachable(unit: UnitInstance, state: BattleState): Promise<ReachableTile[]> {
    const id = `job_${this.jobId++}`;

    // Compute equipment movement bonus and fold it into the movement budget.
    // The worker uses movBudget as maxCost so equipment-boosted tiles appear in results.
    // Zone A calculation in BattleCoordinator still uses unit.currentAP (actual AP), which
    // correctly classifies bonus-range tiles as Zone B (can move there, not enough AP to attack).
    const equipMap = state.gameProject.equipmentMap ?? {};
    const movBonus = getEquipmentBonuses(unit, equipMap).mov;
    const movBudget = movBonus > 0 ? unit.currentAP + movBonus : undefined;

    return new Promise((resolve, reject) => {
      this.resolvers.set(id, { resolve, reject });

      const req: WorkerRequest = {
        id,
        type: 'REACHABLE',
        unit,
        ...this.buildContext(state),
        ...(movBudget !== undefined ? { movBudget } : {}),
      };

      this.worker.postMessage(req);
    });
  }

  async getPath(start: Pos, goal: Pos, unit: UnitInstance, state: BattleState): Promise<Pos[] | null> {
    const id = `job_${this.jobId++}`;
    
    return new Promise((resolve, reject) => {
      this.resolvers.set(id, { resolve, reject });
      
      const req: WorkerRequest = {
        id,
        type: 'FIND_PATH',
        unit,
        startPos: start,
        goalPos: goal,
        ...this.buildContext(state)
      };
      
      this.worker.postMessage(req);
    });
  }
}

export const Pathworker = new PathfindingWorkerClient();
