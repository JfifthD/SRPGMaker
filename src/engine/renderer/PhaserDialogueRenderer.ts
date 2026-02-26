// ─────────────────────────────────────────────
//  PhaserDialogueRenderer
//  Phaser 3 implementation of IDialogueRenderer.
//  Handles all visual presentation of dialogue:
//    - Text box + name plate
//    - Typewriter effect (skip on first tap → advance on second)
//    - Character portraits (left / right sides, emotion variants)
//    - Choice buttons
//    - Background image (scenario mode)
//    - Camera shake / flash effects
//
//  Two modes:
//    'scenario'       → tall text box, full portrait support, background
//    'battle_overlay' → compact box, no full background swap
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import type { IDialogueRenderer } from './IDialogueRenderer';
import type { DialogueLine, PortraitEmotion } from '@/engine/data/types/Dialogue';

const TYPEWRITER_MS_PER_CHAR = 28; // ms per character

export class PhaserDialogueRenderer implements IDialogueRenderer {
  private readonly scene: Phaser.Scene;
  private readonly mode: 'scenario' | 'battle_overlay';

  // ── UI Objects ───────────────────────────────────────────
  private container!: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private nameTag!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private advanceIndicator!: Phaser.GameObjects.Triangle;

  private clickZone!: Phaser.GameObjects.Rectangle;
  private portraitLeft: Phaser.GameObjects.Rectangle | null = null;
  private portraitRight: Phaser.GameObjects.Rectangle | null = null;
  private background: Phaser.GameObjects.Image | null = null;

  // ── Typewriter State ─────────────────────────────────────
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private typewriterDone = false;
  private typewriterResolve: (() => void) | null = null;
  private fullText = '';

  constructor(scene: Phaser.Scene, mode: 'scenario' | 'battle_overlay') {
    this.scene = scene;
    this.mode = mode;
    this.buildUI();
  }

  // ── Build UI ─────────────────────────────────────────────

  private buildUI(): void {
    const { width, height } = this.scene.scale;
    const boxH = this.mode === 'scenario' ? 220 : 130;
    const boxY = height - boxH / 2 - 10;

    // Full-screen click zone to capture taps (invisible, sits behind dialogue but above map)
    this.clickZone = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.001)
      .setScrollFactor(0)
      .setDepth(499999)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    this.clickZone.on('pointerdown', () => {
      this.advance();
    });

    // Semi-transparent backdrop
    this.backdrop = this.scene.add
      .rectangle(width / 2, boxY, width - 32, boxH, 0x0a0d1a, 0.88)
      .setScrollFactor(0)
      .setDepth(500000);

