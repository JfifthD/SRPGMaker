// ─────────────────────────────────────────────
//  DialogueTriggerSystem
//  Registers triggers and evaluates them against
//  game events. Fires DialogueManager.play() when
//  conditions match.
//
//  Pure TypeScript — no Phaser.
// ─────────────────────────────────────────────

import type { DialogueTrigger, DialogueTriggerEvent } from '@/engine/data/types/Dialogue';
import type { DialogueManager } from './DialogueManager';
import type { BattleState } from '@/engine/state/BattleState';

/** Context passed to evaluate() — all fields optional */
export interface TriggerContext {
  state?: BattleState;
  unitId?: string;
  turn?: number;
  tileX?: number;
  tileY?: number;
  flag?: string;
}

export class DialogueTriggerSystem {
  private triggers: DialogueTrigger[] = [];
  private manager: DialogueManager;

  constructor(manager: DialogueManager) {
    this.manager = manager;
  }

  // ── Registration ──────────────────────────────────────────

  register(trigger: DialogueTrigger): void {
    this.triggers.push(trigger);
  }

  registerAll(triggers: DialogueTrigger[]): void {
    for (const t of triggers) this.register(t);
  }

  // ── Evaluation ────────────────────────────────────────────

  /**
   * Evaluates all registered triggers for a given event.
   * Triggers that match all conditions will have their script played
   * by the DialogueManager.
   *
   * NOTE: Scripts are played sequentially (await each).
   */
  async evaluate(event: DialogueTriggerEvent, ctx: TriggerContext = {}): Promise<void> {
    for (const trigger of this.triggers) {
      if (trigger.event !== event) continue;

      // 'once' guard: skip if already played
      if (trigger.once && this.manager.hasTriggered(trigger.scriptId)) continue;

      // Condition matching — all specified conditions must pass
      if (trigger.unitId !== undefined && ctx.unitId !== trigger.unitId) continue;
      if (trigger.turn  !== undefined && ctx.turn  !== trigger.turn)  continue;
      if (trigger.tileX !== undefined && ctx.tileX !== trigger.tileX) continue;
      if (trigger.tileY !== undefined && ctx.tileY !== trigger.tileY) continue;
      if (trigger.flag  !== undefined && !this.manager.hasFlag(trigger.flag)) continue;

      // All conditions passed — play the script
      await this.manager.play(trigger.scriptId);
    }
  }
}
