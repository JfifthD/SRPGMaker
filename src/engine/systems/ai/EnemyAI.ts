// ─────────────────────────────────────────────
//  Enemy AI — Utility-Based Decision Making
//  With AI Personality Archetypes & AIConfig
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

export const EnemyAI = {
  /**
   * Decide the best actions for one enemy unit this turn.
   */
  async decide(enemy: UnitInstance, state: BattleState): Promise<GameAction[]> {
    const allies = StateQuery.liveAllies(state);
    if (!allies.length) return [new WaitAction(enemy.instanceId)];

    const actions: GameAction[] = [];

    // ── 0. AIConfig: Detect Range Check ──
    let isProvoked = true;
    if (enemy.aiConfig?.detectRange !== undefined) {
      const closestDist = Math.min(...allies.map(a => MathUtils.dist(enemy, a)));
      if (closestDist > enemy.aiConfig.detectRange) {
        isProvoked = false;
      }
    }

    // If not provoked, handle non-combat behaviors (Patrol / Guard)
    if (!isProvoked) {
      if (enemy.aiConfig?.patrolPath?.length) {
        const patrolMove = await EnemyAI.choosePatrolMove(enemy, state);
        if (patrolMove) {
          actions.push(patrolMove);
          return actions;
        }
      }
      if (enemy.aiConfig?.guardTile) {
         const d = MathUtils.dist(enemy, enemy.aiConfig.guardTile);
         if (d > 0) {
           const guardMove = await EnemyAI.chooseBestMove(enemy, { ...enemy.aiConfig.guardTile, instanceId: 'guard', team: 'ally' } as any, state);
           if (guardMove) {
             actions.push(guardMove);
             return actions;
           }
         }
      }
      // Just wait
      return [new WaitAction(enemy.instanceId)];
    }

    // ── Combat Behaviors ──

    // Support: prioritise heal/buff on friendly units
    if (enemy.aiType === 'support') {
      const friendlies = StateQuery.liveEnemies(state).filter(u => u.instanceId !== enemy.instanceId);
      if (friendlies.length) {
        const supportAction = EnemyAI.chooseSupportSkill(enemy, friendlies, state);
        if (supportAction) {
          actions.push(supportAction);
          return actions;
        }
      }
    }

    // Defensive/Hit&Run/Patrol: retreat when HP is critically low
    const hpRatio = enemy.hp / enemy.maxHp;
    const retreatThreshold = enemy.aiType === 'defensive' ? 0.5 :
                             enemy.aiType === 'hit_and_run' ? 0.8 :
                             enemy.aiType === 'patrol' ? 0.4 : 0;
                             
    if (hpRatio < retreatThreshold) {
      const retreatAction = await EnemyAI.chooseRetreatMove(enemy, allies, state);
      if (retreatAction) {
        actions.push(retreatAction);
        return actions;
      }
    }

    // 1. Try to use a damaging skill
    const bestSkillAction = EnemyAI.chooseBestSkill(enemy, allies, state);
    if (bestSkillAction) {
      actions.push(bestSkillAction);
      return actions; // skill used → end turn
    }

    // 2. Move toward best target
    const target = EnemyAI.pickTarget(enemy, allies, state);
    const dist = MathUtils.dist(enemy, target);

    // If unit is Boss with Guard Tile, it might refuse to move unless target is in attack range
    if (enemy.aiType === 'boss' && enemy.aiConfig?.guardTile && dist > enemy.atkRange) {
      // Return to guard tile if not already there, otherwise just wait
      const d = MathUtils.dist(enemy, enemy.aiConfig.guardTile);
      if (d > 0) {
        const guardMove = await EnemyAI.chooseBestMove(enemy, { ...enemy.aiConfig.guardTile, instanceId: 'guard', team: 'ally' } as any, state);
        if (guardMove) {
          actions.push(guardMove);
          return actions;
        }
      }
      return [new WaitAction(enemy.instanceId)];
    }

    if (dist > enemy.atkRange) {
      const moveAction = await EnemyAI.chooseBestMove(enemy, target, state);
      if (moveAction) {
        actions.push(moveAction);
        const dest = moveAction.destination;
        const newDist = MathUtils.dist(dest, target);
        if (newDist <= enemy.atkRange) {
          actions.push(new AttackAction(enemy.instanceId, target.instanceId));
        }
        return actions;
      }
    }

    // 3. Attack in range
    if (dist <= enemy.atkRange) {
      actions.push(new AttackAction(enemy.instanceId, target.instanceId));
      return actions;
    }

    return [new WaitAction(enemy.instanceId)];
  },

  /**
   * Determine the next waypoint in the patrol path and move towards it.
   */
  async choosePatrolMove(enemy: UnitInstance, state: BattleState): Promise<MoveAction | null> {
    const path = enemy.aiConfig?.patrolPath;
    if (!path || !path.length) return null;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d = MathUtils.dist(enemy, path[i]!);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }
    
    // Target the next waypoint if we are already at the closest one
    const targetWaypoint = (minDist === 0) ? path[(closestIdx + 1) % path.length]! : path[closestIdx]!;
    
    // Fake a UnitInstance target for chooseBestMove
    const dummyTarget: any = { x: targetWaypoint.x, y: targetWaypoint.y, instanceId: 'waypoint', hp: 1 };
    
    return await EnemyAI.chooseBestMove(enemy, dummyTarget, state);
  },

  /**
   * Pick the best attack target based on AI personality & AIConfig.targetPriority:
   * - Config overrides base personality.
   * - aggressive: lowest HP ally in range, else nearest (original)
   * - defensive:  ally that poses greatest threat (highest ATK)
   * - support:    closest ally
   * - hit_and_run: strictly the weakest
   * - boss: strongest
   */
  pickTarget(enemy: UnitInstance, allies: UnitInstance[], state: BattleState): UnitInstance {
    const tp = enemy.aiConfig?.targetPriority;
    
    // Priority Overrides from Config
    if (tp === 'healer_first') {
      const healers = allies.filter(a => a.job.toLowerCase().includes('cleric') || a.job.toLowerCase().includes('priest') || a.job.toLowerCase().includes('bishop'));
      if (healers.length > 0) return healers.reduce((a, b) => MathUtils.dist(enemy, a) <= MathUtils.dist(enemy, b) ? a : b);
    }
    if (tp === 'weakest' || enemy.aiType === 'hit_and_run') {
      return allies.reduce((a, b) => a.hp <= b.hp ? a : b);
    }
    if (tp === 'strongest' || enemy.aiType === 'boss' || enemy.aiType === 'defensive') {
      return allies.reduce((a, b) => a.atk >= b.atk ? a : b);
    }
    if (tp === 'nearest' || enemy.aiType === 'support') {
      return allies.reduce((a, b) => MathUtils.dist(enemy, a) <= MathUtils.dist(enemy, b) ? a : b);
    }

    // aggressive (default): lowest HP ally in range, else nearest
    const inRange = allies.filter(a => MathUtils.dist(enemy, a) <= enemy.atkRange);
    if (inRange.length > 0) {
      return inRange.reduce((a, b) => a.hp <= b.hp ? a : b);
    }
    return allies.reduce((a, b) => MathUtils.dist(enemy, a) <= MathUtils.dist(enemy, b) ? a : b);
  },

  /**
   * Support-only: choose the best heal or buff skill.
   */
  chooseSupportSkill(
    caster: UnitInstance,
    friendlies: UnitInstance[],
    state: BattleState,
  ): SkillAction | null {
    if (!caster.mp || !caster.skills.length) return null;

    let bestScore = 0; 
    let bestAction: SkillAction | null = null;
    const skillsMap = state.gameProject.skillsMap;

    for (const sid of caster.skills) {
      const sk = skillsMap[sid];
      if (!sk || caster.mp < sk.mp) continue;
      if (sk.target !== 'ally' && sk.target !== 'self') continue;

      const rangeTiles = RangeCalc.skillRange(
        { x: caster.x, y: caster.y }, sk, state.mapData.width, state.mapData.height,
      );

      const targetPool = sk.target === 'self' ? [caster] : friendlies;
      for (const target of targetPool) {
        if (!rangeTiles.some(t => t.x === target.x && t.y === target.y) && sk.target !== 'self') continue;
        const score = AIScorer.scoreSkill(caster, target, sk, state);
        if (score > bestScore) {
          bestScore = score;
          bestAction = new SkillAction(caster.instanceId, sk, target.x, target.y, [target]);
        }
      }
    }

    return bestAction;
  },

  chooseBestSkill(
    enemy: UnitInstance,
    allies: UnitInstance[],
    state: BattleState,
  ): SkillAction | null {
    if (!enemy.mp || !enemy.skills.length) return null;

    let bestScore = -Infinity;
    let bestAction: SkillAction | null = null;

    const skillsMap = state.gameProject.skillsMap;
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

  /**
   * Defensive retreat: move to the tile that maximises distance from all threats
   * while minimising danger.
   */
  async chooseRetreatMove(
    enemy: UnitInstance,
    allies: UnitInstance[],
    state: BattleState,
  ): Promise<MoveAction | null> {
    const allReachable = await Pathworker.getReachable(enemy, state);
    const reachable = allReachable.filter(t => {
      const occ = StateQuery.at(state, t.x, t.y);
      return !occ || occ.instanceId === enemy.instanceId;
    });

    if (!reachable.length) return null;

    // Score: maximise min-distance to all allies while minimising threat
    const bestTile = reachable.reduce((best, tile) => {
      const minDistToAlly = Math.min(...allies.map(a =>
        Math.abs(tile.x - a.x) + Math.abs(tile.y - a.y)));
      const minDistBest = Math.min(...allies.map(a =>
        Math.abs(best.x - a.x) + Math.abs(best.y - a.y)));
      return minDistToAlly >= minDistBest ? tile : best;
    });

    if (bestTile.x === enemy.x && bestTile.y === enemy.y) return null;
    return new MoveAction(enemy.instanceId, bestTile);
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
        if (!occ || occ.instanceId === enemy.instanceId) {
           // Boss restriction: do not leave guard tile unless moving to attack!
           if (enemy.aiType === 'boss' && enemy.aiConfig?.guardTile) {
             const distToTarget = Math.abs(step.x - target.x) + Math.abs(step.y - target.y);
             if (distToTarget > enemy.atkRange) continue; // Skip tiles that don't let boss attack
           }
           bestTile = step;
        }
      }
      
      if (bestTile.x !== enemy.x || bestTile.y !== enemy.y) {
        return new MoveAction(enemy.instanceId, bestTile);
      }
    }

    // Fallback: use personality-aware heuristic scoring
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
