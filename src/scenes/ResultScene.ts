import Phaser from 'phaser';
import { campaignManager } from '@/engine/systems/campaign/CampaignManager';
import { StateQuery } from '@/engine/state/BattleState';
import { store } from '@/engine/state/GameStore';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: { victory: boolean; turn: number; stageId?: string }): void {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.87);
    bg.fillRect(0, 0, width, height);

    // Remove HUD overlay if present
    document.getElementById('hud-overlay')?.remove();

    const titleText = data.victory ? '✨ VICTORY' : '💀 DEFEAT';
    const subText = data.victory
      ? `Turn ${data.turn}에 모든 적을 물리쳤습니다!`
      : '부대가 전멸했습니다...';
    const titleColour = data.victory ? '#c9a84c' : '#e74c3c';

    this.add.rectangle(width / 2, height / 2, 480, 280, 0x0c0f16, 1)
      .setStrokeStyle(2, data.victory ? 0xc9a84c : 0xe74c3c);

    this.add.text(width / 2, height / 2 - 80, titleText, {
      fontFamily: 'serif', fontSize: '48px', color: titleColour,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, subText, {
      fontFamily: 'serif', fontSize: '20px', color: '#7a8a9e',
    }).setOrigin(0.5);

    // ── Campaign progression on Victory ──
    if (data.victory && data.stageId) {
      const state = store.getState();
      const allies = StateQuery.liveAllies(state);
      campaignManager.updateRoster(allies);
      campaignManager.completeStage(data.stageId);

      // Show progression info
      const nextStage = campaignManager.getCurrentStage();
      if (nextStage) {
        this.add.text(width / 2, height / 2 + 20, `다음 스테이지 잠금해제: ${nextStage.name}`, {
          fontFamily: 'serif', fontSize: '16px', color: '#4a9c5a',
        }).setOrigin(0.5);
      }
    }

    // ── Buttons ──
    const btnY = data.victory ? height / 2 + 70 : height / 2 + 50;

    if (data.victory) {
      // Continue to next stage or stage select
      const nextBtn = this.add.text(width / 2, btnY, '▶  CONTINUE', {
        fontFamily: 'serif', fontSize: '22px', color: '#c9a84c',
        backgroundColor: '#151a22', padding: { x: 20, y: 10 },
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      nextBtn
        .on('pointerover', () => nextBtn.setColor('#e8cc78'))
        .on('pointerout', () => nextBtn.setColor('#c9a84c'))
        .on('pointerdown', () => {
          // Check for post-battle dialogue
          const stage = data.stageId ? campaignManager.getStage(data.stageId) : null;
          if (stage?.postDialogue) {
            this.scene.start('DialogueScene', {
              scriptId: stage.postDialogue,
              nextScene: 'TitleScene',
              nextSceneData: {},
            });
          } else {
            this.scene.start('TitleScene');
          }
        });
    } else {
      // Retry or go to title
      const retryBtn = this.add.text(width / 2 - 80, btnY, '↺  RETRY', {
        fontFamily: 'serif', fontSize: '22px', color: '#e8cc78',
        backgroundColor: '#151a22', padding: { x: 20, y: 10 },
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      retryBtn
        .on('pointerover', () => retryBtn.setColor('#fff'))
        .on('pointerout', () => retryBtn.setColor('#e8cc78'))
        .on('pointerdown', () => {
          this.scene.start('BattleScene', { stageId: data.stageId ?? 'stage_01' });
        });

      const titleBtn = this.add.text(width / 2 + 80, btnY, '🏠 TITLE', {
        fontFamily: 'serif', fontSize: '22px', color: '#7a8a9e',
        backgroundColor: '#151a22', padding: { x: 20, y: 10 },
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      titleBtn
        .on('pointerover', () => titleBtn.setColor('#ccc'))
        .on('pointerout', () => titleBtn.setColor('#7a8a9e'))
        .on('pointerdown', () => this.scene.start('TitleScene'));
    }
  }
}
