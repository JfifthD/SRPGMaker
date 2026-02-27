// ─────────────────────────────────────────────
//  Integration: Win / Loss Conditions
//  Tests checkWin() detection after dispatch sequences.
//  Victory and defeat events are verified via EventBus.
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { EventBus } from '@/engine/utils/EventBus';
import { buildStore, makeUnitData } from './helpers';

vi.mock('@/engine/systems/save/SaveManager', () => ({
  SaveManager: { save: vi.fn(), load: vi.fn() },
}));

describe('Win condition: defeat_all', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  it('kills all enemies → state.phase becomes VICTORY', () => {
    const ally = makeUnitData('v_ally', 'ally', {
      baseStats: { hp: 40, mp: 5, atk: 30, def: 5, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemy = makeUnitData('v_enemy', 'enemy', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 1, skl: 1, maxAP: 3 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: ally, x: 0, y: 1 }],
      [{ data: enemy, x: 0, y: 0 }],
    );

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    expect(store.getState().phase).toBe('VICTORY');
  });

  it('killing all enemies emits victory event', () => {
    const ally = makeUnitData('ve_ally', 'ally', {
      baseStats: { hp: 40, mp: 5, atk: 30, def: 5, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemy = makeUnitData('ve_enemy', 'enemy', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 1, skl: 1, maxAP: 3 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: ally, x: 0, y: 1 }],
      [{ data: enemy, x: 0, y: 0 }],
    );

    const victoryEvents: any[] = [];
    EventBus.on('victory', p => victoryEvents.push(p));

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!));

    expect(victoryEvents).toHaveLength(1);
    expect(victoryEvents[0].turn).toBeGreaterThanOrEqual(1);
  });

  it('killing one of two enemies does NOT trigger victory', () => {
    const ally = makeUnitData('multi_ally', 'ally', {
      baseStats: { hp: 40, mp: 5, atk: 30, def: 5, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemy1 = makeUnitData('multi_e1', 'enemy', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 1, skl: 1, maxAP: 3 },
    });
    const enemy2 = makeUnitData('multi_e2', 'enemy', {
      baseStats: { hp: 20, mp: 5, atk: 6, def: 5, spd: 4, skl: 3, maxAP: 5 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: ally, x: 0, y: 1 }],
      [{ data: enemy1, x: 0, y: 0 }, { data: enemy2, x: 4, y: 4 }],
    );

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!)); // Kill enemy1

    // Enemy2 still alive → no victory
    expect(store.getState().phase).not.toBe('VICTORY');
    expect(store.getState().units[enemyIds[1]!]!.hp).toBeGreaterThan(0);
  });
});

describe('Loss condition: all_allies_dead', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  it('all allies defeated → state.phase becomes DEFEAT', () => {
    const ally = makeUnitData('d_ally', 'ally', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemy = makeUnitData('d_enemy', 'enemy', {
      baseStats: { hp: 40, mp: 5, atk: 30, def: 5, spd: 4, skl: 3, maxAP: 5 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: ally, x: 0, y: 1 }],
      [{ data: enemy, x: 0, y: 0 }],
    );

    // Enemy attacks ally (use dispatchAsync to swap positions mentally — just kill ally directly)
    store.dispatchAsync(null, draft => {
      draft.units[allyIds[0]!]!.hp = 0;
    });

    // Trigger checkWin via a no-op dispatch
    store.dispatch(new AttackAction('__nonexistent__', '__nonexistent__'));

    expect(store.getState().phase).toBe('DEFEAT');
  });

  it('defeat emits defeat event', () => {
    const ally = makeUnitData('de_ally', 'ally', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemy = makeUnitData('de_enemy', 'enemy', {
      baseStats: { hp: 40, mp: 5, atk: 30, def: 5, spd: 4, skl: 3, maxAP: 5 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: ally, x: 0, y: 1 }],
      [{ data: enemy, x: 4, y: 4 }],
    );

    const defeatEvents: any[] = [];
    EventBus.on('defeat', p => defeatEvents.push(p));

    store.dispatchAsync(null, draft => {
      draft.units[allyIds[0]!]!.hp = 0;
    });
    store.dispatch(new AttackAction('__nonexistent__', '__nonexistent__'));

    expect(defeatEvents).toHaveLength(1);
  });

  it('dispatching again after VICTORY does nothing (terminal state)', () => {
    const ally = makeUnitData('term_ally', 'ally', {
      baseStats: { hp: 40, mp: 5, atk: 30, def: 5, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemy = makeUnitData('term_enemy', 'enemy', {
      baseStats: { hp: 1, mp: 0, atk: 1, def: 0, spd: 1, skl: 1, maxAP: 3 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: ally, x: 0, y: 1 }],
      [{ data: enemy, x: 0, y: 0 }],
    );

    store.dispatch(new AttackAction(allyIds[0]!, enemyIds[0]!)); // → VICTORY
    expect(store.getState().phase).toBe('VICTORY');

    // nextTurn after victory should be a no-op
    const phaseBefore = store.getState().phase;
    store.nextTurn();
    expect(store.getState().phase).toBe(phaseBefore);
  });
});
