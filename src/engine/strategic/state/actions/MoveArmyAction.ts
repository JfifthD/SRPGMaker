// ─────────────────────────────────────────────
//  Move Army Action — Set army movement order
// ─────────────────────────────────────────────

import type { WorldAction } from '../WorldAction';
import type { WorldState } from '../WorldState';
import { setArmyMovementOrder } from '../../systems/ArmySystem';

export class MoveArmyAction implements WorldAction {
  readonly type = 'MOVE_ARMY';

  constructor(
    private readonly armyId: string,
    private readonly path: string[],
  ) {}

  validate(state: WorldState): boolean {
    const army = state.armies[this.armyId];
    if (!army) return false;
    if (army.status === 'in_battle') return false;
    if (this.path.length < 2) return false;
    // First node in path must be army's current location
    if (this.path[0] !== army.locationNodeId) return false;
    return true;
  }

  execute(state: WorldState): WorldState {
    const targetNodeId = this.path[this.path.length - 1]!;
    return setArmyMovementOrder(state, this.armyId, targetNodeId, this.path);
  }
}
