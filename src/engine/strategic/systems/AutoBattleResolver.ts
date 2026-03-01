// ─────────────────────────────────────────────
//  Auto-Battle Resolver — Headless tactical battle simulation
//  Runs a complete SRPG battle without Phaser, using BFS for pathfinding.
//  Returns GeneralBattleResult[] for CasualtySystem.
//  Zero Phaser imports.
// ─────────────────────────────────────────────

import type { BattleState } from '@/engine/state/BattleState';
import { StateQuery } from '@/engine/state/BattleState';
import type { GameProject } from '@/engine/data/types/GameProject';
import type { MapData, Pos } from '@/engine/data/types/Map';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { createUnit } from '@/engine/data/types/Unit';
import { GameStore } from '@/engine/state/GameStore';
import { BFS } from '@/engine/systems/movement/BFS';
import type { BFSContext } from '@/engine/systems/movement/BFS';
import type { GameAction } from '@/engine/state/actions/MoveAction';
import { MoveAction } from '@/engine/state/actions/MoveAction';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { WaitAction } from '@/engine/state/actions/WaitAction';
import type { GeneralBattleResult } from '../data/types/BattleResult';
import type { BattleMapBuildResult } from './BattleMapBuilder';

/** Maximum turns before auto-battle ends in a draw (defender wins). */
const MAX_TURNS = 200;

export interface AutoBattleResult {
  victory: boolean;  // true if attacker (ally side) wins
  turns: number;
  generalResults: GeneralBattleResult[];
}

