// ─────────────────────────────────────────────
//  EditorScene — Phase E-1 stub
//  Placeholder for the JSON-first editor UI.
//  Launched when MODE=editor (see main.ts).
//  See docs/editor_roadmap.md for the 3-phase roadmap.
// ─────────────────────────────────────────────

import Phaser from 'phaser';

export class EditorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EditorScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Placeholder background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    this.add
      .text(width / 2, height / 2 - 40, 'SRPGMaker Editor', {
        fontSize: '32px',
        color: '#e0e0ff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 10, 'Phase E-1: JSON Editor (coming soon)', {
        fontSize: '16px',
        color: '#8888aa',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    // Launch game alongside editor for preview
    this.scene.launch('BattleScene', { stageId: 'stage_01' });
  }
}
