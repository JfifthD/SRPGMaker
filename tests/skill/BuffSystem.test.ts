import { describe, it, expect } from 'vitest';
import { BuffSystem } from '@/engine/systems/skill/BuffSystem';
import type { UnitInstance } from '@/engine/data/types/Unit';

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1',
    name: 'Test', job: 'Fighter',
    affinity: 'phys', team: 'ally',
    spriteKey: 'warrior', atkRange: 1,
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 5, skl: 10,
    x: 0, y: 0, facing: 'S',
    currentAP: 0, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1,
    skills: [], passiveEffects: [],
    ...overrides,
  };
}

describe('BuffSystem.apply', () => {
  it('adds the buff to unit buffs array', () => {
    const unit = makeUnit();
    const result = BuffSystem.apply(unit, 'atk', 5, 2);
    expect(result.buffs).toHaveLength(1);
    expect(result.buffs[0]).toEqual({ stat: 'atk', val: 5, dur: 2 });
  });

  it('increases the stat by val', () => {
    const unit = makeUnit({ atk: 20 });
    const result = BuffSystem.apply(unit, 'atk', 5, 2);
    expect(result.atk).toBe(25);
  });

  it('can apply negative value (debuff)', () => {
    const unit = makeUnit({ def: 10 });
    const result = BuffSystem.apply(unit, 'def', -3, 1);
    expect(result.def).toBe(7);
    expect(result.buffs[0]).toEqual({ stat: 'def', val: -3, dur: 1 });
  });

  it('is immutable — does not mutate the original unit', () => {
    const unit = makeUnit({ atk: 20 });
    BuffSystem.apply(unit, 'atk', 5, 2);
    expect(unit.atk).toBe(20);
    expect(unit.buffs).toHaveLength(0);
  });

  it('can stack multiple buffs', () => {
    const unit = makeUnit({ atk: 10 });
    const after1 = BuffSystem.apply(unit, 'atk', 5, 2);
    const after2 = BuffSystem.apply(after1, 'atk', 3, 1);
    expect(after2.buffs).toHaveLength(2);
    expect(after2.atk).toBe(18);
  });
});

describe('BuffSystem.tick', () => {
  it('returns the same unit reference if no buffs', () => {
    const unit = makeUnit({ buffs: [] });
    const result = BuffSystem.tick(unit);
    expect(result).toBe(unit);
  });

  it('decrements buff duration by 1', () => {
    const unit = makeUnit({ atk: 25, buffs: [{ stat: 'atk', val: 5, dur: 2 }] });
    const result = BuffSystem.tick(unit);
    expect(result.buffs[0]!.dur).toBe(1);
  });

  it('removes buff when duration hits 0', () => {
    const unit = makeUnit({ atk: 25, buffs: [{ stat: 'atk', val: 5, dur: 1 }] });
    const result = BuffSystem.tick(unit);
    expect(result.buffs).toHaveLength(0);
  });

  it('reverts stat when buff expires', () => {
    const unit = makeUnit({ atk: 25, buffs: [{ stat: 'atk', val: 5, dur: 1 }] });
    const result = BuffSystem.tick(unit);
    expect(result.atk).toBe(20);
  });

  it('keeps stat at minimum 0 when reverting a debuff that would go negative', () => {
    // def is 2, reverting +5 buff → would be -3, clamped to 0
    const unit = makeUnit({ def: 2, buffs: [{ stat: 'def', val: 5, dur: 1 }] });
    const result = BuffSystem.tick(unit);
    expect(result.def).toBeGreaterThanOrEqual(0);
  });

  it('keeps non-expired buffs in the array', () => {
    const unit = makeUnit({
      atk: 28,
      buffs: [
        { stat: 'atk', val: 3, dur: 1 }, // expires
        { stat: 'atk', val: 5, dur: 2 }, // stays
      ],
    });
    const result = BuffSystem.tick(unit);
    expect(result.buffs).toHaveLength(1);
    expect(result.buffs[0]!.dur).toBe(1);
  });

  it('is immutable — does not mutate the original unit', () => {
    const unit = makeUnit({ atk: 25, buffs: [{ stat: 'atk', val: 5, dur: 2 }] });
    BuffSystem.tick(unit);
    expect(unit.buffs[0]!.dur).toBe(2); // original unchanged
  });
});
