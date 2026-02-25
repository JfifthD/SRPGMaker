import { EventBus } from '@/engine/utils/EventBus';
import { store } from '@/engine/state/GameStore';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { StateQuery } from '@/engine/state/BattleState';
import { MathUtils } from '@/engine/utils/MathUtils';

/**
 * ReactionSystem listens to core combat events and orchestrates "Interrupt" mechanics
 * like Counter-Attacks, Chain Assists, and Survive passives.
 * It is completely decoupled from the main TurnManager queue.
 */
export class ReactionSystem {
  constructor() {
    // We listen to unitDamaged events. This is after the damage has been applied
    // but before the renderer finishes its animations or the turn ends.
    EventBus.on('unitDamaged', (e) => this.onUnitDamaged(e));
  }

  private onUnitDamaged(e: { unit: import('@/engine/data/types/Unit').UnitInstance; dmg: number; crit: boolean; affMult: number }) {
    const state = store.getState();
    const defender = e.unit;
    
    // Check for Survive (Endure) passive logic
    // If the unit has the trait 'survive' or a specific buff, and they took fatal damage
    // Note: this should ideally be in DamageCalc, but we can do a post-hoc heal here if needed.
    // However, the action has already committed hp <= 0.
    // Actually, proper Survive logic belongs inside DamageCalc so the blow doesn't kill them.
    // This system is better purely for *actions* triggered by being attacked.

    // Counter-Attack Logic
    // If defender is still alive, and it's not currently their turn,
    // they can counter-attack IF the attacker is within their attack range.
    if (defender.hp > 0 && state.activeUnitId && state.activeUnitId !== defender.instanceId) {
      const attacker = StateQuery.unit(state, state.activeUnitId);
      
      // We must avoid infinite counter loops. We only counter if the active unit initiated.
      // Easiest heuristic: if the current active unit attacks a defender, the defender counters.
      // If the defender counters, the active unit doesn't counter the counter.
      if (attacker && attacker.hp > 0 && attacker.team !== defender.team) {
         const distance = MathUtils.dist({x: attacker.x, y: attacker.y}, {x: defender.x, y: defender.y});
         if (distance <= defender.atkRange) {
            // Trigger a counter-attack!
            // We dispatch this asynchronously so it happens sequentially after the current action finishes.
            setTimeout(() => {
                // Ensure both are still valid (e.g. not killed by another trigger)
                const currentState = store.getState();
                const freshAttacker = StateQuery.unit(currentState, attacker.instanceId);
                const freshDefender = StateQuery.unit(currentState, defender.instanceId);
                
                if (freshAttacker && freshAttacker.hp > 0 && freshDefender && freshDefender.hp > 0) {
                   EventBus.emit('logMessage', { text: `⚔ ${freshDefender.name}의 반격! (Counter)`, cls: 'lc' });
                   store.dispatch(new AttackAction(freshDefender.instanceId, freshAttacker.instanceId));
                   
                   // To ensure visual sync, we should also notify the renderer
                   // This is somewhat tightly coupled to how BattleCoordinator animates, 
                   // but `dispatch` handles state. We just need the renderer to animate it.
                   // A robust system would have the renderer observe the action stream.
                   // For now, we emit a special event for the view layer to catch.
                   EventBus.emit('animStart', { id: `counter_${freshDefender.instanceId}`});
                }
            }, 800); // Small delay to let initial attack animation finish
         }
      }
    }
  }
}

export const reactionSystem = new ReactionSystem();
