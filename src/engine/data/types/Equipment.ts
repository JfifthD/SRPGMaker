// ─────────────────────────────────────────────
//  Equipment Types
//  Data-driven equipment definitions.
//  Pure TypeScript — no Phaser dependency.
// ─────────────────────────────────────────────

import type { EffectNode } from './EffectNode';

export type EquipSlot = 'weapon' | 'armor' | 'accessory';

export interface EquipmentData {
  id: string;
  name: string;
  desc: string;
  slot: EquipSlot;
  /** Additive stat bonuses */
  statBonus: Partial<Record<'atk' | 'def' | 'spd' | 'skl' | 'hp' | 'mp', number>>;
  /** Movement range bonus */
  movBonus?: number;
  /** Attack range bonus */
  rangeBonus?: number;
  /** Tags for affinity/weapon type */
  tags?: string[];
  /** Passive effects granted when equipped */
  passiveEffects?: EffectNode[];
  /** Job IDs that can equip this item */
  classRestriction?: string[];
  /** Shop price */
  price?: number;
}

/** Equipment slots on a unit */
export interface EquipmentSlots {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}
