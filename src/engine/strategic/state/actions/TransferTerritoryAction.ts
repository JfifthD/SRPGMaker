// ─────────────────────────────────────────────
//  Transfer Territory Action
// ─────────────────────────────────────────────

import type { WorldAction } from '../WorldAction';
import type { WorldState } from '../WorldState';
import { transferTerritory } from '../../systems/TerritorySystem';
import { WorldEventBus } from '../../WorldEventBus';

export class TransferTerritoryAction implements WorldAction {
  readonly type = 'TRANSFER_TERRITORY';

  constructor(
    private readonly territoryId: string,
    private readonly newOwner: string,
  ) {}

  validate(state: WorldState): boolean {
    const territory = state.territories[this.territoryId];
    if (!territory) return false;
    if (territory.owner === this.newOwner) return false;
    if (!state.factions[this.newOwner]) return false;
    return true;
  }

  execute(state: WorldState): WorldState {
    const oldOwner = state.territories[this.territoryId]?.owner ?? null;
    const newState = transferTerritory(state, this.territoryId, this.newOwner);

    WorldEventBus.emit('territoryCapture', {
      territoryId: this.territoryId,
      oldOwner,
      newOwner: this.newOwner,
    });

    return newState;
  }
}
