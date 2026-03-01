// ─────────────────────────────────────────────
//  NullAudioManager — headless no-op stub
//  Same pattern as NullRenderer.ts
// ─────────────────────────────────────────────

import type { IAudioManager } from './IAudioManager';

export class NullAudioManager implements IAudioManager {
  playBGM(): void {}
  stopBGM(): void {}
  playSFX(): void {}
  setMasterVolume(): void {}
  duckBGM(): void {}
  unduckBGM(): void {}
  getCurrentBGM(): string | null { return null; }
  destroy(): void {}
}
