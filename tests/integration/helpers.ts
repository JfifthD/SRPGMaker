// ─────────────────────────────────────────────
//  Integration Test Helpers
//  Build headless battle scenarios — no Phaser, no browser.
//  Use store.dispatch(action) to drive game logic programmatically.
// ─────────────────────────────────────────────

import { GameStore } from '@/engine/state/GameStore';
import type { MapData } from '@/engine/data/types/Map';
import type { GameProject } from '@/engine/data/types/GameProject';
import type { UnitData } from '@/engine/data/types/Unit';
import type { TerrainData } from '@/engine/data/types/Terrain';

// ── Shared terrain data ──────────────────────

export const PLAIN: TerrainData = {
  key: 'plain', name: 'Plain', tileIndex: 0,
  defBonus: 0, atkBonus: 0, moveCost: 1, passable: true,
};

export const FOREST: TerrainData = {
  key: 'forest', name: 'Forest', tileIndex: 1,
  defBonus: 1, atkBonus: 0, moveCost: 2, passable: true,
};

export const TEST_TERRAIN_MAP: Record<string, TerrainData> = {
  plain: PLAIN,
  forest: FOREST,
};

// ── Unit data factories ──────────────────────

/**
 * Build a minimal UnitData suitable for integration tests.
 * Defaults: phys affinity, atk=8, def=5, spd=6, hp=20, maxAP=5.
 */
export function makeUnitData(
  id: string,
  team: 'ally' | 'enemy',
  overrides: Partial<UnitData> = {},
): UnitData {
  return {
    id,
    name: id,
    job: 'soldier',
    affinity: 'phys' as any,
    baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 5 },
    growthRates: { hp: 50, atk: 40, def: 40, spd: 40, skl: 40, mp: 30 },
    maxMp: 10,
    skills: [],
    spriteKey: 'unit',
    atkRange: 1,
    team,
    passiveEffects: [],
    ...overrides,
  };
}

// ── Map factory ──────────────────────────────

export interface SpawnConfig {
  data: UnitData;
  x: number;
  y: number;
}

/**
 * Build a MapData for integration tests.
 * All terrain is 'plain' by default unless terrainGrid is provided.
 */
export function makeTestMap(
  allySpawns: SpawnConfig[],
  enemySpawns: SpawnConfig[],
  width = 8,
  height = 8,
  winType: 'defeat_all' | 'defeat_target' = 'defeat_all',
  terrainGrid?: string[][],
): MapData {
  const terrain = terrainGrid ??
    Array.from({ length: height }, () => Array(width).fill('plain') as string[]);

  return {
    id: 'integration_test_map',
    name: 'Integration Test Map',
    width,
    height,
    terrain: terrain as any,
    allySpawns: allySpawns.map(s => ({ unitDataId: s.data.id, x: s.x, y: s.y })),
    enemySpawns: enemySpawns.map(s => ({ unitDataId: s.data.id, x: s.x, y: s.y })),
    winConditions: [{ type: winType }],
    lossConditions: [{ type: 'all_allies_dead' }],
  };
}

// ── GameProject factory ──────────────────────

/** Build a minimal GameProject for integration tests. */
export function makeTestProject(units: UnitData[]): GameProject {
  return {
    manifest: {
      id: 'integration-test',
      name: 'Integration Test Game',
      version: '0.0.1',
      engineVersion: '>=0.1.0',
      entryMap: 'integration_test_map',
      data: { units: '', skills: '', terrains: '', mapsDir: '' },
    },
    units,
    skillsMap: {},
    terrainMap: TEST_TERRAIN_MAP,
    equipmentMap: {},
    jobsMap: {},
    audioConfig: null,
    worldMap: null,
    factionsData: null,
    generalsData: null,
    diplomacyData: null,
  };
}

// ── Store builder ────────────────────────────

/**
 * Create and initialize a GameStore with the given ally/enemy scenario.
 * Returns the store and a lookup of unit IDs by spawn order.
 *
 * Ally instanceIds:   same as data.id
 * Enemy instanceIds:  `${data.id}_${index}`
 */
export function buildStore(
  allySpawns: SpawnConfig[],
  enemySpawns: SpawnConfig[],
  options?: { terrainGrid?: string[][] },
): { store: GameStore; allyIds: string[]; enemyIds: string[] } {
  const allUnits = [...allySpawns.map(s => s.data), ...enemySpawns.map(s => s.data)];
  const project = makeTestProject(allUnits);
  const mapData = makeTestMap(allySpawns, enemySpawns, 8, 8, 'defeat_all', options?.terrainGrid);

  const store = new GameStore();
  store.init(mapData, project);

  const allyIds = allySpawns.map(s => s.data.id);
  const enemyIds = enemySpawns.map((s, i) => `${s.data.id}_${i}`);

  return { store, allyIds, enemyIds };
}

/**
 * Advance the store until a specific unit (or any unit of the given team) has their turn.
 * Returns the number of nextTurn() calls made.
 */
export function advanceTurnUntil(
  store: GameStore,
  predicate: (state: ReturnType<GameStore['getState']>) => boolean,
  maxIterations = 50,
): number {
  let iter = 0;
  while (!predicate(store.getState()) && iter < maxIterations) {
    store.nextTurn();
    iter++;
  }
  return iter;
}
