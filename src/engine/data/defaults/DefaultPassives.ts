// ─────────────────────────────────────────────
//  Default Passive Effect Nodes
//  Built-in tactical mechanics that ALL units have by default.
//  Game creators can override these per-unit in JSON.
// ─────────────────────────────────────────────

import type { EffectNode } from '@/engine/data/types/EffectNode';

/** Default ZOC: when an enemy enters an adjacent tile, interrupt their movement. */
export const ZOC_NODE: EffectNode = {
  name: 'ZoneOfControl',
  type: 'MovementControl',
  trigger: 'OnMoveEnter',
  target: 'TriggeringEntity',
  conditions: [
    { type: 'IsEnemy' },
    { type: 'Distance', op: '==', value: 1 },
  ],
  payload: {
    interruptMovement: true,
  },
  priority: 100,
};

/** Default Counter-Attack: after taking damage, strike back if attacker is within range. */
export const COUNTER_ATTACK_NODE: EffectNode = {
  name: 'CounterAttack',
  type: 'ReactionStrike',
  trigger: 'OnAfterDamaged',
  target: 'TriggeringEntity',
  conditions: [
    { type: 'IsEnemy' },
    { type: 'TargetInWeaponRange' },
  ],
  payload: {
    action: 'BasicAttack',
    damageMultiplier: 1.0,
    apCost: 0,
  },
  priority: 50,
};

/**
 * Returns the default passive effects for all units.
 * These are the built-in SRPG mechanics applied unless overridden.
 */
export function getDefaultPassives(): EffectNode[] {
  return [ZOC_NODE, COUNTER_ATTACK_NODE];
}
