// ─────────────────────────────────────────────
//  Advance Turn Action — Increment world turn counter
//  Called after all battles are resolved.
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldAction } from '../WorldAction';
import type { WorldState } from '../WorldState';

export class AdvanceTurnAction implements WorldAction {
  readonly type = 'ADVANCE_TURN';

  validate(state: WorldState): boolean {
    return state.phase === 'advance';
  }

  execute(state: WorldState): WorldState {
    return produce(state, draft => {
      draft.turn += 1;
      draft.day = draft.turn * 30;
      draft.pendingBattles = [];
      draft.phase = 'player_actions';
    });
  }
}
