import { describe, it, expect } from 'vitest';
import {
  calculateCombatEXP,
  calculateSupportEXP,
  processLevelUp,
  applyStatGains,
  grantEXP,
  distributeStageEXP,
  EXP_CONSTANTS,
} from '@/engine/systems/progression/LevelUpSystem';
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
    aiType: 'aggressive',
    equipment: { weapon: null, armor: null, accessory: null },
    ...overrides,
  };
}

const fullGrowth = { hp: 100, atk: 100, def: 100, spd: 100, skl: 100, mp: 100 };
const zeroGrowth = { hp: 0, atk: 0, def: 0, spd: 0, skl: 0, mp: 0 };

// ── Tests ──

describe('calculateCombatEXP', () => {
  it('returns base EXP for equal level (no kill)', () => {
    expect(calculateCombatEXP(5, 5, false)).toBe(EXP_CONSTANTS.BASE_ATTACK_EXP);
  });

  it('returns more EXP when enemy is higher level', () => {
    const exp = calculateCombatEXP(1, 5, false);
    expect(exp).toBeGreaterThan(EXP_CONSTANTS.BASE_ATTACK_EXP);
  });

  it('includes kill bonus when enemy is killed', () => {
    const noKill = calculateCombatEXP(5, 5, false);
    const withKill = calculateCombatEXP(5, 5, true);
    expect(withKill).toBeGreaterThan(noKill);
  });

  it('returns at least 1 EXP even if level difference is very negative', () => {
    expect(calculateCombatEXP(30, 1, false)).toBeGreaterThanOrEqual(1);
  });
});

describe('calculateSupportEXP', () => {
  it('returns base support EXP for rank 1', () => {
    expect(calculateSupportEXP(1)).toBe(EXP_CONSTANTS.BASE_SUPPORT_EXP + 2);
  });

  it('scales with skill rank', () => {
    expect(calculateSupportEXP(3)).toBeGreaterThan(calculateSupportEXP(1));
  });
});

describe('processLevelUp', () => {
  it('with 100% growth rates, all stats increase', () => {
    const gains = processLevelUp(fullGrowth, () => 0.5);
    expect(gains.hp).toBe(1);
    expect(gains.atk).toBe(1);
    expect(gains.def).toBe(1);
    expect(gains.spd).toBe(1);
    expect(gains.skl).toBe(1);
    expect(gains.mp).toBe(1);
  });

  it('with 0% growth rates, blessed level-up guarantees at least 1 stat', () => {
    const gains = processLevelUp(zeroGrowth, () => 0.99);
    const totalGains = gains.hp + gains.atk + gains.def + gains.spd + gains.skl + gains.mp;
    expect(totalGains).toBeGreaterThanOrEqual(1);
  });

  it('with 50% growth rates and high roll, some stats increase', () => {
    const gains = processLevelUp({ hp: 50, atk: 50 }, () => 0.3);
    // 0.3 * 100 = 30, which is < 50, so hp and atk should both gain
    expect(gains.hp).toBe(1);
    expect(gains.atk).toBe(1);
  });
});

describe('applyStatGains', () => {
  it('increases both current and max values', () => {
    const unit = makeUnit({ hp: 50, maxHp: 50, mp: 10, maxMp: 10 });
    const result = applyStatGains(unit, { hp: 1, atk: 1, def: 0, spd: 0, skl: 0, mp: 1 });
    expect(result.maxHp).toBe(51);
    expect(result.hp).toBe(51);
    expect(result.atk).toBe(21);
    expect(result.maxMp).toBe(11);
  });
});

describe('grantEXP', () => {
  it('accumulates EXP without level-up when below threshold', () => {
    const unit = makeUnit({ exp: 0 });
    const result = grantEXP(unit, 50, fullGrowth);
    expect(result.unit.exp).toBe(50);
    expect(result.unit.level).toBe(1);
    expect(result.levelUps).toHaveLength(0);
  });

  it('triggers level-up when EXP reaches threshold', () => {
    const unit = makeUnit({ exp: 0 });
    const result = grantEXP(unit, 100, fullGrowth, () => 0.5);
    expect(result.unit.level).toBe(2);
    expect(result.unit.exp).toBe(0);
    expect(result.levelUps).toHaveLength(1);
    expect(result.levelUps[0]!.previousLevel).toBe(1);
    expect(result.levelUps[0]!.newLevel).toBe(2);
  });

  it('handles multiple level-ups from large EXP grant', () => {
    const unit = makeUnit({ exp: 0 });
    const result = grantEXP(unit, 250, fullGrowth, () => 0.5);
    expect(result.unit.level).toBe(3);
    expect(result.unit.exp).toBe(50);
    expect(result.levelUps).toHaveLength(2);
  });

  it('caps at MAX_LEVEL', () => {
    const unit = makeUnit({ level: EXP_CONSTANTS.MAX_LEVEL, exp: 0 });
    const result = grantEXP(unit, 500, fullGrowth);
    expect(result.unit.level).toBe(EXP_CONSTANTS.MAX_LEVEL);
    expect(result.expGained).toBe(0);
  });

  it('stat gains accumulate across multiple level-ups', () => {
    const unit = makeUnit({ hp: 50, maxHp: 50, atk: 20, exp: 0 });
    const result = grantEXP(unit, 200, fullGrowth, () => 0.5);
    // 2 level-ups, all 100% growth → +2 to all stats
    expect(result.unit.maxHp).toBe(52);
    expect(result.unit.atk).toBe(22);
  });
});

describe('distributeStageEXP', () => {
  it('distributes clear bonus to all allies', () => {
    const allies = [makeUnit({ dataId: 'a' }), makeUnit({ dataId: 'b' })];
    const growthMap = { a: fullGrowth, b: fullGrowth };
    const results = distributeStageEXP(allies, growthMap);
    expect(results).toHaveLength(2);
    expect(results[0]!.expGained).toBe(EXP_CONSTANTS.CLEAR_BONUS);
    expect(results[1]!.expGained).toBe(EXP_CONSTANTS.CLEAR_BONUS);
  });
});
