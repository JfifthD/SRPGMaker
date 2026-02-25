// ─────────────────────────────────────────────
//  EffectNodeRunner — SRPG Maker Core Runtime
//  Interprets EffectNode[] arrays, evaluating triggers → conditions → payloads.
//  All tactical gimmicks (ZOC, counter, chain, terrain reactions) flow through here.
// ─────────────────────────────────────────────

import type { EffectNode, EffectContext, EffectResult, ConditionNode, TriggerType } from '@/engine/data/types/EffectNode';
import type { BattleState } from '@/engine/state/BattleState';
import { StateQuery } from '@/engine/state/BattleState';
import { MathUtils } from '@/engine/utils/MathUtils';

/** Registry for script escape hatch functions */
type ScriptFn = (ctx: EffectContext, state: BattleState) => void;
const scriptRegistry = new Map<string, ScriptFn>();

/**
 * Register a TypeScript function as a script escape hatch.
 * Game creators reference these via `payload.scriptId` in JSON.
 */
export function registerScript(id: string, fn: ScriptFn): void {
  scriptRegistry.set(id, fn);
}

/**
 * Clear all registered scripts (useful in tests).
 */
export function clearScripts(): void {
  scriptRegistry.clear();
}

/**
 * Get a registered script by ID.
 */
export function getScript(id: string): ScriptFn | undefined {
  return scriptRegistry.get(id);
}

/**
 * Evaluate a set of EffectNodes against a given context and battle state.
 * Returns all effects whose trigger + conditions match.
 *
 * @param nodes   - Array of EffectNode definitions (from unit passives, terrain reactions, etc.)
 * @param trigger - The current trigger event type to filter by
 * @param ctx     - Runtime context (who triggered, who's affected, etc.)
 * @param state   - Current immutable BattleState
 * @returns Array of EffectResults ready to be applied
 */
export function evaluate(
  nodes: EffectNode[],
  trigger: TriggerType,
  ctx: EffectContext,
  state: BattleState,
): EffectResult[] {
  const results: EffectResult[] = [];

  // Filter nodes by trigger type and sort by priority (higher first)
  const matchingNodes = nodes
    .filter(n => n.trigger === trigger)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const node of matchingNodes) {
    // Evaluate all conditions — all must pass
    const conditionsPassed = node.conditions.every(cond =>
      evaluateCondition(cond, ctx, state),
    );

    if (!conditionsPassed) continue;

    // Resolve targets
    const targets = resolveTargets(node, ctx, state);

    results.push({
      node,
      targets,
      interruptMovement: node.payload.interruptMovement ?? false,
      payload: node.payload,
    });
  }

  return results;
}

// ── Condition Evaluator ──

