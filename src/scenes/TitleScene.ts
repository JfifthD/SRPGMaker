import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create(): void {
    const { width, height } = this.scale;

    // Background gradient (drawn on a RenderTexture)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x030508, 0x030508, 0x090e18, 0x090e18, 1);
    bg.fillRect(0, 0, width, height);

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

    const startBtn = this.add.text(width / 2, height * 0.65, '▶  START', {
      fontFamily: 'serif',
      fontSize: '28px',
      color: '#c9a84c',
      backgroundColor: '#151a22',
      padding: { x: 24, y: 12 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn
      .on('pointerover',  () => startBtn.setColor('#e8cc78'))
      .on('pointerout',   () => startBtn.setColor('#c9a84c'))
      .on('pointerdown',  () => this.scene.start('BattleScene', { stageId: 'stage_01' }));

    // Subtle star particle effect
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
