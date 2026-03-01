// ─────────────────────────────────────────────
//  World Action — Command pattern for strategic layer
//  Mirrors GameAction from tactical layer.
// ─────────────────────────────────────────────

import type { WorldState } from './WorldState';

export interface WorldAction {
  readonly type: string;
  execute(state: WorldState): WorldState;
  validate(state: WorldState): boolean;
}
