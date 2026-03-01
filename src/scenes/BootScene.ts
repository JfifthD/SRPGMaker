// ─────────────────────────────────────────────
//  Boot Scene — asset preloading
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import audioJson from '@game/data/audio.json';
import type { AudioConfig } from '@/engine/data/types/Audio';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // ── Progress bar ──
    const bar = this.add.graphics();
    const w = this.scale.width;
    const h = this.scale.height;

    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x1a2233, 1);
      bar.fillRect(w * 0.1, h * 0.5 - 12, w * 0.8, 24);
      bar.fillStyle(0xc9a84c, 1);
      bar.fillRect(w * 0.1, h * 0.5 - 12, w * 0.8 * v, 24);
    });

    this.load.on('complete', () => bar.destroy());

    // ── Tileset ──
    // When you have a real tileset PNG, load it here:
    // this.load.image('terrain_tiles', 'assets/sprites/terrain.png');

    // ── Stage data ──
    this.load.json('stage_01', 'src/assets/data/maps/stage_01.json');

    // ── Unit sprite frames (placeholder: generate procedurally in BattleScene) ──
    // this.load.spritesheet('warrior', 'assets/sprites/warrior.png', { frameWidth: 16, frameHeight: 16 });

    // ── Audio assets (data-driven from audio.json) ──
    const audioConfig = audioJson as unknown as AudioConfig;
    const gameId = (import.meta as any).env?.GAME_ID ?? 'chronicle-of-shadows';
    const audioBase = `games/${gameId}/assets/audio/`;

    for (const entry of Object.values(audioConfig.entries)) {
      this.load.audio(entry.id, audioBase + entry.file);
    }

    // ── Dialogue scripts ──
    // Naming convention: {stageId}_dialogues → loaded as JSON array of DialogueScript
    this.load.json('stage_01_dialogues', 'src/assets/data/dialogues/stage_01_dialogues.json');
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
