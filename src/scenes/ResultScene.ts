import Phaser from 'phaser';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: { victory: boolean; turn: number }): void {
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

    this.add.rectangle(width / 2, height / 2, 480, 220, 0x0c0f16, 1)
      .setStrokeStyle(2, data.victory ? 0xc9a84c : 0xe74c3c);

    this.add.text(width / 2, height / 2 - 60, titleText, {
      fontFamily: 'serif', fontSize: '48px', color: titleColour,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, subText, {
      fontFamily: 'serif', fontSize: '20px', color: '#7a8a9e',
    }).setOrigin(0.5);

    const btn = this.add.text(width / 2, height / 2 + 70, '↺  RESTART', {
      fontFamily: 'serif', fontSize: '22px', color: '#c9a84c',
      backgroundColor: '#151a22', padding: { x: 20, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn
      .on('pointerover', () => btn.setColor('#e8cc78'))
      .on('pointerout',  () => btn.setColor('#c9a84c'))
      .on('pointerdown', () => this.scene.start('TitleScene'));
  }
}
