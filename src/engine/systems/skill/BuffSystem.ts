// ─────────────────────────────────────────────
//  Buff / Debuff System
// ─────────────────────────────────────────────

import type { UnitInstance } from '@/engine/data/types/Unit';
import { produce } from 'immer';

export const BuffSystem = {
  /**
   * Apply a buff/debuff to a unit. Returns a new UnitInstance (immutable).
   */
  apply(unit: UnitInstance, stat: string, val: number, dur: number): UnitInstance {
    return produce(unit, draft => {
      draft.buffs.push({ stat, val, dur });
      (draft as any)[stat] = ((draft as any)[stat] ?? 0) + val;
    });
  },

  /**
   * Tick all active buffs at the start of a new turn.
   * Decrements duration and removes expired buffs, reverting their stat changes.
   * Returns a new UnitInstance (immutable).
   */
  tick(unit: UnitInstance): UnitInstance {
    if (!unit.buffs.length) return unit;
    return produce(unit, draft => {
      draft.buffs = draft.buffs.filter(b => {
        b.dur -= 1;
        if (b.dur <= 0) {
          // Revert stat change
          (draft as any)[b.stat] = Math.max(
            0,
            ((draft as any)[b.stat] ?? 0) - b.val,
          );
          return false;
        }
        return true;
      });
    });
  },
};