    // Name plate
    this.nameTag = this.scene.add
      .text(30, height - boxH - 8, '', {
        fontFamily: '"Palatino Linotype", serif',
        fontSize: '17px',
        color: '#c9a84c',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(500001);

    // Body text
    this.bodyText = this.scene.add
      .text(30, height - boxH + 14, '', {
        fontFamily: '"Palatino Linotype", serif',
        fontSize: '15px',
        color: '#e8e0cc',
        wordWrap: { width: width - 72 },
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(500001);

    // Advance indicator (blinking triangle ▼)
    this.advanceIndicator = this.scene.add
      .triangle(width - 24, height - 18, 0, 0, 14, 0, 7, 11, 0xc9a84c)
      .setScrollFactor(0)
      .setDepth(500002)
      .setVisible(false);

    // Blink the indicator
    this.scene.tweens.add({
      targets: this.advanceIndicator,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Group into container (toggled for show/hide)
    this.container = this.scene.add
      .container(0, 0, [this.backdrop, this.nameTag, this.bodyText, this.advanceIndicator])
      .setDepth(500000)
      .setVisible(false);
  }

  // ── Lifecycle ─────────────────────────────────────────────

  show(): void {
    this.container.setVisible(true);
    this.clickZone.setVisible(true);
    // Fade in
    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: 200,
    });
  }

  hide(): void {
    this.clickZone.setVisible(false);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 150,
      onComplete: () => this.container.setVisible(false),
    });
    this.hidePortrait('left');
    this.hidePortrait('right');
  }

  // ── Line Display ─────────────────────────────────────────

  async displayLine(line: DialogueLine): Promise<void> {
    const text = line.text ?? '';
    const speaker = line.speaker ?? '';

    // Update name plate
    if (line.type === 'narration') {
      this.nameTag.setText('');
      this.bodyText.setStyle({ fontStyle: 'italic', color: '#b0a090' });
    } else {
      this.nameTag.setText(speaker ? speaker.toUpperCase() : '');
      this.bodyText.setStyle({ fontStyle: 'normal', color: '#e8e0cc' });
    }

    // Portrait update
    if (speaker && line.side && line.emotion) {
      this.showPortrait(speaker, line.emotion, line.side, true);
      const otherSide = line.side === 'left' ? 'right' : 'left';
      const otherPortrait = otherSide === 'left' ? this.portraitLeft : this.portraitRight;
      if (otherPortrait) otherPortrait.setAlpha(0.45);
    }

    // Reset typewriter state
    this.bodyText.setText('');
    this.advanceIndicator.setVisible(false);
    this.typewriterDone = false;
    this.fullText = text;

    return new Promise<void>(resolve => {
      this.typewriterResolve = resolve;

      if (text.length === 0) {
        this.typewriterDone = true;
        this.advanceIndicator.setVisible(true);
        return;
      }

      let charIndex = 0;
      this.typewriterTimer = this.scene.time.addEvent({
        delay: TYPEWRITER_MS_PER_CHAR,
        repeat: text.length - 1,
        callback: () => {
          charIndex++;
          this.bodyText.setText(text.slice(0, charIndex));
          if (charIndex >= text.length) {
            this.typewriterDone = true;
            this.advanceIndicator.setVisible(true);
            // DO NOT resolve here — wait for player's second tap via advance()
          }
        },
      });
    });
  }

  skipTypewriter(): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove(false);
      this.typewriterTimer = null;
    }
    this.bodyText.setText(this.fullText);
    this.typewriterDone = true;
    this.advanceIndicator.setVisible(true);
  }

  /**
   * Two-tap advance pattern (Fire Emblem / Tactics Ogre style):
   *   tap 1 → skip typewriter, show full text
   *   tap 2 → go to next line (resolve the Promise)
   */
  advance(): void {
    if (!this.typewriterDone) {
      // First tap: skip animation
      this.skipTypewriter();
    } else {
      // Second tap: advance to next line
      if (this.typewriterResolve) {
        const fn = this.typewriterResolve;
        this.typewriterResolve = null;
        fn();
      }
    }
  }

  // ── Background ────────────────────────────────────────────

  setBackground(key: string | null): void {
    if (this.background) {
      this.background.destroy();
      this.background = null;
    }
    if (key && this.scene.textures.exists(key)) {
      this.background = this.scene.add
        .image(this.scene.scale.width / 2, this.scene.scale.height / 2, key)
        .setScrollFactor(0)
        .setDepth(499998);
    }
  }

  // ── Portraits ─────────────────────────────────────────────

  showPortrait(
    characterKey: string,
    emotion: PortraitEmotion,
    side: 'left' | 'right',
    active: boolean,
  ): void {
    const textureKey = `portrait_${characterKey}_${emotion}`;
    const { width, height } = this.scene.scale;
    const x = side === 'left' ? 100 : width - 100;
    const y = height - 260;

    // Remove previous portrait on this side
    const existing = side === 'left' ? this.portraitLeft : this.portraitRight;
    if (existing) existing.destroy();

    // Fallback: draw a colored placeholder rectangle when no texture exists
    const portrait = this.scene.textures.exists(textureKey)
      ? (this.scene.add.image(x, y, textureKey) as unknown as Phaser.GameObjects.Rectangle)
      : (() => {
          const color = side === 'left' ? 0x4a6080 : 0x805040;
          const rect = this.scene.add.rectangle(x, y, 80, 120, color);
          const initial = this.scene.add.text(x, y, characterKey[0]?.toUpperCase() ?? '?', {
            fontFamily: 'serif', fontSize: '32px', color: '#ffffff',
          }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
          // Attach the label to the rect's destroy lifecycle
          rect.on('destroy', () => initial.destroy());
          return rect;
        })();

    portrait
      .setScrollFactor(0)
      .setDepth(500000)
      .setAlpha(active ? 1 : 0.45);

    if (side === 'left') this.portraitLeft = portrait;
    else this.portraitRight = portrait;
  }

  hidePortrait(side: 'left' | 'right'): void {
    if (side === 'left' && this.portraitLeft) {
      this.portraitLeft.destroy();
      this.portraitLeft = null;
    }
    if (side === 'right' && this.portraitRight) {
      this.portraitRight.destroy();
      this.portraitRight = null;
    }
  }

  // ── Choices ───────────────────────────────────────────────

  async showChoices(labels: string[]): Promise<number> {
    return new Promise(resolve => {
      const { width, height } = this.scene.scale;
      const totalH = labels.length * 52;
      const startY = height / 2 - totalH / 2 + 20;

      const buttons: Phaser.GameObjects.Container[] = labels.map((label, i) => {
        const y = startY + i * 52;

        const bg = this.scene.add.rectangle(width / 2, y, 320, 44, 0x1a2233, 0.95)
          .setScrollFactor(0).setDepth(500010)
          .setStrokeStyle(1, 0xc9a84c, 0.7);

        const txt = this.scene.add.text(width / 2, y, `▶  ${label}`, {
          fontFamily: '"Palatino Linotype", serif',
          fontSize: '16px',
          color: '#e8e0cc',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(500011)
          .setInteractive({ cursor: 'pointer' });

        txt.on('pointerover', () => {
          bg.setFillStyle(0x384060, 0.95);
          txt.setColor('#c9a84c');
        });
        txt.on('pointerout', () => {
          bg.setFillStyle(0x1a2233, 0.95);
          txt.setColor('#e8e0cc');
        });
        txt.on('pointerdown', () => {
          buttons.forEach(b => b.destroy());
          resolve(i);
        });

        return this.scene.add.container(0, 0, [bg, txt]).setScrollFactor(0).setDepth(500010);
      });
    });
  }

  // ── Effects ───────────────────────────────────────────────

  shake(intensity = 8): void {
    this.scene.cameras.main.shake(300, intensity * 0.001);
  }

  flash(color = 0xffffff, duration = 200): void {
    this.scene.cameras.main.flash(
      duration,
      (color >> 16) & 255,
      (color >> 8) & 255,
      color & 255,
    );
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this.typewriterTimer?.remove(false);
    this.clickZone?.off('pointerdown');
    this.container.destroy();
    this.background?.destroy();
    this.portraitLeft?.destroy();
    this.portraitRight?.destroy();
  }
}
