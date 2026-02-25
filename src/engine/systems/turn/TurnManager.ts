// ─────────────────────────────────────────────
//  Turn / Phase FSM
// ─────────────────────────────────────────────

import { EventBus } from '@/engine/utils/EventBus';
import { Logger } from '@/engine/utils/Logger';

export type BattlePhase =
  | 'PLAYER_IDLE'
  | 'UNIT_SELECTED'
  | 'MOVE_SELECT'
  | 'ACTION_SELECT'
  | 'SKILL_SELECT'
  | 'ANIMATING'
  | 'ENEMY_PHASE'
  | 'VICTORY'
  | 'DEFEAT';

type TransitionMap = Partial<Record<BattlePhase, BattlePhase[]>>;

const TRANSITIONS: TransitionMap = {
  // CT system: same team can act consecutively, so self-transitions are valid.
  PLAYER_IDLE:    ['UNIT_SELECTED', 'ENEMY_PHASE', 'PLAYER_IDLE', 'VICTORY', 'DEFEAT'],
  UNIT_SELECTED:  ['MOVE_SELECT', 'ACTION_SELECT', 'PLAYER_IDLE'],
  MOVE_SELECT:    ['ANIMATING', 'ACTION_SELECT', 'UNIT_SELECTED', 'PLAYER_IDLE'],
  ACTION_SELECT:  ['SKILL_SELECT', 'ANIMATING', 'UNIT_SELECTED', 'PLAYER_IDLE'],
  SKILL_SELECT:   ['ANIMATING', 'ACTION_SELECT', 'PLAYER_IDLE'],
  ANIMATING:      ['PLAYER_IDLE', 'ENEMY_PHASE', 'VICTORY', 'DEFEAT'],
  ENEMY_PHASE:    ['PLAYER_IDLE', 'VICTORY', 'DEFEAT', 'ENEMY_PHASE'],
  VICTORY:        [],
  DEFEAT:         [],
};

export class TurnManager {
  private _phase: BattlePhase = 'PLAYER_IDLE';
  private _turn = 1;

  get phase(): BattlePhase { return this._phase; }
  get turn(): number      { return this._turn; }

  /** Attempt a phase transition. Throws on invalid transition (dev safety). */
  transition(next: BattlePhase): void {
    const allowed = TRANSITIONS[this._phase] ?? [];
    if (!allowed.includes(next)) {
      console.error(
        `[TurnManager] Invalid transition: ${this._phase} → ${next}. Allowed: [${allowed.join(', ')}]`,
      );
      return;
    }
    this._phase = next;
    EventBus.emit('phaseChanged', { phase: next });
  }


  /** Convenience: is input allowed? */
  get isPlayerInteractable(): boolean {
    return (
      this._phase === 'PLAYER_IDLE'   ||
      this._phase === 'UNIT_SELECTED' ||
      this._phase === 'MOVE_SELECT'   ||
      this._phase === 'ACTION_SELECT' ||
      this._phase === 'SKILL_SELECT'
    );
  }

  reset(): void {
    this._phase = 'PLAYER_IDLE';
    this._turn = 1;
  }
}
