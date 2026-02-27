// ─────────────────────────────────────────────
//  Integration: Attack Action Pipeline
//  Tests full dispatch → state transition → EXP grant lifecycle.
//  No browser, no Phaser. Pure API-driven.
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { MoveAction } from '@/engine/state/actions/MoveAction';
import { WaitAction } from '@/engine/state/actions/WaitAction';
import { MathUtils } from '@/engine/utils/MathUtils';
import { EventBus } from '@/engine/utils/EventBus';
import { buildStore, makeUnitData } from './helpers';

// Prevent IndexedDB errors from auto-save in Node environment
vi.mock('@/engine/systems/save/SaveManager', () => ({
  SaveManager: { save: vi.fn(), load: vi.fn() },
}));

// ── Test setup ──────────────────────────────

function makeCombatPair() {
  // ally at (0, 1) attacks enemy at (0, 0)
  // Enemy default facing = 'S' (toward attacker) → FRONT hit (no angle bonus)
  const allyData = makeUnitData('ally1', 'ally', { baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 5 } });
  const enemyData = makeUnitData('enemy1', 'enemy', { baseStats: { hp: 20, mp: 5, atk: 6, def: 5, spd: 4, skl: 3, maxAP: 5 } });
  return buildStore(
    [{ data: allyData, x: 0, y: 1 }],
    [{ data: enemyData, x: 0, y: 0 }],
  );
}

describe('AttackAction pipeline', () => {
  beforeEach(() => {
    EventBus.clear();
    vi.restoreAllMocks();
  });

  it('dispatching AttackAction reduces defender HP', () => {
    const { store, allyIds, enemyIds } = makeCombatPair();
    const allyId = allyIds[0]!;
    const enemyId = enemyIds[0]!;

    const before = store.getState().units[enemyId]!.hp;

    store.dispatch(new AttackAction(allyId, enemyId));

    const after = store.getState().units[enemyId]!.hp;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(0);
  });

  it('attacker is marked as acted after attack', () => {
    const { store, allyIds, enemyIds } = makeCombatPair();

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    expect(store.getState().units[allyIds[0]!]!.acted).toBe(true);
  });

  it('stateHistory grows by 1 after each dispatch', () => {
    const { store, allyIds, enemyIds } = makeCombatPair();
    expect(store.getState().stateHistory).toHaveLength(0);

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));
    expect(store.getState().stateHistory).toHaveLength(1);
  });

  it('does not change state if target is already dead', () => {
    const { store, allyIds, enemyIds } = makeCombatPair();
    // Kill enemy first
    store.dispatchAsync(null, draft => { draft.units[enemyIds[0]!]!.hp = 0; });
    const stateBefore = store.getState();

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    // State pointer should be the same (no change if target dead)
    expect(store.getState().units[enemyIds[0]!]!.hp).toBe(0);
    expect(store.getState().stateHistory).toHaveLength(0); // No new history entry
  });

  it('grants kill EXP to attacker when enemy is killed', () => {
    // Set up a one-shot kill: give ally high atk, enemy 1 hp
    const allyData = makeUnitData('ally_killer', 'ally', {
      baseStats: { hp: 30, mp: 5, atk: 20, def: 5, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemyData = makeUnitData('fodder', 'enemy', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 1, skl: 1, maxAP: 3 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: allyData, x: 0, y: 1 }],
      [{ data: enemyData, x: 0, y: 0 }],
    );

    const allyBefore = store.getState().units[allyIds[0]!]!;
    const expBefore = allyBefore.exp;

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    const allyAfter = store.getState().units[allyIds[0]!]!;
    expect(allyAfter.exp).toBeGreaterThan(expBefore);  // EXP gained
    expect(store.getState().units[enemyIds[0]!]!.hp).toBe(0);  // Enemy dead
  });

  it('attacker levels up when accumulated EXP exceeds threshold', () => {
    // Give ally 99 EXP — one kill should tip them over 100
    const allyData = makeUnitData('near_levelup', 'ally', {
      baseStats: { hp: 30, mp: 5, atk: 20, def: 5, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemyData = makeUnitData('fodder2', 'enemy', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 1, skl: 1, maxAP: 3 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: allyData, x: 0, y: 1 }],
      [{ data: enemyData, x: 0, y: 0 }],
    );

    // Seed ally with 99 EXP
    store.dispatchAsync(null, draft => { draft.units[allyIds[0]!]!.exp = 99; });

    const levelBefore = store.getState().units[allyIds[0]!]!.level;

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    const allyAfter = store.getState().units[allyIds[0]!]!;
    expect(allyAfter.level).toBe(levelBefore + 1);
    expect(allyAfter.hp).toBeGreaterThanOrEqual(allyData.baseStats.hp); // HP grew on level-up
  });
});

describe('MoveAction pipeline', () => {
  beforeEach(() => {
    EventBus.clear();
    vi.restoreAllMocks();
  });

  it('dispatching MoveAction updates unit position', () => {
    const allyData = makeUnitData('mover', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [],
    );

    store.dispatch(new MoveAction(allyIds[0]!, { x: 2, y: 0 }));

    const unit = store.getState().units[allyIds[0]!]!;
    expect(unit.x).toBe(2);
    expect(unit.y).toBe(0);
    expect(unit.moved).toBe(true);
  });

  it('MoveAction deducts AP via Manhattan cost when no path provided', () => {
    const allyData = makeUnitData('mover2', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [],
    );

    // Set currentAP
    store.dispatchAsync(null, draft => { draft.units[allyIds[0]!]!.currentAP = 5; });

    store.dispatch(new MoveAction(allyIds[0]!, { x: 2, y: 1 })); // Manhattan dist = 3

    const unit = store.getState().units[allyIds[0]!]!;
    expect(unit.currentAP).toBe(2); // 5 - 3 = 2
  });

  it('undoUnitMoves restores position and clears moved flag', () => {
    const allyData = makeUnitData('undoer', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [],
    );

    store.dispatchAsync(null, draft => { draft.units[allyIds[0]!]!.currentAP = 5; });
    store.dispatch(new MoveAction(allyIds[0]!, { x: 3, y: 0 }));

    const afterMove = store.getState().units[allyIds[0]!]!;
    expect(afterMove.x).toBe(3);
    expect(afterMove.moved).toBe(true);

    store.undoUnitMoves(allyIds[0]!);

    const afterUndo = store.getState().units[allyIds[0]!]!;
    expect(afterUndo.x).toBe(0);
    expect(afterUndo.moved).toBe(false);
    expect(store.getState().stateHistory).toHaveLength(0);
  });
});

describe('WaitAction pipeline', () => {
  it('WaitAction marks unit as acted and drains AP', () => {
    const allyData = makeUnitData('waiter', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 1, y: 1 }],
      [],
    );

    store.dispatchAsync(null, draft => { draft.units[allyIds[0]!]!.currentAP = 4; });
    store.dispatch(new WaitAction(allyIds[0]!));

    const unit = store.getState().units[allyIds[0]!]!;
    expect(unit.acted).toBe(true);
    expect(unit.moved).toBe(true);
    expect(unit.currentAP).toBe(0);
  });
});
