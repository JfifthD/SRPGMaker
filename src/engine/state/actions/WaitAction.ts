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
      u.currentAP = 0; // Consume remaining AP

      u.moved = true;
      u.acted = true;
    });
  }
}
