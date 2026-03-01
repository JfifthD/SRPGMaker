// ─────────────────────────────────────────────
//  AudioCoordinator Unit Tests
//  Verifies event-to-audio routing via mock IAudioManager.
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioCoordinator } from '@/engine/coordinator/AudioCoordinator';
import { EventBus } from '@/engine/utils/EventBus';
import type { IAudioManager } from '@/engine/renderer/IAudioManager';
import type { AudioConfig } from '@/engine/data/types/Audio';
import type { UnitInstance } from '@/engine/data/types/Unit';

// ── Mock IAudioManager ──

function createMockAudio(): IAudioManager & {
  playBGM: ReturnType<typeof vi.fn>;
  stopBGM: ReturnType<typeof vi.fn>;
  playSFX: ReturnType<typeof vi.fn>;
  setMasterVolume: ReturnType<typeof vi.fn>;
  duckBGM: ReturnType<typeof vi.fn>;
  unduckBGM: ReturnType<typeof vi.fn>;
  getCurrentBGM: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  return {
    playBGM: vi.fn(),
    stopBGM: vi.fn(),
    playSFX: vi.fn(),
    setMasterVolume: vi.fn(),
    duckBGM: vi.fn(),
    unduckBGM: vi.fn(),
    getCurrentBGM: vi.fn(() => null),
    destroy: vi.fn(),
  };
}

// ── Test audio config ──

const TEST_CONFIG: AudioConfig = {
  entries: {
    bgm_battle: { id: 'bgm_battle', category: 'bgm', file: 'bgm/battle.mp3', defaultVolume: 0.8, loop: true },
    sfx_hit: { id: 'sfx_hit', category: 'sfx', file: 'sfx/hit.mp3', defaultVolume: 0.7 },
    sfx_crit: { id: 'sfx_crit', category: 'sfx', file: 'sfx/crit.mp3', defaultVolume: 0.9 },
    sfx_heal: { id: 'sfx_heal', category: 'sfx', file: 'sfx/heal.mp3', defaultVolume: 0.6 },
    sfx_defeat: { id: 'sfx_defeat', category: 'sfx', file: 'sfx/defeat.mp3', defaultVolume: 0.7 },
    sfx_buff: { id: 'sfx_buff', category: 'sfx', file: 'sfx/buff.mp3', defaultVolume: 0.5 },
    sfx_debuff: { id: 'sfx_debuff', category: 'sfx', file: 'sfx/debuff.mp3', defaultVolume: 0.5 },
    sfx_skill: { id: 'sfx_skill', category: 'sfx', file: 'sfx/skill.mp3', defaultVolume: 0.6 },
    sfx_turn: { id: 'sfx_turn', category: 'sfx', file: 'sfx/turn.mp3', defaultVolume: 0.4 },
    sfx_enemy: { id: 'sfx_enemy', category: 'sfx', file: 'sfx/enemy.mp3', defaultVolume: 0.5 },
    sfx_victory: { id: 'sfx_victory', category: 'sfx', file: 'sfx/victory.mp3', defaultVolume: 0.8 },
    sfx_loss: { id: 'sfx_loss', category: 'sfx', file: 'sfx/loss.mp3', defaultVolume: 0.7 },
    sfx_menu: { id: 'sfx_menu', category: 'sfx', file: 'sfx/menu.mp3', defaultVolume: 0.3 },
    sfx_step: { id: 'sfx_step', category: 'sfx', file: 'sfx/step.mp3', defaultVolume: 0.4 },
  },
  eventMap: {
    onUnitMoved: 'sfx_step',
    onUnitDamaged: 'sfx_hit',
    onCriticalHit: 'sfx_crit',
    onUnitHealed: 'sfx_heal',
    onUnitDefeated: 'sfx_defeat',
    onBuffApplied: 'sfx_buff',
    onDebuffApplied: 'sfx_debuff',
    onSkillCast: 'sfx_skill',
    onTurnStart: 'sfx_turn',
    onEnemyPhase: 'sfx_enemy',
    onVictory: 'sfx_victory',
    onDefeat: 'sfx_loss',
    onMenuOpen: 'sfx_menu',
  },
  bgmFlow: {
    title: 'bgm_title',
    battle: 'bgm_battle',
    victory: 'bgm_victory',
    defeat: 'bgm_defeat',
  },
};

const STUB_UNIT = { instanceId: 'u1', name: 'Test' } as UnitInstance;

