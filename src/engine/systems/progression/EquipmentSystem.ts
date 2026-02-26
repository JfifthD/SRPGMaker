// ─────────────────────────────────────────────
//  EquipmentSystem
//  Pure TypeScript — no Phaser dependency.
//  Handles equip/unequip and stat computation.
// ─────────────────────────────────────────────

import type { EquipmentData, EquipSlot, EquipmentSlots } from '@/engine/data/types/Equipment';
import type { UnitInstance } from '@/engine/data/types/Unit';

// ── Types ──

export interface ComputedStatBonus {
  atk: number;
  def: number;
  spd: number;
  skl: number;
  hp: number;
  mp: number;
  mov: number;
  range: number;
}

// ── Core Functions ──

/**
 * Check if a unit can equip a given item.
 */
export function canEquip(unit: UnitInstance, equip: EquipmentData): boolean {
  if (!equip.classRestriction || equip.classRestriction.length === 0) return true;
  return equip.classRestriction.includes(unit.job.toLowerCase());
}

/**
 * Equip an item onto a unit. Returns the updated unit.
 * If the slot already has an item, it is replaced.
 */
export function equip(
  unit: UnitInstance,
  equipId: string,
  slot: EquipSlot,
): UnitInstance {
  const equipment = { ...(unit.equipment ?? { weapon: null, armor: null, accessory: null }) };
  equipment[slot] = equipId;
  return { ...unit, equipment };
}

/**
 * Unequip an item from a slot. Returns the updated unit.
 */
export function unequip(unit: UnitInstance, slot: EquipSlot): UnitInstance {
  const equipment = { ...(unit.equipment ?? { weapon: null, armor: null, accessory: null }) };
  equipment[slot] = null;
  return { ...unit, equipment };
}

/**
 * Compute total stat bonuses from all equipped items.
 */
export function getEquipmentBonuses(
  unit: UnitInstance,
  equipMap: Record<string, EquipmentData>,
): ComputedStatBonus {
  const bonus: ComputedStatBonus = { atk: 0, def: 0, spd: 0, skl: 0, hp: 0, mp: 0, mov: 0, range: 0 };
  const slots = unit.equipment;
  if (!slots) return bonus;

  const slotKeys: EquipSlot[] = ['weapon', 'armor', 'accessory'];
  for (const slot of slotKeys) {
    const equipId = slots[slot];
    if (!equipId) continue;
    const data = equipMap[equipId];
    if (!data) continue;

    if (data.statBonus.atk) bonus.atk += data.statBonus.atk;
    if (data.statBonus.def) bonus.def += data.statBonus.def;
    if (data.statBonus.spd) bonus.spd += data.statBonus.spd;
    if (data.statBonus.skl) bonus.skl += data.statBonus.skl;
    if (data.statBonus.hp)  bonus.hp += data.statBonus.hp;
    if (data.statBonus.mp)  bonus.mp += data.statBonus.mp;
    if (data.movBonus) bonus.mov += data.movBonus;
    if (data.rangeBonus) bonus.range += data.rangeBonus;
  }

  return bonus;
}

/**
 * Get the effective stats of a unit including equipment bonuses.
 */
export function getEffectiveStats(
  unit: UnitInstance,
  equipMap: Record<string, EquipmentData>,
): { atk: number; def: number; spd: number; skl: number } {
  const bonus = getEquipmentBonuses(unit, equipMap);
  return {
    atk: unit.atk + bonus.atk,
    def: unit.def + bonus.def,
    spd: unit.spd + bonus.spd,
    skl: unit.skl + bonus.skl,
  };
}

/**
 * Collect all passive effects from equipped items.
 */
export function getEquipmentPassives(
  unit: UnitInstance,
  equipMap: Record<string, EquipmentData>,
): import('@/engine/data/types/EffectNode').EffectNode[] {
  const passives: import('@/engine/data/types/EffectNode').EffectNode[] = [];
  const slots = unit.equipment;
  if (!slots) return passives;

  const slotKeys: EquipSlot[] = ['weapon', 'armor', 'accessory'];
  for (const slot of slotKeys) {
    const equipId = slots[slot];
    if (!equipId) continue;
    const data = equipMap[equipId];
    if (data?.passiveEffects) {
      passives.push(...data.passiveEffects);
    }
  }

  return passives;
}
