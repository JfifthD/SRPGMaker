// ─────────────────────────────────────────────
//  IAudioManager Interface
//  Abstracts audio playback — same pattern as IRenderer.
//  Implementations: PhaserAudioManager (real), NullAudioManager (headless)
// ─────────────────────────────────────────────

export interface IAudioManager {
  /** Play background music by asset ID. Crossfades from current BGM. */
  playBGM(assetId: string, options?: { loop?: boolean; fadeMs?: number; volume?: number }): void;

  /** Stop current BGM with optional fade out. */
  stopBGM(fadeMs?: number): void;

  /** Play a one-shot sound effect by asset ID. */
  playSFX(assetId: string, options?: { volume?: number }): void;

  /** Set master volume (0.0–1.0). */
  setMasterVolume(vol: number): void;

  /** Temporarily lower BGM volume (e.g. during dialogue). */
  duckBGM(targetVol: number, durationMs: number): void;

  /** Restore BGM volume after ducking. */
  unduckBGM(durationMs: number): void;

  /** Get the currently playing BGM asset ID, or null. */
  getCurrentBGM(): string | null;

  /** Cleanup all audio resources. */
  destroy(): void;
}
