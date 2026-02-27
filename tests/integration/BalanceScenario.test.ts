// ─────────────────────────────────────────────
//  Integration: Balance Verification
//  Pins expected damage numbers for specific stat matchups.
//  Mock MathUtils.rand for deterministic results.
//
//  Setup convention for FRONT hit (no angle bonus):
//    attacker at (0, 1), defender at (0, 0) facing 'S' (default).
//    attackDir = 'N', defenderFacing = 'S' = oppStr['N'] → FRONT.
//
//  With MathUtils.rand mocked to 0.5:
//    no crit (0.5 > any reasonable critChance)
//    variance = 0.88 + 0.5 * 0.24 = 1.0  (exact base damage)
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { MathUtils } from '@/engine/utils/MathUtils';
import { EventBus } from '@/engine/utils/EventBus';
import { DamageCalc } from '@/engine/systems/combat/DamageCalc';
import { buildStore, makeUnitData, PLAIN } from './helpers';
import type { EquipmentData } from '@/engine/data/types/Equipment';

vi.mock('@/engine/systems/save/SaveManager', () => ({
  SaveManager: { save: vi.fn(), load: vi.fn() },
}));

// ── Helpers ──────────────────────────────────

/**
 * Expected damage formula (FRONT hit, no crit, variance = 1.0):
 *   dmg = round(max(1, att.atk - def.def * 0.6) * affMult)
 * phys vs phys affMult = 1.0
 */
function expectedDmg(atk: number, def: number): number {
  return Math.round(Math.max(1, atk - def * 0.6));
}

describe('Balance — basic combat (FRONT, no crit, variance=1.0)', () => {
  beforeEach(() => {
    EventBus.clear();
    // Pin RNG: no crit, exact variance
    vi.spyOn(MathUtils, 'rand').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Soldier Lv1 (atk=8) vs Soldier Lv1 (def=5) → 5 damage on plain terrain', () => {
    const att = makeUnitData('s_att', 'ally', { baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 5 } });
    const def = makeUnitData('s_def', 'enemy', { baseStats: { hp: 20, mp: 5, atk: 6, def: 5, spd: 4, skl: 3, maxAP: 5 } });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: att, x: 0, y: 1 }],
      [{ data: def, x: 0, y: 0 }],
    );

    const expectedHp = 20 - expectedDmg(8, 5); // 20 - 5 = 15

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    expect(store.getState().units[enemyIds[0]!]!.hp).toBe(expectedHp);
  });

  it('high-atk vs zero-def → at least (atk) damage', () => {
    const att = makeUnitData('hiatt', 'ally', { baseStats: { hp: 30, mp: 5, atk: 15, def: 5, spd: 6, skl: 5, maxAP: 5 } });
    const def = makeUnitData('nodef', 'enemy', { baseStats: { hp: 30, mp: 5, atk: 6, def: 0, spd: 4, skl: 3, maxAP: 5 } });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: att, x: 0, y: 1 }],
      [{ data: def, x: 0, y: 0 }],
    );

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    const dmgDealt = 30 - store.getState().units[enemyIds[0]!]!.hp;
    expect(dmgDealt).toBe(expectedDmg(15, 0)); // 15
  });

  it('damage is at least 1 when def >> atk (armor tank)', () => {
    const att = makeUnitData('weakatt', 'ally', { baseStats: { hp: 20, mp: 5, atk: 2, def: 5, spd: 6, skl: 5, maxAP: 5 } });
    const def = makeUnitData('armored', 'enemy', { baseStats: { hp: 50, mp: 5, atk: 6, def: 30, spd: 4, skl: 3, maxAP: 5 } });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: att, x: 0, y: 1 }],
      [{ data: def, x: 0, y: 0 }],
    );

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    const dmgDealt = 50 - store.getState().units[enemyIds[0]!]!.hp;
    expect(dmgDealt).toBeGreaterThanOrEqual(1); // Minimum 1 damage guaranteed
  });

  it('equipment +2 atk increases damage by exactly 2', () => {
    const sword: EquipmentData = {
      id: 'iron_sword', name: 'Iron Sword', desc: 'Test sword', slot: 'weapon',
      statBonus: { atk: 2 },
    };

    const att = makeUnitData('equipped', 'ally', { baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 5 } });
    const def = makeUnitData('target', 'enemy', { baseStats: { hp: 20, mp: 5, atk: 6, def: 5, spd: 4, skl: 3, maxAP: 5 } });

    const { store, allyIds, enemyIds } = buildStore(
      [{ data: att, x: 0, y: 1 }],
      [{ data: def, x: 0, y: 0 }],
    );

    // Equip sword on ally (equipment.weapon is the itemId string)
    store.dispatchAsync(null, draft => {
      draft.units[allyIds[0]!]!.equipment.weapon = 'iron_sword';
      draft.gameProject.equipmentMap['iron_sword'] = sword;
    });

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    const dmgWithEquip = 20 - store.getState().units[enemyIds[0]!]!.hp;
    const dmgWithout = expectedDmg(8, 5); // 5
    const dmgExpected = expectedDmg(10, 5); // 7

    expect(dmgWithEquip).toBe(dmgExpected);
    expect(dmgWithEquip - dmgWithout).toBe(2);
  });

  it('forest terrain (+1 def) reduces damage by calculated amount', () => {
    const att = makeUnitData('forest_att', 'ally', { baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 5 } });
    const def = makeUnitData('forest_def', 'enemy', { baseStats: { hp: 20, mp: 5, atk: 6, def: 5, spd: 4, skl: 3, maxAP: 5 } });

    // Place defender in forest at (0,0)
    const grid = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => (x === 0 && y === 0 ? 'forest' : 'plain'))
    );

    const { store, allyIds, enemyIds } = buildStore(
      [{ data: att, x: 0, y: 1 }],
      [{ data: def, x: 0, y: 0 }],
      { terrainGrid: grid },
    );

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    const dmgDealt = 20 - store.getState().units[enemyIds[0]!]!.hp;
    const expectedPlain = expectedDmg(8, 5); // 5 on plain

    // Forest provides more defense than plain → damage is lower
    expect(dmgDealt).toBeLessThan(expectedPlain);
    // Always at least 1 damage
    expect(dmgDealt).toBeGreaterThanOrEqual(1);
  });

  it('DamageCalc.preview() matches actual dispatch result', () => {
    const attData = makeUnitData('preview_att', 'ally', { baseStats: { hp: 20, mp: 5, atk: 10, def: 5, spd: 6, skl: 5, maxAP: 5 } });
    const defData = makeUnitData('preview_def', 'enemy', { baseStats: { hp: 30, mp: 5, atk: 6, def: 8, spd: 4, skl: 3, maxAP: 5 } });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: attData, x: 0, y: 1 }],
      [{ data: defData, x: 0, y: 0 }],
    );

    const state = store.getState();
    const attUnit = state.units[allyIds[0]!]!;
    const defUnit = state.units[enemyIds[0]!]!;

    // Get DamageCalc preview prediction
    const preview = DamageCalc.preview(attUnit, defUnit, { mult: 1.0, type: 'phys' }, PLAIN, PLAIN);

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    const dmgDealt = 30 - store.getState().units[enemyIds[0]!]!.hp;

    // Actual damage should be within ±12% of preview baseDmg (variance range)
    // With rand=0.5, variance = exactly 1.0, so dmg should equal baseDmg
    expect(dmgDealt).toBe(preview.baseDmg);
  });
});
