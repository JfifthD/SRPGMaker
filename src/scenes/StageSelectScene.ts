import Phaser from 'phaser';
import { campaignManager } from '@/engine/systems/campaign/CampaignManager';
import { EventBus } from '@/engine/utils/EventBus';
import type { StageEntry } from '@/engine/data/types/Campaign';

/**
 * StageSelectScene — World map / stage list.
 * Displays unlocked stages and lets the player choose one.
 */
export class StageSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'StageSelectScene' }); }

  create(): void {
    const { width, height } = this.scale;

    // ── Background ──
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x050810, 0x050810, 0x0c1525, 0x0c1525, 1);
    bg.fillRect(0, 0, width, height);

    // ── Title ──
    this.add.text(width / 2, 40, 'STAGE SELECT', {
      fontFamily: 'serif',
      fontSize: '36px',
      color: '#c9a84c',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // ── Stage List ──
    const stages = campaignManager.getUnlockedStages();
    const startY = 120;
    const spacing = 72;

    stages.forEach((stage, i) => {
      const y = startY + i * spacing;
      const completed = campaignManager.isCompleted(stage.id);

      // Stage card background
      const card = this.add.rectangle(width / 2, y, 400, 56, 0x0c0f16, 0.9)
        .setStrokeStyle(2, completed ? 0x4a9c5a : 0xc9a84c);

      // Status indicator
      const statusIcon = completed ? '✅' : '▶';
      this.add.text(width / 2 - 170, y, statusIcon, {
        fontSize: '20px',
      }).setOrigin(0.5);

      // Stage name
      this.add.text(width / 2 - 120, y - 10, stage.name, {
        fontFamily: 'serif',
        fontSize: '18px',
        color: '#e8dcc8',
      }).setOrigin(0, 0.5);

      // Stage description or order
      this.add.text(width / 2 - 120, y + 12, stage.description ?? `Stage ${stage.order + 1}`, {
        fontFamily: 'serif',
        fontSize: '12px',
        color: '#7a8a9e',
      }).setOrigin(0, 0.5);

      // Make card interactive
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => {
        card.setFillStyle(0x151a22, 1);
        card.setStrokeStyle(2, 0xe8cc78);
      });
      card.on('pointerout', () => {
        card.setFillStyle(0x0c0f16, 0.9);
        card.setStrokeStyle(2, completed ? 0x4a9c5a : 0xc9a84c);
      });
      card.on('pointerdown', () => {
        this.selectStage(stage);
      });
    });

    // ── Bottom info ──
    const completedCount = campaignManager.state.completedStages.length;
    const totalCount = campaignManager.definition?.stages.length ?? 0;
    this.add.text(width / 2, height - 40, `Progress: ${completedCount} / ${totalCount}`, {
      fontFamily: 'serif',
      fontSize: '14px',
      color: '#7a8a9e',
    }).setOrigin(0.5);
  }

  private selectStage(stage: StageEntry) {
    EventBus.emit('stageSelected', { stageId: stage.id });

    // Check for pre-battle dialogue
    if (stage.preDialogue) {
      this.scene.start('DialogueScene', {
        scriptId: stage.preDialogue,
        nextScene: 'BattleScene',
        nextSceneData: { stageId: stage.mapId },
      });
    } else {
      this.scene.start('BattleScene', { stageId: stage.mapId });
    }
  }
}
