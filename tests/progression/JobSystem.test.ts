import { describe, it, expect } from 'vitest';
import {
  canPromote,
  promote,
  getLearnableSkills,
  getModifiedGrowth,
  consumePromotionItems,
  MAX_CARRYOVER_SKILLS,
} from '@/engine/systems/progression/JobSystem';
import type { JobData } from '@/engine/data/types/Job';
import type { UnitInstance } from '@/engine/data/types/Unit';

// ── Helpers ──

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1', name: 'TestUnit',
    job: 'soldier', affinity: 'phys', team: 'ally',
    spriteKey: 'spr', atkRange: 1, skills: ['thrust', 'guard'], passiveEffects: [],
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 10, skl: 5,
    x: 0, y: 0, facing: 'S',
    currentAP: 5, maxAP: 5, ct: 0,
    moved: false, acted: false, buffs: [], level: 10, exp: 0,
    aiType: 'aggressive',
    equipment: { weapon: null, armor: null, accessory: null },
    ...overrides,
  };
}

const soldierJob: JobData = {
  id: 'soldier', name: '병사', desc: '기본 보병', tier: 1,
  statMod: { hp: 2, atk: 1, def: 1 },
  learnableSkills: [
    { skillId: 'thrust', requiredLevel: 1 },
    { skillId: 'guard', requiredLevel: 5 },
  ],
  promotionTargets: [
    { jobId: 'knight', requiredLevel: 10 },
    { jobId: 'halberdier', requiredLevel: 10, requiredItems: ['promotion_crest'] },
  ],
  equipTags: ['blade', 'spear'],
  growthMod: { hp: 5, def: 5 },
};

const knightJob: JobData = {
  id: 'knight', name: '기사', desc: '중장 기사', tier: 2,
  statMod: { hp: 5, atk: 2, def: 4, spd: -1 },
  learnableSkills: [
    { skillId: 'shield_bash', requiredLevel: 1 },
    { skillId: 'fortress', requiredLevel: 5 },
  ],
  equipTags: ['blade', 'heavy_armor'],
  growthMod: { hp: 10, def: 10 },
};

// ── Tests ──

describe('canPromote', () => {
  it('returns true when level requirement is met', () => {
    expect(canPromote(makeUnit({ level: 10 }), 'knight', soldierJob)).toBe(true);
  });

  it('returns false when level is too low', () => {
    expect(canPromote(makeUnit({ level: 5 }), 'knight', soldierJob)).toBe(false);
  });

  it('returns false when target job does not exist in promotions', () => {
    expect(canPromote(makeUnit({ level: 10 }), 'archmage', soldierJob)).toBe(false);
  });

  it('returns false when required items are missing', () => {
    expect(canPromote(makeUnit({ level: 10 }), 'halberdier', soldierJob)).toBe(false);
  });

  it('returns true when required items are in inventory', () => {
    expect(canPromote(makeUnit({ level: 10 }), 'halberdier', soldierJob, { promotion_crest: 1 })).toBe(true);
  });
});

describe('promote', () => {
  it('changes job to new class', () => {
    const result = promote(makeUnit(), knightJob, ['thrust']);
    expect(result.job).toBe('knight');
  });

  it('applies stat modifiers', () => {
    const unit = makeUnit({ hp: 50, maxHp: 50, atk: 20, def: 10, spd: 10 });
    const result = promote(unit, knightJob, []);
    expect(result.maxHp).toBe(55); // +5
    expect(result.atk).toBe(22);   // +2
    expect(result.def).toBe(14);   // +4
    expect(result.spd).toBe(9);    // -1
  });

  it('carries over specified skills (limited to MAX_CARRYOVER)', () => {
    const result = promote(makeUnit({ skills: ['a', 'b', 'c'] }), knightJob, ['a', 'b', 'c']);
    // Max 2 carry + shield_bash from knight level 1
    const carried = result.skills.filter(s => ['a', 'b'].includes(s));
    expect(carried).toHaveLength(2);
    expect(result.skills).toContain('shield_bash');
  });

  it('adds new job level-1 skills', () => {
    const result = promote(makeUnit(), knightJob, []);
    expect(result.skills).toContain('shield_bash');
  });

  it('deduplicates skills', () => {
    const result = promote(makeUnit(), knightJob, ['shield_bash']);
    const count = result.skills.filter(s => s === 'shield_bash').length;
    expect(count).toBe(1);
  });
});

describe('getLearnableSkills', () => {
  it('returns skills up to the given level', () => {
    expect(getLearnableSkills(1, soldierJob)).toEqual(['thrust']);
    expect(getLearnableSkills(5, soldierJob)).toEqual(['thrust', 'guard']);
  });

  it('returns empty for level 0', () => {
    expect(getLearnableSkills(0, soldierJob)).toEqual([]);
  });
});

describe('getModifiedGrowth', () => {
  it('adds job growth modifiers to base growth', () => {
    const base = { hp: 50, atk: 40, def: 30 };
    const result = getModifiedGrowth(base, soldierJob);
    expect(result['hp']).toBe(55);  // 50 + 5
    expect(result['def']).toBe(35); // 30 + 5
    expect(result['atk']).toBe(40); // no mod
  });
});

describe('consumePromotionItems', () => {
  it('removes required items from inventory', () => {
    const inv = { promotion_crest: 2, gold: 500 };
    const result = consumePromotionItems(inv, ['promotion_crest']);
    expect(result['promotion_crest']).toBe(1);
    expect(result['gold']).toBe(500);
  });

  it('deletes item entry when count reaches 0', () => {
    const inv = { promotion_crest: 1 };
    const result = consumePromotionItems(inv, ['promotion_crest']);
    expect(result['promotion_crest']).toBeUndefined();
  });
});
