// ─────────────────────────────────────────────
//  Integration: Turn Flow
//  Tests CT-based turn queue, phase transitions, AP refresh.
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WaitAction } from '@/engine/state/actions/WaitAction';
import { EventBus } from '@/engine/utils/EventBus';
import { buildStore, makeUnitData, advanceTurnUntil } from './helpers';

vi.mock('@/engine/systems/save/SaveManager', () => ({
  SaveManager: { save: vi.fn(), load: vi.fn() },
}));

describe('Turn flow', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  it('nextTurn advances until fastest unit acts first', () => {
    // fast ally (spd=10) and slow enemy (spd=4)
    const fastAlly = makeUnitData('fast', 'ally', {
      baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 10, skl: 5, maxAP: 5 },
    });
    const slowEnemy = makeUnitData('slow', 'enemy', {
      baseStats: { hp: 20, mp: 5, atk: 6, def: 5, spd: 4, skl: 3, maxAP: 5 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: fastAlly, x: 0, y: 0 }],
      [{ data: slowEnemy, x: 4, y: 4 }],
    );

    store.nextTurn();
    const state = store.getState();

    // Fast ally should go first
    expect(state.activeUnitId).toBe(allyIds[0]);
    expect(state.phase).toBe('PLAYER_IDLE');
  });

  it('nextTurn restores full AP to active unit', () => {
    const allyData = makeUnitData('ap_test', 'ally', {
      baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 8, skl: 5, maxAP: 6 },
    });
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [],
    );

    store.nextTurn();
    const unit = store.getState().units[allyIds[0]!]!;

    expect(unit.currentAP).toBe(unit.maxAP);
  });

  it('after ally waits, nextTurn gives enemy their turn', () => {
    const ally = makeUnitData('ally_w', 'ally', {
      baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 5 },
    });
    const enemy = makeUnitData('enemy_w', 'enemy', {
      baseStats: { hp: 20, mp: 5, atk: 6, def: 5, spd: 6, skl: 3, maxAP: 5 },
    });
    const { store, allyIds, enemyIds } = buildStore(
      [{ data: ally, x: 0, y: 0 }],
      [{ data: enemy, x: 4, y: 4 }],
    );

    // Get ally's turn
    advanceTurnUntil(store, s => s.activeUnitId === allyIds[0] && s.phase === 'PLAYER_IDLE');

    // Ally waits
    store.dispatch(new WaitAction(allyIds[0]!));

    // Advance until enemy gets a turn
    advanceTurnUntil(store, s => s.activeUnitId === enemyIds[0] && s.phase === 'ENEMY_PHASE');

    const state = store.getState();
    expect(state.activeUnitId).toBe(enemyIds[0]);
    expect(state.phase).toBe('ENEMY_PHASE');
  });

  it('active unit CT is reset to 0 after their turn starts', () => {
    const allyData = makeUnitData('ct_reset', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [],
    );

    store.nextTurn();
    const unit = store.getState().units[allyIds[0]!]!;

    // CT should be < 100 after subtraction (the unit used their turn)
    expect(unit.ct).toBeLessThan(100);
  });

  it('unit moved/acted flags are reset at turn start', () => {
    const allyData = makeUnitData('flag_reset', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [],
    );

    store.nextTurn();
    const unit = store.getState().units[allyIds[0]!]!;

    expect(unit.moved).toBe(false);
    expect(unit.acted).toBe(false);
  });

  it('store emits turnStarted event with correct data', () => {
    const allyData = makeUnitData('event_test', 'ally');
    const { store, allyIds } = buildStore(
      [{ data: allyData, x: 0, y: 0 }],
      [],
    );

    const emitted: any[] = [];
    EventBus.on('turnStarted', payload => emitted.push(payload));

    store.nextTurn();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].activeUnitId).toBe(allyIds[0]);
    expect(emitted[0].phase).toBe('player');
  });
});
