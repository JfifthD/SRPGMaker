import { EventBus } from '@/engine/utils/EventBus';
import { store } from '@/engine/state/GameStore';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { StateQuery } from '@/engine/state/BattleState';
import { MathUtils } from '@/engine/utils/MathUtils';
import { evaluate } from '@/engine/systems/effectnode/EffectNodeRunner';
import { getDefaultPassives } from '@/engine/data/defaults/DefaultPassives';
import type { EffectContext } from '@/engine/data/types/EffectNode';

/**
 * ReactionSystem listens to core combat events and orchestrates "Interrupt" mechanics
 * using the Effect Node System. Counter-Attacks, Chain Assists, etc. are all defined
 * as EffectNode[] on each unit's passiveEffects array.
 */
export class ReactionSystem {
  private chainDepth = 0;
  private static readonly MAX_CHAIN_DEPTH = 1; // Prevent infinite assist chains

  constructor() {
    EventBus.on('unitDamaged', (e) => this.onUnitDamaged(e));
    EventBus.on('allyAttacked', (e) => this.onAllyAttacked(e));
  }

  private onUnitDamaged(e: { unit: import('@/engine/data/types/Unit').UnitInstance; dmg: number; crit: boolean; affMult: number }) {
    const state = store.getState();
    const defender = e.unit;

    // Only react if defender is alive and it's not their own turn
    if (defender.hp <= 0 || !state.activeUnitId || state.activeUnitId === defender.instanceId) return;

    const attacker = StateQuery.unit(state, state.activeUnitId);
    if (!attacker || attacker.hp <= 0 || attacker.team === defender.team) return;

    // Evaluate defender's passive effects for OnAfterDamaged triggers
    const passives = defender.passiveEffects && defender.passiveEffects.length > 0
      ? defender.passiveEffects
      : getDefaultPassives();

    const distance = MathUtils.dist(
      { x: attacker.x, y: attacker.y },
      { x: defender.x, y: defender.y },
    );

    const ctx: EffectContext = {
      ownerId: defender.instanceId,
      triggeringEntityId: attacker.instanceId,
      eventTargetId: attacker.instanceId, // For TargetInWeaponRange condition
      currentTrigger: 'OnAfterDamaged',
      distance,
    };

    const results = evaluate(passives, 'OnAfterDamaged', ctx, state);

    for (const result of results) {
      if (result.payload.action === 'BasicAttack') {
        // Counter-Attack — dispatch asynchronously for animation sequencing
        setTimeout(() => {
          const currentState = store.getState();
          const freshAttacker = StateQuery.unit(currentState, attacker.instanceId);
          const freshDefender = StateQuery.unit(currentState, defender.instanceId);

          if (freshAttacker && freshAttacker.hp > 0 && freshDefender && freshDefender.hp > 0) {
            EventBus.emit('logMessage', { text: `⚔ ${freshDefender.name}의 반격! (Counter)`, cls: 'lc' });
            store.dispatch(new AttackAction(freshDefender.instanceId, freshAttacker.instanceId));
            EventBus.emit('animStart', { id: `counter_${freshDefender.instanceId}` });
          }
        }, 800);
        break; // Only one counter per damage event
      }
    }
  }

  private onAllyAttacked(e: { attackerId: string; defenderId: string }) {
    // Guard on chain depth to prevent infinite recursion
    if (this.chainDepth >= ReactionSystem.MAX_CHAIN_DEPTH) return;

    const state = store.getState();
    const attacker = StateQuery.unit(state, e.attackerId);
    const target = StateQuery.unit(state, e.defenderId);
    if (!attacker || !target || target.hp <= 0) return;

    // Find all living allies (same team as attacker, excluding attacker itself)
    const allies = Object.values(state.units).filter(
      u => u.hp > 0 && u.team === attacker.team && u.instanceId !== attacker.instanceId,
    );

    for (const ally of allies) {
      const passives = ally.passiveEffects && ally.passiveEffects.length > 0
        ? ally.passiveEffects
        : getDefaultPassives();

      const ctx: EffectContext = {
        ownerId: ally.instanceId,
        triggeringEntityId: attacker.instanceId,
        eventTargetId: target.instanceId,
        currentTrigger: 'OnAllyAttacking',
      };

      const results = evaluate(passives, 'OnAllyAttacking', ctx, state);

      for (const result of results) {
        if (result.payload.action === 'BasicAttack' && result.targets.includes(target.instanceId)) {
          // Chain-Assist — dispatch with delay
          const delay = 1200; // After counter-attack window
          setTimeout(() => {
            const currentState = store.getState();
            const freshAlly = StateQuery.unit(currentState, ally.instanceId);
            const freshTarget = StateQuery.unit(currentState, target.instanceId);

            if (freshAlly && freshAlly.hp > 0 && freshTarget && freshTarget.hp > 0) {
              this.chainDepth++;
              EventBus.emit('logMessage', { text: `🔗 ${freshAlly.name}의 연계 공격! (Chain)`, cls: 'la' });
              store.dispatch(new AttackAction(freshAlly.instanceId, freshTarget.instanceId));
              EventBus.emit('animStart', { id: `chain_${freshAlly.instanceId}` });
              this.chainDepth--;
            }
          }, delay);
          break; // Only one chain per ally
        }
      }
    }
  }
}

export const reactionSystem = new ReactionSystem();