export const AutoBattleResolver = {
  /**
   * Run a headless auto-battle.
   * Both sides are controlled by a simplified AI using synchronous BFS.
   * Returns results without any rendering or Phaser dependency.
   */
  resolve(
    buildResult: BattleMapBuildResult,
    gameProject: GameProject,
  ): AutoBattleResult {
    const { mapData, allyGeneralIds, enemyGeneralIds, allyCommanderBuff, enemyCommanderBuff } = buildResult;

    // Create a separate GameStore instance (not the global singleton)
    const battleStore = new GameStore();
    battleStore.init(mapData, gameProject);

    // Apply commander buffs
    AutoBattleResolver.applyCommanderBuff(battleStore, 'ally', allyCommanderBuff);
    AutoBattleResolver.applyCommanderBuff(battleStore, 'enemy', enemyCommanderBuff);

    // Run the battle loop
    let turnCount = 0;

    while (turnCount < MAX_TURNS) {
      const state = battleStore.getState();
      if (state.phase === 'VICTORY' || state.phase === 'DEFEAT') break;

      // Advance to next unit's turn
      battleStore.nextTurn();
      turnCount++;

      const postState = battleStore.getState();
      if (postState.phase === 'VICTORY' || postState.phase === 'DEFEAT') break;

      const activeId = postState.activeUnitId;
      if (!activeId) continue;

      const activeUnit = postState.units[activeId];
      if (!activeUnit || activeUnit.hp <= 0) continue;

      // Both sides use the simplified headless AI
      const actions = AutoBattleResolver.decideHeadless(activeUnit, postState);
      for (const action of actions) {
        battleStore.dispatch(action);
        // Check if battle ended after each action
        if (battleStore.getState().phase === 'VICTORY' || battleStore.getState().phase === 'DEFEAT') break;
      }
    }

    // Extract results
    const finalState = battleStore.getState();
    const victory = finalState.phase === 'VICTORY';
    const generalResults = AutoBattleResolver.extractGeneralResults(
      finalState,
      allyGeneralIds,
      enemyGeneralIds,
    );

    return { victory, turns: turnCount, generalResults };
  },

  /**
   * Simplified synchronous AI for headless battles.
   * Uses BFS directly (no Web Worker dependency).
   */
  decideHeadless(unit: UnitInstance, state: BattleState): GameAction[] {
    const enemies = unit.team === 'ally' ? StateQuery.liveEnemies(state) : StateQuery.liveAllies(state);
    if (enemies.length === 0) return [new WaitAction(unit.instanceId)];

    // Find nearest enemy
    const nearest = enemies.reduce((a, b) => {
      const da = Math.abs(unit.x - a.x) + Math.abs(unit.y - a.y);
      const db = Math.abs(unit.x - b.x) + Math.abs(unit.y - b.y);
      return da <= db ? a : b;
    });

    const dist = Math.abs(unit.x - nearest.x) + Math.abs(unit.y - nearest.y);

    // If in attack range, attack immediately
    if (dist <= unit.atkRange) {
      return [new AttackAction(unit.instanceId, nearest.instanceId)];
    }

    // Move toward nearest enemy using synchronous BFS
    const ctx = AutoBattleResolver.buildBFSContext(state);
    const reachable = BFS.reachable(unit, ctx);

    // Find reachable tile closest to the nearest enemy
    let bestTile: Pos | null = null;
    let bestDist = Infinity;

    for (const tile of reachable) {
      // Skip if occupied by another unit
      const occ = StateQuery.at(state, tile.x, tile.y);
      if (occ && occ.instanceId !== unit.instanceId) continue;

      const d = Math.abs(tile.x - nearest.x) + Math.abs(tile.y - nearest.y);
      if (d < bestDist) {
        bestDist = d;
        bestTile = tile;
      }
    }

    const actions: GameAction[] = [];

    if (bestTile && (bestTile.x !== unit.x || bestTile.y !== unit.y)) {
      actions.push(new MoveAction(unit.instanceId, bestTile));

      // After moving, check if we can attack
      if (bestDist <= unit.atkRange) {
        actions.push(new AttackAction(unit.instanceId, nearest.instanceId));
      }
    }

    if (actions.length === 0) {
      actions.push(new WaitAction(unit.instanceId));
    }

    return actions;
  },

  /**
   * Build a BFSContext from BattleState for synchronous pathfinding.
   */
  buildBFSContext(state: BattleState): BFSContext {
    const terrainMap = state.gameProject.terrainMap;
    const defaultTerrain = terrainMap['plain'];

    return {
      width: state.mapData.width,
      height: state.mapData.height,
      getTerrain: (x: number, y: number) => {
        const key = state.mapData.terrain[y]?.[x] ?? 'plain';
        return terrainMap[key] ?? defaultTerrain ?? { moveCost: 1, passable: true } as any;
      },
      getUnit: (x: number, y: number) => StateQuery.at(state, x, y),
    };
  },

  /**
   * Apply commander buff: increase atk/def/spd of all units on a team.
   */
  applyCommanderBuff(
    store: GameStore,
    team: 'ally' | 'enemy',
    buffPercent: number,
  ): void {
    if (buffPercent <= 0) return;

    const state = store.getState();
    const multiplier = 1 + buffPercent / 100;

    // Use dispatchAsync with recipe to modify unit stats
    store.dispatchAsync(null, draft => {
      for (const unit of Object.values(draft.units)) {
        if (unit.team !== team) continue;
        unit.atk = Math.floor(unit.atk * multiplier);
        unit.def = Math.floor(unit.def * multiplier);
        unit.spd = Math.floor(unit.spd * multiplier);
      }
    });
  },

  /**
   * Extract GeneralBattleResult[] from final BattleState.
   * Maps allySpawns → allyGeneralIds, enemySpawns → enemyGeneralIds.
   */
  extractGeneralResults(
    state: BattleState,
    allyGeneralIds: string[],
    enemyGeneralIds: string[],
  ): GeneralBattleResult[] {
    const results: GeneralBattleResult[] = [];
    const allUnits = Object.values(state.units);

    // Ally side: original spawn order maps to general IDs
    const allyUnits = allUnits.filter(u => u.team === 'ally');
    for (let i = 0; i < allyGeneralIds.length && i < allyUnits.length; i++) {
      const unit = allyUnits[i]!;
      results.push({
        generalId: allyGeneralIds[i]!,
        unitDataId: unit.dataId,
        maxHp: unit.maxHp,
        finalHp: Math.max(0, unit.hp),
        wasDefeated: unit.hp <= 0,
        team: 'ally',
      });
    }

    // Enemy side
    const enemyUnits = allUnits.filter(u => u.team === 'enemy');
    for (let i = 0; i < enemyGeneralIds.length && i < enemyUnits.length; i++) {
      const unit = enemyUnits[i]!;
      results.push({
        generalId: enemyGeneralIds[i]!,
        unitDataId: unit.dataId,
        maxHp: unit.maxHp,
        finalHp: Math.max(0, unit.hp),
        wasDefeated: unit.hp <= 0,
        team: 'enemy',
      });
    }

    return results;
  },
};
