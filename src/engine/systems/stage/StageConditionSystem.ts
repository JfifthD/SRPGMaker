// ─────────────────────────────────────────────
//  StageConditionSystem
//  Evaluates dynamic win/loss conditions defined in MapData.
//  Pure TypeScript — no Phaser dependency.
// ─────────────────────────────────────────────

import type { BattleState } from '@/engine/state/BattleState';
import type { StageCondition } from '@/engine/data/types/Map';
import { StateQuery } from '@/engine/state/BattleState';

export type StageResult = 'VICTORY' | 'DEFEAT' | 'ONGOING';

/**
 * Resolve the effective win/loss conditions from MapData.
 * Falls back to legacy `victoryCondition` / `defeatCondition` fields,
 * and ultimately to the classic defaults if nothing is specified.
 */
function resolveConditions(state: BattleState): {
  win: StageCondition[];
  loss: StageCondition[];
} {
  const map = state.mapData;

  const win: StageCondition[] =
    map.winConditions && map.winConditions.length > 0
      ? map.winConditions
      : map.victoryCondition
        ? [map.victoryCondition]
        : [{ type: 'defeat_all' }];

  const loss: StageCondition[] =
    map.lossConditions && map.lossConditions.length > 0
      ? map.lossConditions
      : map.defeatCondition
        ? [map.defeatCondition]
        : [{ type: 'all_allies_dead' }];

  return { win, loss };
}

/**
 * Check whether a single StageCondition is currently satisfied.
 */
function isMet(cond: StageCondition, state: BattleState): boolean {
  switch (cond.type) {
    // ── Win Conditions ──
    case 'defeat_all':
      return StateQuery.liveEnemies(state).length === 0;

    case 'defeat_target': {
      if (!cond.targetUnitId) return false;
      // Check if any unit matching the dataId (or instanceId) is still alive
      const alive = Object.values(state.units).some(
        u => (u.dataId === cond.targetUnitId || u.instanceId === cond.targetUnitId)
          && u.hp > 0,
      );
      return !alive; // target is defeated when NOT alive
    }

    case 'reach_tile': {
      if (cond.x == null || cond.y == null) return false;
      const tx = cond.x;
      const ty = cond.y;

      if (cond.reachUnitId && cond.reachUnitId !== 'any_ally') {
        // A specific unit must reach the tile
        const unit = Object.values(state.units).find(
          u => (u.dataId === cond.reachUnitId || u.instanceId === cond.reachUnitId)
            && u.hp > 0,
        );
        return unit ? (unit.x === tx && unit.y === ty) : false;
      }

      // any_ally (or unspecified) — any living ally on the tile
      return StateQuery.liveAllies(state).some(u => u.x === tx && u.y === ty);
    }

    case 'survive_turns':
      return cond.turns != null && state.turn > cond.turns;

    // ── Loss Conditions ──
    case 'all_allies_dead':
      return StateQuery.liveAllies(state).length === 0;

    case 'protect_target': {
      if (!cond.targetUnitId) return false;
      const alive = Object.values(state.units).some(
        u => (u.dataId === cond.targetUnitId || u.instanceId === cond.targetUnitId)
          && u.hp > 0,
      );
      return !alive; // loss triggered when the protected unit is dead
    }

    case 'turn_limit':
      return cond.turns != null && state.turn > cond.turns;

    default:
      return false;
  }
}

/**
 * Evaluate all win/loss conditions for the current state.
 * Loss conditions are checked FIRST (so a simultaneous loss + win = DEFEAT).
 * Conditions in each array are OR — any one being met triggers the result.
 */
export function evaluate(state: BattleState): StageResult {
  const { win, loss } = resolveConditions(state);

  // Check loss first (loss takes priority in simultaneous scenarios)
  for (const cond of loss) {
    if (isMet(cond, state)) return 'DEFEAT';
  }

  for (const cond of win) {
    if (isMet(cond, state)) return 'VICTORY';
  }

  return 'ONGOING';
}

/** Namespace export for cleaner API */
export const StageConditionSystem = { evaluate };
