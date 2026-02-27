// ─────────────────────────────────────────────
//  Integration: SkillAction + FacingAction pipeline
//  Covers heal, buff, damage skill types, and facing change.
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillAction } from '@/engine/state/actions/SkillAction';
import { FacingAction } from '@/engine/state/actions/FacingAction';
import { EventBus } from '@/engine/utils/EventBus';
import { buildStore, makeUnitData } from './helpers';
import type { SkillData } from '@/engine/data/types/Skill';

vi.mock('@/engine/systems/save/SaveManager', () => ({
  SaveManager: { save: vi.fn(), load: vi.fn() },
}));

// ── Skill fixtures ───────────────────────────

const HEAL_SKILL: SkillData = {
  id: 'test_heal', name: 'Heal', type: 'heal',
  target: 'ally', mp: 5, ap: 2, range: 2, aoe: false,
  healVal: 10, desc: '', tags: [],
};

const BUFF_SKILL: SkillData = {
  id: 'test_buff', name: 'Fortify', type: 'buff',
  target: 'ally', mp: 3, ap: 2, range: 2, aoe: false,
  buffStat: 'def', buffVal: 4, buffDur: 2, desc: '', tags: [],
};

const DAMAGE_SKILL: SkillData = {
  id: 'test_magic', name: 'Fireball', type: 'magic',
  target: 'enemy', mp: 8, ap: 3, range: 3, aoe: true, mult: 1.5,
  desc: '', tags: [],
};

const DEBUFF_SKILL: SkillData = {
  id: 'test_debuff', name: 'Weaken', type: 'debuff',
  target: 'enemy', mp: 4, ap: 2, range: 2, aoe: false,
  buffStat: 'atk', buffVal: -3, buffDur: 2, desc: '', tags: [],
};

const LETHAL_SKILL: SkillData = {
  id: 'test_lethal', name: 'Devastate', type: 'magic',
  target: 'enemy', mp: 5, ap: 3, range: 3, aoe: false, mult: 5.0,
  desc: '', tags: [],
};

// ── Helpers ──────────────────────────────────

function makeSetup() {
  const caster = makeUnitData('caster', 'ally', {
    baseStats: { hp: 30, mp: 20, atk: 10, def: 5, spd: 6, skl: 5, maxAP: 5 },
  });
  const ally2 = makeUnitData('ally2', 'ally', {
    baseStats: { hp: 20, mp: 10, atk: 8, def: 4, spd: 5, skl: 4, maxAP: 5 },
  });
  const enemy = makeUnitData('s_enemy', 'enemy', {
    baseStats: { hp: 30, mp: 5, atk: 6, def: 3, spd: 4, skl: 3, maxAP: 5 },
  });
  return buildStore(
    [{ data: caster, x: 2, y: 2 }, { data: ally2, x: 3, y: 2 }],
    [{ data: enemy, x: 5, y: 2 }],
  );
}

