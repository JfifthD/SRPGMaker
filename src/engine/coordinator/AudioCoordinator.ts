// ─────────────────────────────────────────────
//  AudioCoordinator
//  Subscribes to EventBus events and routes them
//  to IAudioManager calls via data-driven AudioConfig.
//  No Phaser imports — follows BattleCoordinator pattern.
// ─────────────────────────────────────────────

import { EventBus } from '@/engine/utils/EventBus';
import type { IAudioManager } from '@/engine/renderer/IAudioManager';
import type { AudioConfig, AudioEventMap as AudioEventMapType, AudioEntry } from '@/engine/data/types/Audio';

export class AudioCoordinator {
  private audio: IAudioManager;
  private config: AudioConfig | null;
  private entries: Record<string, AudioEntry>;
  private eventMap: AudioEventMapType;

  // Store bound handlers for cleanup
  private handlers: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  constructor(audio: IAudioManager, config: AudioConfig | null) {
    this.audio = audio;
    this.config = config;
    this.entries = config?.entries ?? {};
    this.eventMap = config?.eventMap ?? {};

    this.bindEvents();
  }

  // ── Public API ────────────────────────────────

  playBGM(assetId: string | undefined): void {
    if (!assetId) return;
    const entry = this.entries[assetId];
    this.audio.playBGM(assetId, {
      loop: entry?.loop ?? true,
      volume: entry?.defaultVolume ?? 0.8,
    });
  }

  stopBGM(): void {
    this.audio.stopBGM();
  }

  setMasterVolume(vol: number): void {
    this.audio.setMasterVolume(vol);
  }

  destroy(): void {
    this.unbindEvents();
    this.audio.destroy();
  }

  // ── Private: Event Bindings ───────────────────

  private bindEvents(): void {
    this.on('unitMoved', () => this.playSFXFromMap('onUnitMoved'));
    this.on('unitDamaged', (p) => {
      if (p.crit) {
        this.playSFXFromMap('onCriticalHit');
      } else {
        this.playSFXFromMap('onUnitDamaged');
      }
    });
    this.on('unitHealed', () => this.playSFXFromMap('onUnitHealed'));
    this.on('unitDefeated', () => this.playSFXFromMap('onUnitDefeated'));
    this.on('unitBuffed', () => this.playSFXFromMap('onBuffApplied'));
    this.on('unitDebuffed', () => this.playSFXFromMap('onDebuffApplied'));
    this.on('skillCast', () => this.playSFXFromMap('onSkillCast'));
    this.on('turnStarted', (p) => {
      if (p.phase === 'enemy') {
        this.playSFXFromMap('onEnemyPhase');
      } else {
        this.playSFXFromMap('onTurnStart');
      }
    });
    this.on('victory', () => this.playSFXFromMap('onVictory'));
    this.on('defeat', () => this.playSFXFromMap('onDefeat'));
    this.on('openRingMenu', () => this.playSFXFromMap('onMenuOpen'));

    // Pass-through from dialogue system
    this.on('sfxPlay', (p) => this.playSFXDirect(p.key));
    this.on('bgmChange', (p) => this.playBGM(p.key));

    // Dialogue ducking
    this.on('dialogueStart', () => this.audio.duckBGM(0.3, 300));
    this.on('dialogueEnd', () => this.audio.unduckBGM(300));
  }

  private unbindEvents(): void {
    for (const { event, handler } of this.handlers) {
      EventBus.off(event as any, handler);
    }
    this.handlers = [];
  }

  /** Type-safe wrapper: subscribe + store for later removal */
  private on<K extends keyof import('@/engine/utils/EventBus').GameEventMap>(
    event: K,
    handler: (payload: import('@/engine/utils/EventBus').GameEventMap[K]) => void,
  ): void {
    EventBus.on(event, handler);
    this.handlers.push({ event, handler });
  }

  // ── Private: SFX helpers ──────────────────────

  private playSFXFromMap(eventKey: keyof AudioEventMapType): void {
    const assetId = this.eventMap[eventKey];
    if (!assetId) return;
    this.playSFXDirect(assetId);
  }

  private playSFXDirect(assetId: string): void {
    const entry = this.entries[assetId];
    this.audio.playSFX(assetId, { volume: entry?.defaultVolume ?? 1 });
  }
}
