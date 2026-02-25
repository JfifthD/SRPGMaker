// ─────────────────────────────────────────────
//  Enemy AI — Utility-Based Decision Making
// ─────────────────────────────────────────────

import type { BattleState } from '@/engine/state/BattleState';
import { StateQuery } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { Pos } from '@/engine/data/types/Map';
import type { GameAction } from '@/engine/state/actions/MoveAction';
import { MoveAction } from '@/engine/state/actions/MoveAction';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { SkillAction } from '@/engine/state/actions/SkillAction';
import { WaitAction } from '@/engine/state/actions/WaitAction';
import { AIScorer } from './AIScorer';
import { Pathworker } from '@/engine/systems/movement/PathfindingWorkerClient';
import { RangeCalc } from '@/engine/systems/movement/RangeCalc';
import { MathUtils } from '@/engine/utils/MathUtils';
import type { SkillData } from '@/engine/data/types/Skill';
import type { TerrainData, TerrainKey } from '@/engine/data/types/Terrain';
import { getSkillsMap, getTerrainMap } from '@/engine/loader/GameProjectLoader';

function makeBFSCtx(state: BattleState) {
  const terrainMap = getTerrainMap();
  const defaultTerrain = terrainMap['plain'] as TerrainData;
  return {
    width: state.mapData.width,
    height: state.mapData.height,
    getTerrain: (x: number, y: number) =>
      terrainMap[state.mapData.terrain[y]?.[x] as TerrainKey] ?? defaultTerrain,
    getUnit: (x: number, y: number) => StateQuery.at(state, x, y),
  };
}

export const EnemyAI = {
  /**
   * Decide the best actions for one enemy unit this turn.
   * Returns an array of GameActions to execute in order.
   */
  async decide(enemy: UnitInstance, state: BattleState): Promise<GameAction[]> {
    const allies = StateQuery.liveAllies(state);
    if (!allies.length) return [new WaitAction(enemy.instanceId)];

    const actions: GameAction[] = [];

    // ── 1. Try to use a skill ──
    const bestSkillAction = EnemyAI.chooseBestSkill(enemy, allies, state);
    if (bestSkillAction) {
      actions.push(bestSkillAction);
      return actions; // skill used → end turn
    }

    // ── 2. Move toward best target ──
    const target = EnemyAI.pickTarget(enemy, allies);
    const dist = MathUtils.dist(enemy, target);

    if (dist > enemy.atkRange) {
      const moveAction = await EnemyAI.chooseBestMove(enemy, target, state);
      if (moveAction) {
        actions.push(moveAction);
        // Use destination getter — no execute() call to avoid EventBus side effects
        const dest = moveAction.destination;
        const newDist = MathUtils.dist(dest, target);
        if (newDist <= enemy.atkRange) {
          actions.push(new AttackAction(enemy.instanceId, target.instanceId));
        }
        return actions;
      }
    }

    // ── 3. Attack in range ──
    if (dist <= enemy.atkRange) {
      actions.push(new AttackAction(enemy.instanceId, target.instanceId));
      return actions;
    }

    return [new WaitAction(enemy.instanceId)];
  },

  pickTarget(enemy: UnitInstance, allies: UnitInstance[]): UnitInstance {
    // Prioritise lowest HP ally in range, else nearest
    const inRange = allies.filter(a => MathUtils.dist(enemy, a) <= enemy.atkRange);
    if (inRange.length > 0) {
      return inRange.reduce((a, b) => a.hp <= b.hp ? a : b);
    }
    return allies.reduce((a, b) => MathUtils.dist(enemy, a) <= MathUtils.dist(enemy, b) ? a : b);
  },

  chooseBestSkill(
    enemy: UnitInstance,
    allies: UnitInstance[],
    state: BattleState,
  ): SkillAction | null {
    if (!enemy.mp || !enemy.skills.length) return null;

    let bestScore = -Infinity;
    let bestAction: SkillAction | null = null;

    const skillsMap = getSkillsMap();
    for (const sid of enemy.skills) {
      const sk = skillsMap[sid];
      if (!sk || enemy.mp < sk.mp || sk.target === 'self' || sk.target === 'ally') continue;

      const rangeTiles = RangeCalc.skillRange(
        { x: enemy.x, y: enemy.y }, sk, state.mapData.width, state.mapData.height,
      );

      for (const target of allies) {
        if (!rangeTiles.some(t => t.x === target.x && t.y === target.y)) continue;
        const score = AIScorer.scoreSkill(enemy, target, sk, state);
        if (score > bestScore) {
          bestScore = score;
          // Resolve AOE targets
          const targets = sk.aoe
            ? allies.filter(a => MathUtils.dist(a, target) <= 1 && a.hp > 0)
            : [target];
          bestAction = new SkillAction(
            enemy.instanceId, sk, target.x, target.y, targets,
          );
        }
      }
    }

    return bestAction;
  },

  async chooseBestMove(
    enemy: UnitInstance,
    target: UnitInstance,
    state: BattleState,
  ): Promise<MoveAction | null> {
    
    // Attempt A* pathfinding towards the target via Worker
    const fullPath = await Pathworker.getPath({ x: enemy.x, y: enemy.y }, { x: target.x, y: target.y }, enemy, state);
    
    if (fullPath && fullPath.length > 1) {
      // Find the furthest reachable tile along this optimal path within our SPD
      const reachableNodes = await Pathworker.getReachable(enemy, state);
      
      let bestTile: Pos = fullPath[0]!;
      for (let i = 1; i < fullPath.length; i++) {
        const step = fullPath[i]!;
        const rNode = reachableNodes.find(r => r.x === step.x && r.y === step.y);
        if (!rNode) break; // Path goes beyond our move grid this turn
        
        const occ = StateQuery.at(state, step.x, step.y);
        // We can only end our turn on a tile if it is unoccupied or occupied by ourselves
        if (!occ || occ.instanceId === enemy.instanceId) {
          bestTile = step;
        }
      }
      
      if (bestTile.x !== enemy.x || bestTile.y !== enemy.y) {
        return new MoveAction(enemy.instanceId, bestTile);
      }
    }

    // Fallback if A* fails (e.g., target completely blocked), use standard reachable heuristic scoring
    const allReachable = await Pathworker.getReachable(enemy, state);
    const reachable = allReachable.filter(t => {
      const occ = StateQuery.at(state, t.x, t.y);
      return !occ || occ.instanceId === enemy.instanceId;
    });

    if (!reachable.length) return null;

    const best = reachable.reduce((a, b) => {
      const sa = AIScorer.scoreMove(enemy, a, target, state);
      const sb = AIScorer.scoreMove(enemy, b, target, state);
      return sa >= sb ? a : b;
    });

    if (best.x === enemy.x && best.y === enemy.y) return null;
    return new MoveAction(enemy.instanceId, best);
  },
};
