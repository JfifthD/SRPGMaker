// ─────────────────────────────────────────────
//  Create Army Action
// ─────────────────────────────────────────────

import type { WorldAction } from '../WorldAction';
import type { WorldState } from '../WorldState';
import { createArmy, canCreateArmy } from '../../systems/ArmySystem';

export class CreateArmyAction implements WorldAction {
  readonly type = 'CREATE_ARMY';

  constructor(
    private readonly factionId: string,
    private readonly generalIds: string[],
    private readonly locationNodeId: string,
  ) {}

  validate(state: WorldState): boolean {
    if (!canCreateArmy(state, this.factionId)) return false;
    if (this.generalIds.length === 0) return false;

    for (const gId of this.generalIds) {
      const gen = state.generals[gId];
      if (!gen || gen.faction !== this.factionId) return false;
      if (gen.status === 'army' || gen.status === 'injured') return false;
    }

    return true;
  }

  execute(state: WorldState): WorldState {
    return createArmy(state, this.factionId, this.generalIds, this.locationNodeId);
  }
}
