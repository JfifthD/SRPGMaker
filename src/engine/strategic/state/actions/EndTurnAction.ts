// ─────────────────────────────────────────────
//  End Turn Action — Player ends their action phase
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldAction } from '../WorldAction';
import type { WorldState } from '../WorldState';

export class EndTurnAction implements WorldAction {
  readonly type = 'END_TURN';

  validate(state: WorldState): boolean {
    return state.phase === 'player_actions';
  }

  execute(state: WorldState): WorldState {
    return produce(state, draft => {
      draft.phase = 'ai_actions';
    });
  }
}
