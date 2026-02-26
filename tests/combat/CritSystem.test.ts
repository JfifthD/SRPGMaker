import { describe, it, expect, vi, afterEach } from 'vitest';
import { CritSystem } from '@/engine/systems/combat/CritSystem';
import type { UnitInstance } from '@/engine/data/types/Unit';

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1',
    name: 'T', job: 'J', affinity: 'phys', team: 'ally',
    spriteKey: 'warrior', atkRange: 1,
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 5, skl: 10,
    x: 0, y: 0, facing: 'S',
    currentAP: 0, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null },
    skills: [], passiveEffects: [], aiType: 'aggressive',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CritSystem.baseChance', () => {
  it('returns 10% base + SKL bonus', () => {
    const unit = makeUnit({ skl: 0 });
    expect(CritSystem.baseChance(unit)).toBeCloseTo(0.1);
  });

  it('SKL=200 adds +100% (total 110%)', () => {
    const unit = makeUnit({ skl: 200 });
    expect(CritSystem.baseChance(unit)).toBeCloseTo(1.1);
  });

  it('SKL=20 adds +10% (total 20%)', () => {
    const unit = makeUnit({ skl: 20 });
    expect(CritSystem.baseChance(unit)).toBeCloseTo(0.2);
  });
});

describe('CritSystem.roll', () => {
  it('returns true when Math.random() is below baseChance', () => {
    const unit = makeUnit({ skl: 0 }); // baseChance = 0.10
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 < 0.10
    expect(CritSystem.roll(unit)).toBe(true);
  });

  it('returns false when Math.random() is above baseChance', () => {
    const unit = makeUnit({ skl: 0 }); // baseChance = 0.10
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 >= 0.10
    expect(CritSystem.roll(unit)).toBe(false);
  });

  it('returns true when random exactly equals 0 (always crits)', () => {
    const unit = makeUnit({ skl: 0 });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(CritSystem.roll(unit)).toBe(true);
  });
});

describe('CritSystem.MULTIPLIER', () => {
  it('is 1.8', () => {
    expect(CritSystem.MULTIPLIER).toBe(1.8);
  });
});
