// ─────────────────────────────────────────────
//  PhaserAudioManager
//  IAudioManager implementation wrapping Phaser.Sound.
//  Handles BGM crossfade, SFX one-shots, volume ducking.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import type { IAudioManager } from './IAudioManager';

const DEFAULT_FADE_MS = 500;
const DUCK_VOLUME = 0.3;

export class PhaserAudioManager implements IAudioManager {
  private scene: Phaser.Scene;
  private currentBGM: Phaser.Sound.BaseSound | null = null;
  private currentBGMKey: string | null = null;
  private masterVolume = 1;
  private bgmBaseVolume = 1;
  private isDucked = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  playBGM(assetId: string, options?: { loop?: boolean; fadeMs?: number; volume?: number }): void {
    const loop = options?.loop ?? true;
    const fadeMs = options?.fadeMs ?? DEFAULT_FADE_MS;
    const volume = options?.volume ?? 0.8;

    // Skip if already playing the same BGM
    if (this.currentBGMKey === assetId && this.currentBGM?.isPlaying) {
      return;
    }

    // Fade out current BGM then start new one
    if (this.currentBGM?.isPlaying) {
      const old = this.currentBGM;
      this.scene.tweens.add({
        targets: old,
        volume: 0,
        duration: fadeMs,
        onComplete: () => { old.stop(); old.destroy(); },
      });
    }

    if (!this.scene.cache.audio.exists(assetId)) {
      console.warn(`[PhaserAudioManager] Audio key not found: ${assetId}`);
      this.currentBGM = null;
      this.currentBGMKey = null;
      return;
    }

    this.bgmBaseVolume = volume;
    const targetVol = this.isDucked ? DUCK_VOLUME * this.masterVolume : volume * this.masterVolume;

    this.currentBGM = this.scene.sound.add(assetId, { loop, volume: 0 });
    this.currentBGMKey = assetId;
    this.currentBGM.play();

    // Fade in
    this.scene.tweens.add({
      targets: this.currentBGM,
      volume: targetVol,
      duration: fadeMs,
    });
  }

  stopBGM(fadeMs?: number): void {
    if (!this.currentBGM?.isPlaying) return;

    const duration = fadeMs ?? DEFAULT_FADE_MS;
    const bgm = this.currentBGM;

    this.scene.tweens.add({
      targets: bgm,
      volume: 0,
      duration,
      onComplete: () => { bgm.stop(); bgm.destroy(); },
    });

    this.currentBGM = null;
    this.currentBGMKey = null;
  }

  playSFX(assetId: string, options?: { volume?: number }): void {
    if (!this.scene.cache.audio.exists(assetId)) {
      return; // silently skip missing SFX
    }
    const volume = (options?.volume ?? 1) * this.masterVolume;
    this.scene.sound.play(assetId, { volume });
  }

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    // Update current BGM volume
    if (this.currentBGM?.isPlaying) {
      const effectiveVol = this.isDucked ? DUCK_VOLUME : this.bgmBaseVolume;
      (this.currentBGM as any).volume = effectiveVol * this.masterVolume;
    }
  }

  duckBGM(targetVol: number = DUCK_VOLUME, durationMs: number = 300): void {
    this.isDucked = true;
    if (!this.currentBGM?.isPlaying) return;

    this.scene.tweens.add({
      targets: this.currentBGM,
      volume: targetVol * this.masterVolume,
      duration: durationMs,
    });
  }

  unduckBGM(durationMs: number = 300): void {
    this.isDucked = false;
    if (!this.currentBGM?.isPlaying) return;

    this.scene.tweens.add({
      targets: this.currentBGM,
      volume: this.bgmBaseVolume * this.masterVolume,
      duration: durationMs,
    });
  }

  getCurrentBGM(): string | null {
    return this.currentBGMKey;
  }

  destroy(): void {
    if (this.currentBGM) {
      this.currentBGM.stop();
      this.currentBGM.destroy();
      this.currentBGM = null;
      this.currentBGMKey = null;
    }
  }
}
