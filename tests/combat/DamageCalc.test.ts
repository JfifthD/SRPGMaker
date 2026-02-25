import { describe, it, expect } from 'vitest';
import { DamageCalc } from '@/engine/systems/combat/DamageCalc';
import { AffinityTable } from '@/engine/systems/combat/AffinityTable';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { TerrainData } from '@/engine/data/types/Terrain';
import { MathUtils } from '@/engine/utils/MathUtils';
import { vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ──────────────────────────────────
const plainTerrain: TerrainData = {
  key: 'plain', name: '평지', tileIndex: 0,
  defBonus: 0, atkBonus: 0, moveCost: 1, passable: true,
};
const forestTerrain: TerrainData = {
  key: 'forest', name: '숲', tileIndex: 1,
  defBonus: 3, atkBonus: 0, moveCost: 2, passable: true,
};

function makeUnit(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    dataId: 'test', instanceId: 'test',
    name: 'Test', job: 'Fighter',
    affinity: 'phys', team: 'ally',
    spriteKey: 'warrior', atkRange: 1,
    hp: 100, maxHp: 100, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 5, skl: 10,
    x: 0, y: 0, facing: 'S',
    currentAP: 0, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1,
    skills: [], passiveEffects: [], aiType: 'aggressive',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────

describe('DamageCalc', () => {
  beforeEach(() => {
    vi.spyOn(MathUtils, 'rand').mockReturnValue(0.5); // Fixed variance to 1.0 (0.88 + 0.5 * 0.24 = 1.0)
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deals at least 1 damage', () => {
    const att = makeUnit({ atk: 1 });
    const def = makeUnit({ def: 999 });
    const result = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, plainTerrain, false);
    expect(result.dmg).toBeGreaterThanOrEqual(1);
  });

  it('crit multiplies damage by ~1.8', () => {
    const att = makeUnit({ atk: 40, skl: 0 });
    const def = makeUnit({ def: 0 });

    const normal = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, plainTerrain, false);
    const crit   = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, plainTerrain, true);

    // Allow for variance: crit should be ~1.8× normal
    expect(crit.dmg / normal.dmg).toBeCloseTo(1.8, 0);
    expect(crit.crit).toBe(true);
  });

  it('ignoreDef bypasses defender DEF', () => {
    const att = makeUnit({ atk: 20 });
    const def = makeUnit({ def: 20 });

    const withDef    = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys', ignoreDef: false }, plainTerrain, plainTerrain, false);
    const ignoreDef  = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys', ignoreDef: true  }, plainTerrain, plainTerrain, false);

    expect(ignoreDef.dmg).toBeGreaterThan(withDef.dmg);
  });

  it('forest terrain DEF bonus reduces damage', () => {
    const att = makeUnit({ atk: 30 });
    const def = makeUnit({ def: 5 });

    const plain  = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, plainTerrain, false);
    const forest = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, forestTerrain, false);

    expect(forest.dmg).toBeLessThan(plain.dmg);
  });

  it('higher mult skill deals more damage', () => {
    const att = makeUnit({ atk: 20 });
    const def = makeUnit({ def: 0 });

    const base  = DamageCalc.calc(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, plainTerrain, false);
    const heavy = DamageCalc.calc(att, def, { mult: 1.7, type: 'phys' }, plainTerrain, plainTerrain, false);

    expect(heavy.dmg).toBeGreaterThan(base.dmg);
  });

  it('preview returns deterministic baseDmg', () => {
    const att = makeUnit({ atk: 20 });
    const def = makeUnit({ def: 10 });
    const p1 = DamageCalc.preview(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, plainTerrain);
    const p2 = DamageCalc.preview(att, def, { mult: 1.0, type: 'phys' }, plainTerrain, plainTerrain);
    expect(p1.baseDmg).toBe(p2.baseDmg);
  });
});

describe('AffinityTable', () => {
  it('holy vs dark is ×2.0', () => {
    expect(AffinityTable.get('holy', 'dark')).toBe(2.0);
  });

  it('dark vs holy is ×0.5', () => {
    expect(AffinityTable.get('dark', 'holy')).toBe(0.5);
  });

  it('same affinity vs self is ×1.0', () => {
    expect(AffinityTable.get('phys', 'phys')).toBe(1.0);
    expect(AffinityTable.get('magic', 'magic')).toBe(1.0);
  });

  it('returns 1.0 for unknown affinity', () => {
    // @ts-expect-error testing unknown value
    expect(AffinityTable.get('unknown', 'phys')).toBe(1.0);
  });
});
