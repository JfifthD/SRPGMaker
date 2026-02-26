import Phaser from 'phaser';
import { campaignManager } from '@/engine/systems/campaign/CampaignManager';
import { StateQuery } from '@/engine/state/BattleState';
import { store } from '@/engine/state/GameStore';
import { distributeStageEXP } from '@/engine/systems/progression/LevelUpSystem';
import { promote } from '@/engine/systems/progression/JobSystem';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { LevelUpResult } from '@/engine/systems/progression/LevelUpSystem';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: { victory: boolean; turn: number; stageId?: string }): void {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.87);
    bg.fillRect(0, 0, width, height);

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

    if (data.victory && data.stageId) {
      this.handleVictory(data as { victory: true; turn: number; stageId: string }, width, height);
    } else {
      this.showDefeatButtons(data, width, height);
    }
  }

  // ── Victory flow ─────────────────────────────────────────

  private handleVictory(
    data: { victory: true; turn: number; stageId: string },
    width: number,
    height: number,
  ): void {
    const state = store.getState();
    const allies = StateQuery.liveAllies(state);
    const gameProject = state.gameProject;

    // Build growth map from project unit data
    const growthMap: Record<string, Partial<import('@/engine/data/types/Unit').UnitStats>> = {};
    for (const u of allies) {
      const unitData = gameProject.units.find(d => d.id === u.dataId);
      if (unitData) growthMap[u.dataId] = unitData.growthRates;
    }

    // Distribute clear bonus EXP to all survivors
    const expResults = distributeStageEXP(allies, growthMap);
    const updatedAllies = expResults.map(r => r.unit);

    // Apply EXP gains to store
    store.dispatchAsync(null, draft => {
      for (const unit of updatedAllies) {
        if (draft.units[unit.instanceId]) {
          draft.units[unit.instanceId] = unit as any;
        }
      }
    });

    // Update campaign state
    campaignManager.updateRoster(updatedAllies);
    campaignManager.completeStage(data.stageId);

    // Show next stage info
    const nextStage = campaignManager.getCurrentStage();
    if (nextStage) {
      this.add.text(width / 2, height / 2 + 20, `다음 스테이지 잠금해제: ${nextStage.name}`, {
        fontFamily: 'serif', fontSize: '16px', color: '#4a9c5a',
      }).setOrigin(0.5);
    }

    // Collect all levelups across all units
    const allLevelUps: Array<{ unit: UnitInstance; result: LevelUpResult }> = [];
    for (const expRes of expResults) {
      for (const lu of expRes.levelUps) {
        allLevelUps.push({ unit: expRes.unit, result: lu });
      }
    }

    if (allLevelUps.length > 0) {
      this.showLevelUpPanel(allLevelUps, width, height, () => {
        this.checkAndShowPromotion(updatedAllies, width, height, () => {
          this.showVictoryButton(data, width, height);
        });
      });
    } else {
      this.checkAndShowPromotion(updatedAllies, width, height, () => {
        this.showVictoryButton(data, width, height);
      });
    }
  }

  // ── Level Up Panel ────────────────────────────────────────

  private showLevelUpPanel(
    levelUps: Array<{ unit: UnitInstance; result: LevelUpResult }>,
    width: number,
    height: number,
    onClose: () => void,
  ): void {
    const panelW = 420;
    const maxVisible = 6;
    const panelH = 60 + Math.min(levelUps.length, maxVisible) * 44 + 60;
    const panelX = width / 2;
    const panelY = height / 2 + 70;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.55);
    overlay.fillRect(0, 0, width, height);

    const panel = this.add.graphics();
    panel.fillStyle(0x0c0f16, 1);
    panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 8);
    panel.lineStyle(2, 0xc9a84c, 1);
    panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 8);

    const titleTxt = this.add.text(panelX, panelY - panelH / 2 + 22, '⬆  LEVEL UP!', {
      fontFamily: 'serif', fontSize: '20px', color: '#c9a84c',
    }).setOrigin(0.5);

    const listStartY = panelY - panelH / 2 + 56;
    const rowTexts: Phaser.GameObjects.Text[] = [];
    const visible = levelUps.slice(0, maxVisible);

    visible.forEach((entry, i) => {
      const y = listStartY + i * 44;
      rowTexts.push(
        this.add.text(panelX - 190, y, entry.unit.name, {
          fontFamily: 'serif', fontSize: '14px', color: '#e8dcc8',
        }).setOrigin(0, 0.5),
        this.add.text(panelX - 40, y, `Lv.${entry.result.previousLevel} → Lv.${entry.result.newLevel}`, {
          fontFamily: 'serif', fontSize: '14px', color: '#c9a84c',
        }).setOrigin(0, 0.5),
      );

      const gains = entry.result.gains as unknown as Record<string, number>;
      const gainParts = Object.entries(gains).filter(([, v]) => v > 0).map(([k, v]) => `${k.toUpperCase()}+${v}`);
      rowTexts.push(
        this.add.text(panelX + 90, y, gainParts.join(' '), {
          fontFamily: 'serif', fontSize: '12px', color: '#7ec87e',
        }).setOrigin(0, 0.5),
      );
    });

    let moreTxt: Phaser.GameObjects.Text | undefined;
    if (levelUps.length > maxVisible) {
      moreTxt = this.add.text(panelX, listStartY + maxVisible * 44, `...+${levelUps.length - maxVisible}명 더`, {
        fontFamily: 'serif', fontSize: '12px', color: '#7a8a9e',
      }).setOrigin(0.5, 0);
    }

    const closeBtn = this.add.text(panelX, panelY + panelH / 2 - 22, '▶  CONTINUE', {
      fontFamily: 'serif', fontSize: '16px', color: '#c9a84c',
      backgroundColor: '#151a22', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn
      .on('pointerover', () => closeBtn.setColor('#e8cc78'))
      .on('pointerout', () => closeBtn.setColor('#c9a84c'))
      .on('pointerdown', () => {
        overlay.destroy();
        panel.destroy();
        titleTxt.destroy();
        rowTexts.forEach(t => t.destroy());
        moreTxt?.destroy();
        closeBtn.destroy();
        onClose();
      });
  }

  // ── Promotion check + UI ──────────────────────────────────

  private checkAndShowPromotion(
    allies: UnitInstance[],
    width: number,
    height: number,
    onDone: () => void,
  ): void {
    const state = store.getState();
    const jobsMap = state.gameProject.jobsMap ?? {};

    const promotable = allies.filter(u => {
      const currentJob = jobsMap[u.job];
      if (!currentJob?.promotionTargets) return false;
      // Only offer promotions achievable without items (item-gated handled in-game later)
      return currentJob.promotionTargets.some(pt =>
        u.level >= pt.requiredLevel && (!pt.requiredItems || pt.requiredItems.length === 0),
      );
    });

    if (promotable.length === 0) {
      onDone();
      return;
    }

    this.showPromotionPanel(promotable, 0, width, height, onDone);
  }

  private showPromotionPanel(
    promotable: UnitInstance[],
    idx: number,
    width: number,
    height: number,
    onDone: () => void,
  ): void {
    if (idx >= promotable.length) {
      onDone();
      return;
    }

    const state = store.getState();
    const jobsMap = state.gameProject.jobsMap ?? {};
    const unit = promotable[idx]!;
    const currentJob = jobsMap[unit.job]!;
    const targets = (currentJob.promotionTargets ?? []).filter(pt =>
      unit.level >= pt.requiredLevel && (!pt.requiredItems || pt.requiredItems.length === 0),
    );

    if (targets.length === 0) {
      this.showPromotionPanel(promotable, idx + 1, width, height, onDone);
      return;
    }

    const panelW = 460;
    const panelH = 90 + targets.length * 64 + 56;
    const panelX = width / 2;
    const panelY = height / 2 + 60;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.55);
    overlay.fillRect(0, 0, width, height);

    const panel = this.add.graphics();
    panel.fillStyle(0x0c0f16, 1);
    panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 8);
    panel.lineStyle(2, 0x9c6aff, 1);
    panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 8);

    const allObjects: Phaser.GameObjects.GameObject[] = [overlay, panel];

    const addText = (x: number, y: number, text: string, style: object) => {
      const t = this.add.text(x, y, text, style as Phaser.Types.GameObjects.Text.TextStyle);
      allObjects.push(t);
      return t;
    };

    addText(panelX, panelY - panelH / 2 + 24, '🎓  PROMOTION AVAILABLE', {
      fontFamily: 'serif', fontSize: '18px', color: '#c9a84c',
    }).setOrigin(0.5);

    addText(panelX, panelY - panelH / 2 + 50, `${unit.name}  (${currentJob.name} Lv.${unit.level})`, {
      fontFamily: 'serif', fontSize: '14px', color: '#7a8a9e',
    }).setOrigin(0.5);

    const cleanup = () => allObjects.forEach(o => o.destroy());

    targets.forEach((pt, i) => {
      const targetJob = jobsMap[pt.jobId];
      if (!targetJob) return;
      const rowY = panelY - panelH / 2 + 82 + i * 64;

      const rowBg = this.add.rectangle(panelX, rowY + 20, panelW - 40, 52, 0x151a22)
        .setStrokeStyle(1, 0x333355);
      allObjects.push(rowBg);

      addText(panelX - 190, rowY + 10, targetJob.name, {
        fontFamily: 'serif', fontSize: '16px', color: '#c9a84c',
      }).setOrigin(0, 0.5);
      addText(panelX - 190, rowY + 30, targetJob.desc.substring(0, 28), {
        fontFamily: 'serif', fontSize: '11px', color: '#7a8a9e',
      }).setOrigin(0, 0.5);

      const statParts: string[] = [];
      if (targetJob.statMod.atk) statParts.push(`ATK${targetJob.statMod.atk > 0 ? '+' : ''}${targetJob.statMod.atk}`);
      if (targetJob.statMod.def) statParts.push(`DEF${targetJob.statMod.def > 0 ? '+' : ''}${targetJob.statMod.def}`);
      if (targetJob.statMod.spd) statParts.push(`SPD${targetJob.statMod.spd > 0 ? '+' : ''}${targetJob.statMod.spd}`);
      if (targetJob.statMod.hp)  statParts.push(`HP${targetJob.statMod.hp > 0 ? '+' : ''}${targetJob.statMod.hp}`);

      addText(panelX + 30, rowY + 20, statParts.join('  '), {
        fontFamily: 'serif', fontSize: '12px', color: '#7ec87e',
      }).setOrigin(0, 0.5);

      const promoteBtn = this.add.text(panelX + 180, rowY + 20, 'PROMOTE', {
        fontFamily: 'serif', fontSize: '13px', color: '#0c0f16',
        backgroundColor: '#c9a84c', padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      allObjects.push(promoteBtn);

      promoteBtn
        .on('pointerover', () => promoteBtn.setBackgroundColor('#e8cc78'))
        .on('pointerout', () => promoteBtn.setBackgroundColor('#c9a84c'))
        .on('pointerdown', () => {
          const promoted = promote(unit, targetJob, unit.skills.slice(0, 2));
          store.dispatchAsync(null, draft => {
            if (draft.units[unit.instanceId]) {
              draft.units[unit.instanceId] = promoted as any;
            }
          });
          const freshAllies = StateQuery.liveAllies(store.getState());
          campaignManager.updateRoster(freshAllies);
          cleanup();
          this.showPromotionPanel(promotable, idx + 1, width, height, onDone);
        });
    });

    const skipBtn = this.add.text(panelX, panelY + panelH / 2 - 22, 'SKIP', {
      fontFamily: 'serif', fontSize: '14px', color: '#7a8a9e',
      backgroundColor: '#151a22', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    allObjects.push(skipBtn);

    skipBtn
      .on('pointerover', () => skipBtn.setColor('#ccc'))
      .on('pointerout', () => skipBtn.setColor('#7a8a9e'))
      .on('pointerdown', () => {
        cleanup();
        this.showPromotionPanel(promotable, idx + 1, width, height, onDone);
      });
  }

  // ── Continue / Defeat buttons ─────────────────────────────

  private showVictoryButton(
    data: { victory: boolean; turn: number; stageId?: string },
    width: number,
    height: number,
  ): void {
    const btnY = height / 2 + 70;
    const nextBtn = this.add.text(width / 2, btnY, '▶  CONTINUE', {
      fontFamily: 'serif', fontSize: '22px', color: '#c9a84c',
      backgroundColor: '#151a22', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    nextBtn
      .on('pointerover', () => nextBtn.setColor('#e8cc78'))
      .on('pointerout', () => nextBtn.setColor('#c9a84c'))
      .on('pointerdown', () => {
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
  }

  private showDefeatButtons(
    data: { victory: boolean; turn: number; stageId?: string },
    width: number,
    height: number,
  ): void {
    const btnY = height / 2 + 50;

    const retryBtn = this.add.text(width / 2 - 80, btnY, '↺  RETRY', {
      fontFamily: 'serif', fontSize: '22px', color: '#e8cc78',
      backgroundColor: '#151a22', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    retryBtn
      .on('pointerover', () => retryBtn.setColor('#fff'))
      .on('pointerout', () => retryBtn.setColor('#e8cc78'))
      .on('pointerdown', () => {
        this.scene.start('BattleScene', { stageId: data.stageId ?? 'stage_01' });
      });

    const titleBtn = this.add.text(width / 2 + 80, btnY, '🏠 TITLE', {
      fontFamily: 'serif', fontSize: '22px', color: '#7a8a9e',
      backgroundColor: '#151a22', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    titleBtn
      .on('pointerover', () => titleBtn.setColor('#ccc'))
      .on('pointerout', () => titleBtn.setColor('#7a8a9e'))
      .on('pointerdown', () => this.scene.start('TitleScene'));
  }
}
