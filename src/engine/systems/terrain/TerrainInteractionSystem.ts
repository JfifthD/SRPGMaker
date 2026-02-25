// ─────────────────────────────────────────────
//  Terrain Interaction System
//  Handles reactive terrain effects (e.g. burning forest)
//  using the Effect Node System.
//  Pure logic — no Phaser dependency.
// ─────────────────────────────────────────────

import type { BattleState } from '@/engine/state/BattleState';
import type { TerrainData, TerrainKey } from '@/engine/data/types/Terrain';
import type { EffectContext, EffectResult } from '@/engine/data/types/EffectNode';
import { evaluate } from '@/engine/systems/effectnode/EffectNodeRunner';
import { produce } from 'immer';
import { EventBus } from '@/engine/utils/EventBus';

/**
 * Terrain registry — maps TerrainKey to TerrainData.
 * Loaded from game project's terrains.json at startup.
 */
let terrainRegistry: Record<string, TerrainData> = {};

/**
 * Initialize the terrain registry from game data.
 * Called once during game project loading.
 */
export function initTerrainRegistry(terrains: TerrainData[]): void {
  terrainRegistry = {};
  for (const t of terrains) {
    terrainRegistry[t.key] = t;
  }
}

/**
 * Get terrain data by key from the registry.
 */
export function getTerrainData(key: TerrainKey): TerrainData | undefined {
  return terrainRegistry[key];
}

/**
 * Evaluate terrain reactions when a skill hits a tile.
 * Returns a new BattleState if terrain was transformed, or the same state if not.
 *
 * @param state - Current battle state
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @param skillTags - Tags on the skill that hit this tile (e.g. ["Fire"])
 * @param casterId - The unit that cast the skill
 */
export function onSkillHitTile(
  state: BattleState,
  x: number,
  y: number,
  skillTags: string[],
  casterId: string,
): BattleState {
  const terrainKey = state.mapData.terrain[y]?.[x];
  if (!terrainKey) return state;

  const terrainData = getTerrainData(terrainKey);
  if (!terrainData || !terrainData.reactions || terrainData.reactions.length === 0) {
    return state;
  }

  const ctx: EffectContext = {
    ownerId: `terrain_${x}_${y}`,
    triggeringEntityId: casterId,
    currentTrigger: 'OnHitByTag',
    tags: skillTags,
    position: { x, y },
  };

  const results = evaluate(terrainData.reactions, 'OnHitByTag', ctx, state);

  let newState = state;

  for (const result of results) {
    if (result.payload.transformTerrainTo) {
      const newTerrainKey = result.payload.transformTerrainTo as TerrainKey;
      newState = produce(newState, draft => {
        if (draft.mapData.terrain[y]) {
          draft.mapData.terrain[y][x] = newTerrainKey;
        }
      });

      EventBus.emit('terrainChanged', {
        x,
        y,
        from: terrainKey,
        to: newTerrainKey,
      });
    }
  }

  return newState;
}

/**
 * Evaluate terrain effects when a unit enters a tile.
 * Returns effect results for the terrain at the given position.
 */
export function onUnitEnterTile(
  state: BattleState,
  unitId: string,
  x: number,
  y: number,
): EffectResult[] {
  const terrainKey = state.mapData.terrain[y]?.[x];
  if (!terrainKey) return [];

  const terrainData = getTerrainData(terrainKey);
  if (!terrainData || !terrainData.reactions || terrainData.reactions.length === 0) {
    return [];
  }

  const ctx: EffectContext = {
    ownerId: `terrain_${x}_${y}`,
    triggeringEntityId: unitId,
    currentTrigger: 'OnMoveEnter',
    position: { x, y },
  };

  return evaluate(terrainData.reactions, 'OnMoveEnter', ctx, state);
}
