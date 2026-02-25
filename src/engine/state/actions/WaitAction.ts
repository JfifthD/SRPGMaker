import type { BattleState } from '@/engine/state/BattleState';
import type { GameAction } from './MoveAction';
import { produce } from 'immer';
import { Logger } from '@/engine/utils/Logger';

export class WaitAction implements GameAction {
  readonly type = 'WAIT';

  constructor(private readonly unitId: string) {}

  execute(state: BattleState): BattleState {
    const unit = state.units[this.unitId];
    if (!unit) return state;

    Logger.log(`${unit.name} waits.`, 'action');

    return produce(state, draft => {
      const u = draft.units[this.unitId]!;
      
      // Charge mechanic: if no action was taken this turn (moved/acted still false),
      // carry AP over to next turn for overcast accumulation.
      // Use moved/acted flags (reset at turn start) not currentAP (can exceed maxAP from charge).
      if (!u.moved && !u.acted) {
        Logger.log(`${u.name} is Gathering Focus!`, 'system');
      } else {
        u.currentAP = 0; // Consume remaining AP after partial actions
      }

      u.moved = true;
      u.acted = true;
      draft.inputMode = 'idle';
      draft.selectedUnitId = null;
    });
  }
}
