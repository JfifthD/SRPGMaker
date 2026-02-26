import { describe, it, expect } from 'vitest';
import {
  canEquip,
  equip,
  unequip,
  getEquipmentBonuses,
  getEffectiveStats,
  getEquipmentPassives,
} from '@/engine/systems/progression/EquipmentSystem';
import type { EquipmentData } from '@/engine/data/types/Equipment';
import type { UnitInstance } from '@/engine/data/types/Unit';

// ── Helpers ──

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1', name: 'TestUnit',
    job: 'warrior', affinity: 'phys', team: 'ally',
    spriteKey: 'spr', atkRange: 1, skills: [], passiveEffects: [],
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 10, skl: 5,
    x: 0, y: 0, facing: 'S',
    currentAP: 5, maxAP: 5, ct: 0,
    moved: false, acted: false, buffs: [], level: 1, exp: 0,
    equipment: { weapon: null, armor: null, accessory: null },
    ...overrides,
  };
}

const testEquipMap: Record<string, EquipmentData> = {
  iron_sword: {
    id: 'iron_sword', name: 'Iron Sword', desc: 'Basic sword',
    slot: 'weapon', statBonus: { atk: 5 }, tags: ['blade'], price: 300,
  },
  chain_mail: {
    id: 'chain_mail', name: 'Chain Mail', desc: 'Heavy armor',
    slot: 'armor', statBonus: { def: 6, spd: -1 }, price: 500,
  },
  swift_boots: {
    id: 'swift_boots', name: 'Swift Boots', desc: 'Move +1',
    slot: 'accessory', statBonus: {}, movBonus: 1, price: 800,
  },
  mage_staff: {
    id: 'mage_staff', name: 'Mage Staff', desc: 'Mage only',
    slot: 'weapon', statBonus: { atk: 3 }, classRestriction: ['mage'], price: 400,
  },
  fire_ring: {
    id: 'fire_ring', name: 'Fire Ring', desc: 'Fire boost',
    slot: 'accessory', statBonus: {},
    passiveEffects: [{ name: 'FireBoost', type: 'DamageBoost', trigger: 'OnActiveUse', target: 'Self', conditions: [], payload: { stat: 'atk', amount: 10 }, priority: 10 }],
    price: 1500,
  },
};

// ── Tests ──

describe('canEquip', () => {
  it('returns true when no class restriction', () => {
    expect(canEquip(makeUnit(), testEquipMap['iron_sword']!)).toBe(true);
  });

  it('returns true when job matches restriction', () => {
    expect(canEquip(makeUnit({ job: 'mage' }), testEquipMap['mage_staff']!)).toBe(true);
  });

  it('returns false when job does not match restriction', () => {
    expect(canEquip(makeUnit({ job: 'warrior' }), testEquipMap['mage_staff']!)).toBe(false);
  });
});

describe('equip / unequip', () => {
  it('equips an item to the correct slot', () => {
    const unit = equip(makeUnit(), 'iron_sword', 'weapon');
    expect(unit.equipment.weapon).toBe('iron_sword');
  });

  it('replaces existing item in slot', () => {
    let unit = equip(makeUnit(), 'iron_sword', 'weapon');
    unit = equip(unit, 'mage_staff', 'weapon');
    expect(unit.equipment.weapon).toBe('mage_staff');
  });

  it('unequips an item from a slot', () => {
    let unit = equip(makeUnit(), 'iron_sword', 'weapon');
    unit = unequip(unit, 'weapon');
    expect(unit.equipment.weapon).toBeNull();
  });
});

describe('getEquipmentBonuses', () => {
  it('returns zero bonuses with no equipment', () => {
    const bonus = getEquipmentBonuses(makeUnit(), testEquipMap);
    expect(bonus.atk).toBe(0);
    expect(bonus.def).toBe(0);
    expect(bonus.mov).toBe(0);
  });

  it('sums bonuses from all equipped items', () => {
    const unit = makeUnit({
      equipment: { weapon: 'iron_sword', armor: 'chain_mail', accessory: 'swift_boots' },
    });
    const bonus = getEquipmentBonuses(unit, testEquipMap);
    expect(bonus.atk).toBe(5);  // sword
    expect(bonus.def).toBe(6);  // chain mail
    expect(bonus.spd).toBe(-1); // chain mail penalty
    expect(bonus.mov).toBe(1);  // boots
  });
});

describe('getEffectiveStats', () => {
  it('adds equipment bonuses to base stats', () => {
    const unit = makeUnit({
      atk: 20, def: 10,
      equipment: { weapon: 'iron_sword', armor: 'chain_mail', accessory: null },
    });
    const stats = getEffectiveStats(unit, testEquipMap);
    expect(stats.atk).toBe(25); // 20 + 5
    expect(stats.def).toBe(16); // 10 + 6
  });
});

describe('getEquipmentPassives', () => {
  it('returns empty array with no equipment', () => {
    expect(getEquipmentPassives(makeUnit(), testEquipMap)).toHaveLength(0);
  });

  it('collects passive effects from equipped items', () => {
    const unit = makeUnit({
      equipment: { weapon: null, armor: null, accessory: 'fire_ring' },
    });
    const passives = getEquipmentPassives(unit, testEquipMap);
    expect(passives).toHaveLength(1);
    expect(passives[0]!.name).toBe('FireBoost');
  });
});
