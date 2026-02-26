// ─────────────────────────────────────────────
//  DialogueScene
//  Full-screen Visual Novel (VN) scene — "scenario" mode.
//  Launched on top of BattleScene via scene.launch().
//  Accepts the script to play via Phaser registry.
//
//  Usage from BattleScene / coordinator:
//    this.registry.set('dialogueScriptId', 'ch01_prologue');
//    this.registry.set('dialogueScript', scriptJson);
//    this.scene.launch('DialogueScene');
//    this.scene.pause('BattleScene');
//
//  When the script finishes, DialogueScene stops itself
//  and resumes 'BattleScene' and 'UIScene'.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import { PhaserDialogueRenderer } from '@/engine/renderer/PhaserDialogueRenderer';
import { DialogueManager } from '@/engine/systems/dialogue/DialogueManager';
import type { DialogueScript } from '@/engine/data/types/Dialogue';

export class DialogueScene extends Phaser.Scene {
  private dlgRenderer!: PhaserDialogueRenderer;
  private manager!: DialogueManager;

  constructor() {
    super({ key: 'DialogueScene' });
  }

  create(): void {
    const scriptId: string = this.registry.get('dialogueScriptId') ?? '';
    const scriptData: DialogueScript | null = this.registry.get('dialogueScript') ?? null;

    if (!scriptId) {
      console.warn('[DialogueScene] No dialogueScriptId in registry. Stopping.');
      this.stopAndResume();
      return;
    }

    this.dlgRenderer = new PhaserDialogueRenderer(this, 'scenario');
    this.manager = new DialogueManager(this.dlgRenderer);

    if (scriptData) {
      this.manager.registerScript(scriptData);
    }

    // Advance on any input
    this.input.on('pointerdown', () => this.manager.onAdvance());
    this.input.keyboard?.on('keydown-SPACE', () => this.manager.onAdvance());
    this.input.keyboard?.on('keydown-ENTER', () => this.manager.onAdvance());

    // Play and then hand back control to BattleScene
    this.manager.play(scriptId).then(() => this.stopAndResume());
  }

  private stopAndResume(): void {
    this.dlgRenderer?.destroy();
    this.scene.stop('DialogueScene');
    this.scene.resume('BattleScene');
    this.scene.resume('UIScene');
  }
}