describe('AudioCoordinator', () => {
  let audio: ReturnType<typeof createMockAudio>;
  let coord: AudioCoordinator;

  beforeEach(() => {
    EventBus.clear();
    audio = createMockAudio();
    coord = new AudioCoordinator(audio, TEST_CONFIG);
  });

  // ── BGM ──

  it('playBGM routes to IAudioManager with entry config', () => {
    coord.playBGM('bgm_battle');
    expect(audio.playBGM).toHaveBeenCalledWith('bgm_battle', { loop: true, volume: 0.8 });
  });

  it('playBGM with undefined assetId is a no-op', () => {
    coord.playBGM(undefined);
    expect(audio.playBGM).not.toHaveBeenCalled();
  });

  it('stopBGM delegates to IAudioManager', () => {
    coord.stopBGM();
    expect(audio.stopBGM).toHaveBeenCalled();
  });

  // ── SFX from EventBus events ──

  it('unitDamaged (non-crit) plays onUnitDamaged SFX', () => {
    EventBus.emit('unitDamaged', { unit: STUB_UNIT, dmg: 10, crit: false, affMult: 1 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_hit', { volume: 0.7 });
  });

  it('unitDamaged (crit) plays onCriticalHit SFX', () => {
    EventBus.emit('unitDamaged', { unit: STUB_UNIT, dmg: 20, crit: true, affMult: 1 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_crit', { volume: 0.9 });
  });

  it('unitHealed plays onUnitHealed SFX', () => {
    EventBus.emit('unitHealed', { unit: STUB_UNIT, amount: 15 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_heal', { volume: 0.6 });
  });

  it('unitDefeated plays onUnitDefeated SFX', () => {
    EventBus.emit('unitDefeated', { unit: STUB_UNIT });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_defeat', { volume: 0.7 });
  });

  it('unitBuffed plays onBuffApplied SFX', () => {
    EventBus.emit('unitBuffed', { unit: STUB_UNIT, stat: 'atk', val: 3, dur: 2 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_buff', { volume: 0.5 });
  });

  it('unitDebuffed plays onDebuffApplied SFX', () => {
    EventBus.emit('unitDebuffed', { unit: STUB_UNIT, stat: 'def', val: -2, dur: 2 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_debuff', { volume: 0.5 });
  });

  it('skillCast plays onSkillCast SFX', () => {
    EventBus.emit('skillCast', { caster: STUB_UNIT, skillId: 'fireball', tx: 3, ty: 4 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_skill', { volume: 0.6 });
  });

  it('unitMoved plays onUnitMoved SFX', () => {
    EventBus.emit('unitMoved', { unit: STUB_UNIT, fromX: 0, fromY: 0, toX: 1, toY: 1 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_step', { volume: 0.4 });
  });

  // ── Turn-based events ──

  it('turnStarted (player) plays onTurnStart SFX', () => {
    EventBus.emit('turnStarted', { turn: 1, phase: 'player', activeUnitId: 'u1' });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_turn', { volume: 0.4 });
  });

  it('turnStarted (enemy) plays onEnemyPhase SFX', () => {
    EventBus.emit('turnStarted', { turn: 1, phase: 'enemy', activeUnitId: 'e1' });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_enemy', { volume: 0.5 });
  });

  // ── Game outcome events ──

  it('victory plays onVictory SFX', () => {
    EventBus.emit('victory', { turn: 5 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_victory', { volume: 0.8 });
  });

  it('defeat plays onDefeat SFX', () => {
    EventBus.emit('defeat', { turn: 3 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_loss', { volume: 0.7 });
  });

  // ── Menu ──

  it('openRingMenu plays onMenuOpen SFX', () => {
    EventBus.emit('openRingMenu', { unit: STUB_UNIT, tx: 5, ty: 5 });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_menu', { volume: 0.3 });
  });

  // ── Dialogue pass-through ──

  it('sfxPlay event passes through to playSFX', () => {
    EventBus.emit('sfxPlay', { key: 'sfx_hit' });
    expect(audio.playSFX).toHaveBeenCalledWith('sfx_hit', { volume: 0.7 });
  });

  it('bgmChange event passes through to playBGM', () => {
    EventBus.emit('bgmChange', { key: 'bgm_battle' });
    expect(audio.playBGM).toHaveBeenCalledWith('bgm_battle', { loop: true, volume: 0.8 });
  });

  // ── Dialogue ducking ──

  it('dialogueStart ducks BGM', () => {
    EventBus.emit('dialogueStart', { scriptId: 'test', mode: 'battle_overlay' });
    expect(audio.duckBGM).toHaveBeenCalledWith(0.3, 300);
  });

  it('dialogueEnd unducks BGM', () => {
    EventBus.emit('dialogueEnd', { scriptId: 'test' });
    expect(audio.unduckBGM).toHaveBeenCalledWith(300);
  });

  // ── Null config (no-op) ──

  it('null config creates no-op coordinator (events fire without errors)', () => {
    EventBus.clear();
    const nullCoord = new AudioCoordinator(audio, null);
    // Should not throw
    EventBus.emit('unitDamaged', { unit: STUB_UNIT, dmg: 10, crit: false, affMult: 1 });
    expect(audio.playSFX).not.toHaveBeenCalled();
    nullCoord.destroy();
  });

  // ── Cleanup ──

  it('destroy removes all event listeners and calls audio.destroy', () => {
    coord.destroy();
    // After destroy, events should not trigger SFX
    EventBus.emit('unitDamaged', { unit: STUB_UNIT, dmg: 10, crit: false, affMult: 1 });
    expect(audio.playSFX).not.toHaveBeenCalled();
    expect(audio.destroy).toHaveBeenCalled();
  });

  // ── Master volume ──

  it('setMasterVolume delegates to IAudioManager', () => {
    coord.setMasterVolume(0.5);
    expect(audio.setMasterVolume).toHaveBeenCalledWith(0.5);
  });
});
