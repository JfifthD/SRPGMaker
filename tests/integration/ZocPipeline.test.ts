// ─────────────────────────────────────────────
//  Integration: MoveAction + ZOC pipeline
//  Covers path traversal, ZOC interruption, and both halt branches.
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoveAction } from '@/engine/state/actions/MoveAction';
import { EventBus } from '@/engine/utils/EventBus';
import { buildStore, makeUnitData } from './helpers';

vi.mock('@/engine/systems/save/SaveManager', () => ({
  SaveManager: { save: vi.fn(), load: vi.fn() },
}));

describe('MoveAction — path traversal (no ZOC)', () => {
  beforeEach(() => { EventBus.clear(); });

  it('moves unit along full path when no enemies are nearby', () => {
    const ally = makeUnitData('pather', 'ally', {
      baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 6 },
    });
    const enemy = makeUnitData('far_e', 'enemy');

    const { store, allyIds } = buildStore(
      [{ data: ally, x: 0, y: 0 }],
      [{ data: enemy, x: 7, y: 7 }], // far corner — no ZOC
    );
    const casterId = allyIds[0]!;
    // units start with currentAP=0; simulate turn start
    store.dispatchAsync(null, draft => { draft.units[casterId]!.currentAP = 6; });

    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    store.dispatch(new MoveAction(casterId, { x: 2, y: 0 }, path, 2));

    const unit = store.getState().units[casterId]!;
    expect(unit.x).toBe(2);
    expect(unit.y).toBe(0);
    expect(unit.moved).toBe(true);
    expect(unit.currentAP).toBe(4); // 6 - 2
  });

  it('unitMoved event is emitted after path move', () => {
    const ally = makeUnitData('event_pather', 'ally');
    const enemy = makeUnitData('ev_e', 'enemy');

    const { store, allyIds } = buildStore(
      [{ data: ally, x: 0, y: 0 }],
      [{ data: enemy, x: 7, y: 7 }],
    );
    const casterId = allyIds[0]!;

    const moves: any[] = [];
    EventBus.on('unitMoved', e => moves.push(e));

    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    store.dispatch(new MoveAction(casterId, { x: 1, y: 0 }, path, 1));

    expect(moves).toHaveLength(1);
    expect(moves[0].toX).toBe(1);
  });

  it('transitions inputMode to facing when AP hits 0', () => {
    const ally = makeUnitData('ap_drainer', 'ally', {
      baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 2 },
    });
    const enemy = makeUnitData('ap_e', 'enemy');

    const { store, allyIds } = buildStore(
      [{ data: ally, x: 0, y: 0 }],
      [{ data: enemy, x: 7, y: 7 }],
    );
    const casterId = allyIds[0]!;
    store.dispatchAsync(null, draft => { draft.units[casterId]!.currentAP = 2; });

    // Move 2 tiles = exactly drains AP to 0 → inputMode transitions to 'facing'
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    store.dispatch(new MoveAction(casterId, { x: 2, y: 0 }, path, 2));

    expect(store.getState().inputMode).toBe('facing');
  });
});

describe('MoveAction — ZOC interruption (entered ZOC)', () => {
  beforeEach(() => { EventBus.clear(); });

  it('halts unit at first tile adjacent to enemy (enters ZOC)', () => {
    const ally = makeUnitData('zoc_mover', 'ally', {
      baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 6 },
    });
    // Default passiveEffects=[] → falls back to getDefaultPassives() → ZOC_NODE active
    const enemy = makeUnitData('zoc_enemy', 'enemy');

    const { store, allyIds } = buildStore(
      [{ data: ally, x: 0, y: 0 }],
      [{ data: enemy, x: 3, y: 0 }],
    );
    const casterId = allyIds[0]!;

    // Tries to pass through (2,0) — which is distance 1 from enemy at (3,0)
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }];
    store.dispatch(new MoveAction(casterId, { x: 4, y: 0 }, path, 4));

    const unit = store.getState().units[casterId]!;
    expect(unit.x).toBe(2);
    expect(unit.y).toBe(0);
    expect(unit.moved).toBe(true);
  });

  it('emits logMessage with lae class on ZOC interruption', () => {
    const ally = makeUnitData('zoc_log', 'ally');
    const enemy = makeUnitData('zoc_le', 'enemy');

    const { store, allyIds } = buildStore(
      [{ data: ally, x: 0, y: 0 }],
      [{ data: enemy, x: 3, y: 0 }],
    );
    const casterId = allyIds[0]!;

    const logs: any[] = [];
    EventBus.on('logMessage', e => logs.push(e));

    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    store.dispatch(new MoveAction(casterId, { x: 3, y: 0 }, path, 3));

    expect(logs.some(l => l.cls === 'lae')).toBe(true);
  });
});

describe('MoveAction — ZOC interruption (already in ZOC)', () => {
  beforeEach(() => { EventBus.clear(); });

  it('halts unit when starting and staying in ZOC (wasInZoc branch)', () => {
    const ally = makeUnitData('zoc_stay', 'ally', {
      baseStats: { hp: 20, mp: 5, atk: 8, def: 5, spd: 6, skl: 5, maxAP: 6 },
    });
    // Enemy at (1,0): ally at (0,0) starts adjacent → wasInZoc = true
    const enemy = makeUnitData('zoc_s_e', 'enemy');

    const { store, allyIds } = buildStore(
      [{ data: ally, x: 0, y: 0 }],
      [{ data: enemy, x: 1, y: 0 }],
    );
    const casterId = allyIds[0]!;

    // Path jumps from (0,0) to (2,0) — also distance 1 from enemy at (1,0)
    // wasInZoc at (0,0) = true (dist=1), inZocNow at (2,0) = true (dist=1) → wasInZoc branch
    const path = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    store.dispatch(new MoveAction(casterId, { x: 3, y: 0 }, path, 3));

    const unit = store.getState().units[casterId]!;
    // Halted at (2,0) because both start and first step are in ZOC
    expect(unit.x).toBe(2);
    expect(unit.moved).toBe(true);
  });
});