function evaluateCondition(
  cond: ConditionNode,
  ctx: EffectContext,
  state: BattleState,
): boolean {
  switch (cond.type) {
    case 'IsEnemy': {
      if (!ctx.triggeringEntityId || !ctx.ownerId) return false;
      const triggering = StateQuery.unit(state, ctx.triggeringEntityId);
      const owner = StateQuery.unit(state, ctx.ownerId);
      return !!triggering && !!owner && triggering.team !== owner.team;
    }

    case 'IsAlly': {
      if (!ctx.triggeringEntityId || !ctx.ownerId) return false;
      const triggering = StateQuery.unit(state, ctx.triggeringEntityId);
      const owner = StateQuery.unit(state, ctx.ownerId);
      return !!triggering && !!owner && triggering.team === owner.team;
    }

    case 'Distance': {
      const op = cond.op ?? '==';
      const val = typeof cond.value === 'number' ? cond.value : 1;
      const dist = ctx.distance ?? Infinity;
      return compareNumber(dist, op, val);
    }

    case 'TargetInWeaponRange': {
      if (!ctx.ownerId || !ctx.eventTargetId) return false;
      const owner = StateQuery.unit(state, ctx.ownerId);
      const target = StateQuery.unit(state, ctx.eventTargetId);
      if (!owner || !target) return false;
      const dist = MathUtils.dist({ x: owner.x, y: owner.y }, { x: target.x, y: target.y });
      return dist <= owner.atkRange;
    }

    case 'CurrentAP': {
      if (!ctx.ownerId) return false;
      const owner = StateQuery.unit(state, ctx.ownerId);
      if (!owner) return false;
      const op = cond.op ?? '>=';
      const val = typeof cond.value === 'number' ? cond.value : 1;
      return compareNumber(owner.currentAP, op, val);
    }

    case 'OwnerAlive': {
      if (!ctx.ownerId) return false;
      const owner = StateQuery.unit(state, ctx.ownerId);
      return !!owner && owner.hp > 0;
    }

    case 'TargetAlive': {
      const targetId = ctx.eventTargetId ?? ctx.triggeringEntityId;
      if (!targetId) return false;
      const target = StateQuery.unit(state, targetId);
      return !!target && target.hp > 0;
    }

    case 'HasTag': {
      if (!ctx.tags || !cond.tag) return false;
      return ctx.tags.includes(cond.tag);
    }

    case 'IncomingDamageGteHP': {
      // Special: for OnBeforeDamaged — incoming damage would kill the unit
      // This is a semantic condition; the actual damage value is in customVars
      const incomingDmg = ctx.customVars?.['incomingDamage'] as number | undefined;
      const currentHP = ctx.customVars?.['currentHP'] as number | undefined;
      if (incomingDmg === undefined || currentHP === undefined) return false;
      return incomingDmg >= currentHP;
    }

    case 'CustomVar': {
      if (!ctx.customVars || !cond.tag) return false;
      const val = ctx.customVars[cond.tag];
      const op = cond.op ?? '==';
      if (typeof val === 'boolean' && typeof cond.value === 'boolean') {
        return op === '==' ? val === cond.value : val !== cond.value;
      }
      if (typeof val === 'number' && typeof cond.value === 'number') {
        return compareNumber(val, op, cond.value);
      }
      return val === cond.value;
    }

    default:
      // Unknown conditions fail open (return true) for extensibility
      // This allows game creators to define conditions handled by scripts
      return true;
  }
}

// ── Target Resolution ──

function resolveTargets(
  node: EffectNode,
  ctx: EffectContext,
  state: BattleState,
): string[] {
  switch (node.target) {
    case 'Self':
      return ctx.ownerId ? [ctx.ownerId] : [];

    case 'TriggeringEntity':
      return ctx.triggeringEntityId ? [ctx.triggeringEntityId] : [];

    case 'EventTarget':
      return ctx.eventTargetId ? [ctx.eventTargetId] : [];

    case 'AlliesInRange': {
      if (!ctx.ownerId) return [];
      const owner = StateQuery.unit(state, ctx.ownerId);
      if (!owner) return [];
      const range = node.payload.range ?? 1;
      return Object.values(state.units)
        .filter(u =>
          u.hp > 0 &&
          u.team === owner.team &&
          u.instanceId !== owner.instanceId &&
          MathUtils.dist({ x: owner.x, y: owner.y }, { x: u.x, y: u.y }) <= range,
        )
        .map(u => u.instanceId);
    }

    case 'EnemiesInRange': {
      if (!ctx.ownerId) return [];
      const owner = StateQuery.unit(state, ctx.ownerId);
      if (!owner) return [];
      const range = node.payload.range ?? 1;
      return Object.values(state.units)
        .filter(u =>
          u.hp > 0 &&
          u.team !== owner.team &&
          MathUtils.dist({ x: owner.x, y: owner.y }, { x: u.x, y: u.y }) <= range,
        )
        .map(u => u.instanceId);
    }

    case 'Tile':
      // For terrain transformations — return position as string key
      return ctx.position ? [`${ctx.position.x},${ctx.position.y}`] : [];

    default:
      return [];
  }
}

// ── Helpers ──

function compareNumber(
  actual: number,
  op: string,
  expected: number,
): boolean {
  switch (op) {
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '>=': return actual >= expected;
    case '<=': return actual <= expected;
    case '>':  return actual > expected;
    case '<':  return actual < expected;
    default:   return actual === expected;
  }
}
