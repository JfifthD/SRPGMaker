import type { UnitInstance } from '@/engine/data/types/Unit';

export const CritSystem = {
  /** Base critical hit chance: 10% + SKL-based bonus */
  baseChance(attacker: UnitInstance): number {
    const sklBonus = attacker.skl / 200; // SKL 20 → +10%
    return 0.1 + sklBonus;
  },

  /** Returns true if this attack is a critical hit */
  roll(attacker: UnitInstance): boolean {
    return Math.random() < CritSystem.baseChance(attacker);
  },

  /** Damage multiplier on a critical hit */
  MULTIPLIER: 1.8,
};
