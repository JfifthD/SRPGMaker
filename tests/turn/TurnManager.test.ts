import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TurnManager } from '@/engine/systems/turn/TurnManager';
import { EventBus } from '@/engine/utils/EventBus';

describe('TurnManager', () => {
  let tm: TurnManager;

  beforeEach(() => {
    tm = new TurnManager();
    EventBus.clear();
  });

  // ── Initial state ────────────────────────────────────────────────
  it('starts in PLAYER_IDLE phase', () => {
    expect(tm.phase).toBe('PLAYER_IDLE');
  });

  it('starts on turn 1', () => {
    expect(tm.turn).toBe(1);
  });

  // ── Valid transitions ────────────────────────────────────────────
  it('transitions PLAYER_IDLE → UNIT_SELECTED', () => {
    tm.transition('UNIT_SELECTED');
    expect(tm.phase).toBe('UNIT_SELECTED');
  });

  it('transitions PLAYER_IDLE → ENEMY_PHASE', () => {
    tm.transition('ENEMY_PHASE');
    expect(tm.phase).toBe('ENEMY_PHASE');
  });

  it('transitions UNIT_SELECTED → MOVE_SELECT', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('MOVE_SELECT');
    expect(tm.phase).toBe('MOVE_SELECT');
  });

  it('transitions UNIT_SELECTED → ACTION_SELECT', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('ACTION_SELECT');
    expect(tm.phase).toBe('ACTION_SELECT');
  });

  it('transitions UNIT_SELECTED → PLAYER_IDLE (deselect)', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('PLAYER_IDLE');
    expect(tm.phase).toBe('PLAYER_IDLE');
  });

  it('transitions ACTION_SELECT → SKILL_SELECT', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('ACTION_SELECT');
    tm.transition('SKILL_SELECT');
    expect(tm.phase).toBe('SKILL_SELECT');
  });

  it('transitions ANIMATING → VICTORY', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('MOVE_SELECT');
    tm.transition('ANIMATING');
    tm.transition('VICTORY');
    expect(tm.phase).toBe('VICTORY');
  });

  it('transitions ANIMATING → DEFEAT', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('MOVE_SELECT');
    tm.transition('ANIMATING');
    tm.transition('DEFEAT');
    expect(tm.phase).toBe('DEFEAT');
  });

  it('transitions ENEMY_PHASE → PLAYER_IDLE', () => {
    tm.transition('ENEMY_PHASE');
    tm.transition('PLAYER_IDLE');
    expect(tm.phase).toBe('PLAYER_IDLE');
  });

  // ── Invalid transitions (no-op) ──────────────────────────────────
  it('ignores invalid transition PLAYER_IDLE → ANIMATING', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    tm.transition('ANIMATING');
    expect(tm.phase).toBe('PLAYER_IDLE'); // unchanged
    errorSpy.mockRestore();
  });

  it('ignores invalid transition from terminal state VICTORY', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    tm.transition('ENEMY_PHASE');
    tm.transition('VICTORY');
    tm.transition('PLAYER_IDLE'); // should be ignored
    expect(tm.phase).toBe('VICTORY');
    errorSpy.mockRestore();
  });

  it('ignores invalid transition from terminal state DEFEAT', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    tm.transition('ENEMY_PHASE');
    tm.transition('DEFEAT');
    tm.transition('PLAYER_IDLE'); // should be ignored
    expect(tm.phase).toBe('DEFEAT');
    errorSpy.mockRestore();
  });

  // ── EventBus emission ────────────────────────────────────────────
  it('emits phaseChanged event on valid transition', () => {
    const handler = vi.fn();
    EventBus.on('phaseChanged', handler);
    tm.transition('UNIT_SELECTED');
    expect(handler).toHaveBeenCalledWith({ phase: 'UNIT_SELECTED' });
  });

  it('does not emit phaseChanged on invalid transition', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn();
    EventBus.on('phaseChanged', handler);
    tm.transition('ANIMATING'); // invalid from PLAYER_IDLE
    expect(handler).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  // ── isPlayerInteractable ─────────────────────────────────────────
  it('isPlayerInteractable is true in PLAYER_IDLE', () => {
    expect(tm.isPlayerInteractable).toBe(true);
  });

  it('isPlayerInteractable is true in UNIT_SELECTED', () => {
    tm.transition('UNIT_SELECTED');
    expect(tm.isPlayerInteractable).toBe(true);
  });

  it('isPlayerInteractable is true in MOVE_SELECT', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('MOVE_SELECT');
    expect(tm.isPlayerInteractable).toBe(true);
  });

  it('isPlayerInteractable is true in ACTION_SELECT', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('ACTION_SELECT');
    expect(tm.isPlayerInteractable).toBe(true);
  });

  it('isPlayerInteractable is true in SKILL_SELECT', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('ACTION_SELECT');
    tm.transition('SKILL_SELECT');
    expect(tm.isPlayerInteractable).toBe(true);
  });

  it('isPlayerInteractable is false in ENEMY_PHASE', () => {
    tm.transition('ENEMY_PHASE');
    expect(tm.isPlayerInteractable).toBe(false);
  });

  it('isPlayerInteractable is false in ANIMATING', () => {
    tm.transition('UNIT_SELECTED');
    tm.transition('MOVE_SELECT');
    tm.transition('ANIMATING');
    expect(tm.isPlayerInteractable).toBe(false);
  });

  it('isPlayerInteractable is false in VICTORY', () => {
    tm.transition('ENEMY_PHASE');
    tm.transition('VICTORY');
    expect(tm.isPlayerInteractable).toBe(false);
  });

  it('isPlayerInteractable is false in DEFEAT', () => {
    tm.transition('ENEMY_PHASE');
    tm.transition('DEFEAT');
    expect(tm.isPlayerInteractable).toBe(false);
  });

  // ── reset ────────────────────────────────────────────────────────
  it('reset returns to PLAYER_IDLE', () => {
    tm.transition('ENEMY_PHASE');
    tm.reset();
    expect(tm.phase).toBe('PLAYER_IDLE');
  });

  it('reset returns turn to 1', () => {
    tm.reset();
    expect(tm.turn).toBe(1);
  });
});
