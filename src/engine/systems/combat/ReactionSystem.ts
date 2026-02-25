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
  constructor() {
    EventBus.on('unitDamaged', (e) => this.onUnitDamaged(e));
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
}

export const reactionSystem = new ReactionSystem();