describe('SkillAction — heal', () => {
  beforeEach(() => { EventBus.clear(); });

  it('heal skill restores HP up to maxHp', () => {
    const { store, allyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const targetId = allyIds[1]!;

    // Damage the target first
    store.dispatchAsync(null, draft => { draft.units[targetId]!.hp = 5; });
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const target = store.getState().units[targetId]!;
    store.dispatch(new SkillAction(casterId, HEAL_SKILL, target.x, target.y, [target]));

    const afterHp = store.getState().units[targetId]!.hp;
    expect(afterHp).toBe(15); // 5 + healVal(10) = 15
  });

  it('heal does not exceed maxHp', () => {
    const { store, allyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const targetId = allyIds[1]!;

    // Target already near full health
    store.dispatchAsync(null, draft => { draft.units[targetId]!.hp = 18; }); // maxHp = 20
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const target = store.getState().units[targetId]!;
    store.dispatch(new SkillAction(casterId, HEAL_SKILL, target.x, target.y, [target]));

    const afterHp = store.getState().units[targetId]!.hp;
    expect(afterHp).toBe(20); // Capped at maxHp
  });

  it('caster MP is reduced by skill cost', () => {
    const { store, allyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const targetId = allyIds[1]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const target = store.getState().units[targetId]!;
    store.dispatch(new SkillAction(casterId, HEAL_SKILL, target.x, target.y, [target]));

    expect(store.getState().units[casterId]!.mp).toBe(15); // 20 - 5
  });

  it('skill with insufficient MP is rejected (state unchanged)', () => {
    const { store, allyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const targetId = allyIds[1]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 0; }); // No MP

    const targetBefore = store.getState().units[targetId]!.hp;
    const target = store.getState().units[targetId]!;
    store.dispatch(new SkillAction(casterId, HEAL_SKILL, target.x, target.y, [target]));

    expect(store.getState().units[targetId]!.hp).toBe(targetBefore); // No change
  });

  it('caster is marked as acted after skill', () => {
    const { store, allyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const targetId = allyIds[1]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const target = store.getState().units[targetId]!;
    store.dispatch(new SkillAction(casterId, HEAL_SKILL, target.x, target.y, [target]));

    expect(store.getState().units[casterId]!.acted).toBe(true);
  });
});

describe('SkillAction — buff', () => {
  beforeEach(() => { EventBus.clear(); });

  it('buff skill applies stat buff to target', () => {
    const { store, allyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const targetId = allyIds[1]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const target = store.getState().units[targetId]!;
    store.dispatch(new SkillAction(casterId, BUFF_SKILL, target.x, target.y, [target]));

    const buffedUnit = store.getState().units[targetId]!;
    expect(buffedUnit.buffs).toHaveLength(1);
    expect(buffedUnit.buffs[0]!.stat).toBe('def');
    expect(buffedUnit.buffs[0]!.val).toBe(4);
  });
});

describe('SkillAction — damage', () => {
  beforeEach(() => { EventBus.clear(); });

  it('damage skill reduces enemy HP', () => {
    const { store, allyIds, enemyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const enemyId = enemyIds[0]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const enemy = store.getState().units[enemyId]!;
    const hpBefore = enemy.hp;

    store.dispatch(new SkillAction(casterId, DAMAGE_SKILL, enemy.x, enemy.y, [enemy]));

    expect(store.getState().units[enemyId]!.hp).toBeLessThan(hpBefore);
  });

  it('magic skill triggers unitDamaged event', () => {
    const { store, allyIds, enemyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const enemyId = enemyIds[0]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const damaged: any[] = [];
    EventBus.on('unitDamaged', p => damaged.push(p));

    const enemy = store.getState().units[enemyId]!;
    store.dispatch(new SkillAction(casterId, DAMAGE_SKILL, enemy.x, enemy.y, [enemy]));

    expect(damaged).toHaveLength(1);
    expect(damaged[0].dmg).toBeGreaterThan(0);
  });
});

describe('SkillAction — debuff', () => {
  beforeEach(() => { EventBus.clear(); });

  it('debuff skill applies negative stat buff to target', () => {
    const { store, allyIds, enemyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const enemyId = enemyIds[0]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const enemy = store.getState().units[enemyId]!;
    store.dispatch(new SkillAction(casterId, DEBUFF_SKILL, enemy.x, enemy.y, [enemy]));

    const debuffed = store.getState().units[enemyId]!;
    expect(debuffed.buffs).toHaveLength(1);
    expect(debuffed.buffs[0]!.stat).toBe('atk');
    expect(debuffed.buffs[0]!.val).toBe(-3);
  });

  it('debuff emits unitDebuffed event', () => {
    const { store, allyIds, enemyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const enemyId = enemyIds[0]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const events: any[] = [];
    EventBus.on('unitDebuffed', e => events.push(e));

    const enemy = store.getState().units[enemyId]!;
    store.dispatch(new SkillAction(casterId, DEBUFF_SKILL, enemy.x, enemy.y, [enemy]));

    expect(events).toHaveLength(1);
    expect(events[0].stat).toBe('atk');
  });
});

describe('SkillAction — kill', () => {
  beforeEach(() => { EventBus.clear(); });

  it('lethal damage emits unitDefeated event', () => {
    const { store, allyIds, enemyIds } = makeSetup();
    const casterId = allyIds[0]!;
    const enemyId = enemyIds[0]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.mp = 20; });

    const defeats: any[] = [];
    EventBus.on('unitDefeated', e => defeats.push(e));

    const enemy = store.getState().units[enemyId]!;
    store.dispatch(new SkillAction(casterId, LETHAL_SKILL, enemy.x, enemy.y, [enemy]));

    expect(defeats).toHaveLength(1);
    expect(store.getState().units[enemyId]!.hp).toBe(0);
  });
});

describe('FacingAction pipeline', () => {
  beforeEach(() => { EventBus.clear(); });

  it('changes unit facing to specified direction', () => {
    const allyData = makeUnitData('facer', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 2, y: 2 }],
      [],
    );

    store.dispatch(new FacingAction(allyIds[0]!, 'N'));
    expect(store.getState().units[allyIds[0]!]!.facing).toBe('N');

    store.dispatch(new FacingAction(allyIds[0]!, 'E'));
    expect(store.getState().units[allyIds[0]!]!.facing).toBe('E');

    store.dispatch(new FacingAction(allyIds[0]!, 'W'));
    expect(store.getState().units[allyIds[0]!]!.facing).toBe('W');
  });

  it('FacingAction on non-existent unit is a no-op', () => {
    const allyData = makeUnitData('facer2', 'ally');
    const enemyData = makeUnitData('dummy_e', 'enemy');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [{ data: enemyData, x: 4, y: 4 }],
    );

    const facingBefore = store.getState().units[allyIds[0]!]!.facing;
    store.dispatch(new FacingAction('__ghost__', 'N'));

    // Real unit's facing is unchanged — action had no effect on valid units
    expect(store.getState().units[allyIds[0]!]!.facing).toBe(facingBefore);
  });
});
