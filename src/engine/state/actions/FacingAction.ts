import type { BattleState } from '@/engine/state/BattleState';
import type { GameAction } from './MoveAction';
import type { Facing } from '@/engine/data/types/Unit';
import { produce } from 'immer';

export class FacingAction implements GameAction {
  readonly type = 'FACING';

  constructor(
    private readonly unitId: string,
    private readonly facing: Facing,
  ) {}

  execute(state: BattleState): BattleState {
    const unit = state.units[this.unitId];
    if (!unit) return state;

    return produce(state, draft => {
      const u = draft.units[this.unitId]!;
      u.facing = this.facing;
    });
  }
}
