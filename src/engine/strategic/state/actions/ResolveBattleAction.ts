// ─────────────────────────────────────────────
//  Resolve Battle Action — Apply battle result to world state
//  Called after each battle (manual or auto) completes.
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldAction } from '../WorldAction';
import type { WorldState } from '../WorldState';
import type { WorldMapData } from '../../data/types/World';
import type { BattleResult } from '../../data/types/BattleResult';
import { CasualtySystem } from '../../systems/CasualtySystem';

export class ResolveBattleAction implements WorldAction {
  readonly type = 'RESOLVE_BATTLE';

  constructor(
    private readonly battleId: string,
    private readonly result: BattleResult,
    private readonly worldMap: WorldMapData,
  ) {}

  validate(state: WorldState): boolean {
    return state.pendingBattles.some(b => b.id === this.battleId);
  }

  execute(state: WorldState): WorldState {
    const battle = state.pendingBattles.find(b => b.id === this.battleId);
    if (!battle) return state;

    // Apply casualties, territory transfer, retreats
    let newState = CasualtySystem.applyBattleResult(state, battle, this.result, this.worldMap);

    // Store result on the battle context and remove from pending
    newState = produce(newState, draft => {
      const idx = draft.pendingBattles.findIndex(b => b.id === this.battleId);
      if (idx !== -1) {
        draft.pendingBattles.splice(idx, 1);
      }
    });

    return newState;
  }
}
