import Phaser from 'phaser';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { TILE_SIZE, SPRITE_SIZE } from '@/config';

const UNIT_COLOUR: Record<string, number> = { ally: 0x4ab3e0, enemy: 0xe74c3c };

export class UnitSprite {
  public container: Phaser.GameObjects.Container;
  private bodyCircle: Phaser.GameObjects.Arc;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFg: Phaser.GameObjects.Rectangle;
  private buffIndicator: Phaser.GameObjects.Arc;
  
  public unitId: string;
  public isMoving = false;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, unit: UnitInstance, startX: number, startY: number, startDepth: number) {
    this.scene = scene;
    
    this.container = scene.add.container(startX, startY);
    this.container.setDepth(startDepth);
    this.unitId = unit.instanceId;

    const cx = TILE_SIZE / 2;
    const cy = TILE_SIZE / 2 - 4;
    const col = UNIT_COLOUR[unit.team] ?? 0xffffff;

    // Body
    this.bodyCircle = scene.add.circle(cx, cy, SPRITE_SIZE / 2 - 2, col, 0.9);
    this.bodyCircle.setStrokeStyle(1.5, 0xffffff, 0.5);

    // HP Bar
    const barW = TILE_SIZE - 6;
    this.hpBarBg = scene.add.rectangle(3, TILE_SIZE - 7, barW, 4, 0x080c10).setOrigin(0, 0);
    this.hpBarFg = scene.add.rectangle(3, TILE_SIZE - 7, barW, 4, unit.team === 'ally' ? 0x2ecc71 : 0xe74c3c).setOrigin(0, 0);

    // Buff Dot
    this.buffIndicator = scene.add.circle(TILE_SIZE - 5, 5, 3, 0x4ab3e0, 0.9).setVisible(false);

    this.container.add([this.bodyCircle, this.hpBarBg, this.hpBarFg, this.buffIndicator]);
  }

  updateState(unit: UnitInstance): void {
    if (unit.hp <= 0) {
      this.container.setVisible(false);
      return;
    }
    
    this.container.setVisible(true);

    // Visual states
    const alpha = (unit.moved && unit.acted && unit.team === 'ally') ? 0.45 : 1.0;
    this.bodyCircle.setAlpha(alpha);

    // HP update
    const hpPct = unit.hp / unit.maxHp;
    this.hpBarFg.width = Math.round((TILE_SIZE - 6) * hpPct);

    // Buff update
    this.buffIndicator.setVisible(unit.buffs.length > 0);
  }

  setPosition(x: number, y: number, depth: number): void {
    this.container.setPosition(x, y);
    this.container.setDepth(depth);
  }

  async playMoveAnim(path: {x: number; y: number; depth: number}[]): Promise<void> {
    return new Promise((resolve) => {
        if (!path || path.length === 0) {
            resolve();
            return;
        }

        const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = path.map(pos => {
            return {
                targets: this.container,
                x: pos.x,
                y: pos.y,
                duration: 150,
                ease: 'Linear',
            };
        });

        this.isMoving = true;
        this.container.setDepth(999999); // Stay above all tiles during movement
        this.scene.tweens.chain({
            tweens,
            onComplete: () => {
                this.container.setDepth(path[path.length - 1]!.depth); // Restore final depth
                this.isMoving = false;
                resolve();
            }
        });
    });
  }
}
