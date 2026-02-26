import Phaser from 'phaser';
import { EventBus } from '@/engine/utils/EventBus';
import type { ActionPayload } from '@/engine/coordinator/BattleCoordinator';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y } from '@/config';

const RADIUS = 60;

// ── Icon mapping for main actions ──
const ACTION_ICONS: Record<string, string> = {
  move: '🏃',
  attack: '⚔',
  skill: '✦',
  wait: '⏳',
  end: '⏭',
  back: '↩',
};

export class RingMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private buttons: Phaser.GameObjects.Container[] = [];
  private tooltip: Phaser.GameObjects.Container | null = null;
  private activeUnitId: string | null = null;
  private currentPayload: ActionPayload[] = [];
  private viewMode: 'main' | 'skills' = 'main';
  private cachedMainPayload: ActionPayload[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0).setDepth(999999).setVisible(false);

    EventBus.on('actionMenuUpdate', (e) => this.onActionUpdate(e.actions));
    EventBus.on('openRingMenu', (e) => this.open(e.unit, e.tx, e.ty));
    EventBus.on('closeRingMenu', () => this.close());
    EventBus.on('unitSelected', (e) => {
      if (!e.unit) this.close();
    });
  }

  private onActionUpdate(actions: ActionPayload[]) {
    this.cachedMainPayload = actions;
    if (this.viewMode === 'main') {
      this.currentPayload = actions;
      if (this.container.visible && this.activeUnitId) {
        this.renderButtons();
      }
    }
  }

  private open(unit: UnitInstance, tx: number, ty: number) {
    this.activeUnitId = unit.instanceId;
    this.viewMode = 'main';
    this.currentPayload = this.cachedMainPayload;

    const sx = tx * (TILE_SIZE + 2) + MAP_OFFSET_X + (TILE_SIZE / 2);
    const sy = ty * (TILE_SIZE + 2) + MAP_OFFSET_Y + (TILE_SIZE / 2);

    this.container.setPosition(sx, sy);
    this.renderButtons();

    this.scene.tweens.killTweensOf(this.container);
    this.container.setAlpha(0);
    this.container.setScale(0.5);
    this.container.setVisible(true);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  private close() {
    if (!this.container.visible) return;

    this.activeUnitId = null;
    this.hideTooltip();
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.5,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        this.clearButtons();
      },
    });
  }

  private clearButtons() {
    this.buttons.forEach(b => b.destroy());
    this.buttons = [];
  }

  // ── Tooltip System ──

  private showTooltip(action: ActionPayload, bx: number, by: number) {
    this.hideTooltip();

    const lines: string[] = [action.label];
    if (action.costAP > 0) lines.push(`AP: ${action.costAP}`);
    if (action.metadata?.mp) lines.push(`MP: ${action.metadata.mp}`);
    if (action.metadata?.range) lines.push(`Range: ${action.metadata.range}`);
    if (action.metadata?.desc) lines.push(action.metadata.desc);
    if (action.disabled && action.metadata?.disabledReason) {
      lines.push(`⚠ ${action.metadata.disabledReason}`);
    }

    const tipText = this.scene.add.text(0, 0, lines.join('\n'), {
      fontFamily: 'serif',
      fontSize: '11px',
      color: '#e8dcc8',
      backgroundColor: '#0c0f16',
      padding: { x: 8, y: 6 },
      wordWrap: { width: 160 },
      lineSpacing: 2,
    }).setOrigin(0.5, 1);

    const tipBg = this.scene.add.rectangle(
      0, 0,
      tipText.width + 16, tipText.height + 12,
      0x0c0f16, 0.95,
    ).setOrigin(0.5, 1).setStrokeStyle(1, 0xc9a84c);

    const tipY = by - 32;
    this.tooltip = this.scene.add.container(bx, tipY);
    this.tooltip.add([tipBg, tipText]);
    this.tooltip.setDepth(9999999);
    this.tooltip.setAlpha(0);
    this.scene.tweens.add({ targets: this.tooltip, alpha: 1, duration: 120 });
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  // ── Button Rendering ──

  private renderButtons() {
    this.clearButtons();
    if (!this.currentPayload.length) return;

    const sliceAngle = 360 / this.currentPayload.length;

    this.currentPayload.forEach((action, i) => {
      const angleDeg = -90 + (i * sliceAngle);
      const rad = Phaser.Math.DegToRad(angleDeg);
      const bx = Math.cos(rad) * RADIUS;
      const by = Math.sin(rad) * RADIUS;

      const btn = this.scene.add.container(bx, by);

      // Background circle
      const bgColor = action.disabled ? 0x1a1a22 : 0x151515;
      const borderColor = action.disabled ? 0x333344 : 0xc9a84c;
      const bg = this.scene.add.circle(0, 0, 22, bgColor);
      bg.setStrokeStyle(2, borderColor);

      // Icon or label text
      const icon = ACTION_ICONS[action.id] ?? '';
      const labelStr = icon || action.label.substring(0, 4);
      const textColor = action.disabled ? '#555566' : '#ccc4b0';
      const text = this.scene.add.text(0, 0, labelStr, {
        fontFamily: 'serif',
        fontSize: icon ? '16px' : '10px',
        color: textColor,
        align: 'center',
      }).setOrigin(0.5);

      btn.add([bg, text]);

      // Disabled visual
      if (action.disabled) {
        btn.setAlpha(0.5);
      }

      this.container.add(btn);
      this.buttons.push(btn);

      // Interactions
      const hitArea = new Phaser.Geom.Circle(0, 0, 22);
      btn.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

      if (!action.disabled) {
        btn.on('pointerover', () => {
          bg.setFillStyle(0x2a2a2a);
          this.scene.tweens.add({ targets: btn, scale: 1.15, duration: 100 });
          this.showTooltip(action, this.container.x + bx, this.container.y + by);
          EventBus.emit('ringMenuHover', { action });
        });

        btn.on('pointerout', () => {
          bg.setFillStyle(0x151515);
          this.scene.tweens.add({ targets: btn, scale: 1.0, duration: 100 });
          this.hideTooltip();
          EventBus.emit('ringMenuHoverEnd', {});
        });

        btn.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.scene.tweens.add({ targets: btn, scale: 0.9, duration: 50, yoyo: true });
          this.executeAction(action.id);
        });
      } else {
        // Disabled buttons still show tooltip on hover
        btn.on('pointerover', () => {
          this.showTooltip(action, this.container.x + bx, this.container.y + by);
        });
        btn.on('pointerout', () => {
          this.hideTooltip();
        });
      }
    });
  }

  private executeAction(id: string) {
    const battle = this.scene.scene.get('BattleScene') as any;

    switch (id) {
      case 'move':
        this.close();
        break;
      case 'attack':
        battle.activateAttack();
        this.close();
        break;
      case 'skill':
        this.openSkillSubMenu();
        break;
      case 'wait':
        battle.waitAction();
        this.close();
        break;
      case 'end':
        battle.endTurn();
        this.close();
        break;
      case 'back':
        this.viewMode = 'main';
        this.currentPayload = this.cachedMainPayload;
        this.scene.tweens.add({
          targets: this.container,
          scale: 0.1, alpha: 0, duration: 100,
          onComplete: () => {
            this.renderButtons();
            this.scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
          },
        });
        break;
      default:
        battle.activateSkill(id);
        this.close();
        break;
    }
  }

  private openSkillSubMenu() {
    const skillBtn = this.cachedMainPayload.find(a => a.id === 'skill');

    const payload: ActionPayload[] = [];
    payload.push({ id: 'back', label: 'BACK', costAP: 0, disabled: false });

    if (skillBtn?.metadata?.skills) {
      skillBtn.metadata.skills.forEach((sk: any) => {
        payload.push({
          id: sk.id,
          label: sk.name.substring(0, 5),
          costAP: sk.ap ?? 0,
          disabled: !sk.canUse,
          metadata: {
            desc: sk.desc ?? '',
            mp: sk.mp ?? 0,
            range: sk.range ?? 0,
            disabledReason: !sk.canUse ? '잔여 AP 또는 MP 부족' : undefined,
          },
        });
      });
    } else {
      payload.push({ id: 'error', label: 'NONE', costAP: 0, disabled: true });
    }

    this.currentPayload = payload;
    this.viewMode = 'skills';

    this.scene.tweens.add({
      targets: this.container,
      scale: 1.2, alpha: 0, duration: 100,
      onComplete: () => {
        this.renderButtons();
        this.scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
      },
    });
  }

  public destroy() {
    this.hideTooltip();
    this.container.destroy();
  }
}
