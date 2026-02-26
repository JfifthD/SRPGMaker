import Phaser from 'phaser';
import { SaveManager } from '@/engine/systems/save/SaveManager';
import { campaignManager, createDefaultCampaign } from '@/engine/systems/campaign/CampaignManager';
import { loadGameProject } from '@/engine/loader/GameProjectLoader';
import { store } from '@/engine/state/GameStore';

export class TitleScene extends Phaser.Scene {
  private hasSaveData = false;

  constructor() { super({ key: 'TitleScene' }); }

  async create(): Promise<void> {
    const { width, height } = this.scale;

    // Check for existing save data
    this.hasSaveData = await SaveManager.hasSave('autosave');

    // ── Background gradient ──
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x030508, 0x030508, 0x090e18, 0x090e18, 1);
    bg.fillRect(0, 0, width, height);

    // ── Title ──
    this.add.text(width / 2, height * 0.35, 'CHRONICLE OF SHADOWS', {
      fontFamily: 'serif',
      fontSize: '52px',
      color: '#c9a84c',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: { blur: 24, color: '#c9a84c', fill: true },
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.5, 'A Strategy RPG', {
      fontFamily: 'serif',
      fontSize: '22px',
      color: '#7a8a9e',
    }).setOrigin(0.5);

    // ── New Game Button ──
    const newBtn = this.add.text(width / 2, height * 0.62, '▶  NEW GAME', {
      fontFamily: 'serif',
      fontSize: '28px',
      color: '#c9a84c',
      backgroundColor: '#151a22',
      padding: { x: 24, y: 12 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    newBtn
      .on('pointerover', () => newBtn.setColor('#e8cc78'))
      .on('pointerout', () => newBtn.setColor('#c9a84c'))
      .on('pointerdown', () => {
        campaignManager.setState(createDefaultCampaign());
        this.scene.start('BattleScene', { stageId: 'stage_01' });
      });

    // ── Continue Button (only if save exists) ──
    if (this.hasSaveData) {
      const contBtn = this.add.text(width / 2, height * 0.74, '↺  CONTINUE', {
        fontFamily: 'serif',
        fontSize: '24px',
        color: '#7accc9',
        backgroundColor: '#151a22',
        padding: { x: 24, y: 10 },
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      contBtn
        .on('pointerover', () => contBtn.setColor('#a0ece8'))
        .on('pointerout', () => contBtn.setColor('#7accc9'))
        .on('pointerdown', async () => {
          const saveSlot = await SaveManager.load('autosave');
          if (saveSlot) {
            const gameProject = loadGameProject();
            store.restore(saveSlot.snapshot, gameProject);
            this.scene.start('BattleScene', { stageId: saveSlot.mapId, restored: true });
          }
        });
    }

    // ── Subtle star particle effect ──
    this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        const x = Phaser.Math.Between(0, width);
        const y = Phaser.Math.Between(0, height);
        const dot = this.add.circle(x, y, Phaser.Math.FloatBetween(0.5, 2), 0xc8d7ff, 0.7);
        this.tweens.add({ targets: dot, alpha: 0, duration: 2000, onComplete: () => dot.destroy() });
      },
    });
  }
}
