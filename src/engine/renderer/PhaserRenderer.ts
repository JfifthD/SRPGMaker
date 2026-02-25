import Phaser from 'phaser';
import type { IRenderer, HighlightMode } from './IRenderer';
import type { BattleState } from '@/engine/state/BattleState';
import type { Pos } from '@/engine/data/types/Map';
import type { TerrainKey, TerrainData } from '@/engine/data/types/Terrain';
import { UnitSprite } from '@/scenes/UnitSprite';
import { TILE_SIZE, SPRITE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y } from '@/config';
import terrainJson from '@/assets/data/terrains.json';

const TERRAIN_MAP: Record<string, TerrainData> = Object.fromEntries(
  (terrainJson as TerrainData[]).map(t => [t.key, t]),
);

const COL: Record<string, number> = {
  moveRange:  0x2e7a2e,
  atkRange:   0x7a2020,
  skillRange: 0x4a2080,
  selected:   0xc9a84c,
  plain:      0x1a2a1a,
  forest:     0x0d1f0d,
  mountain:   0x2a2520,
  water:      0x0a1520,
  wall:       0x2a2220,
  ruins:      0x1e1a14,
  burning_forest: 0x3a1a0a,
  frozen_water:   0x0a2030,
};

export class PhaserRenderer implements IRenderer {
  private scene: Phaser.Scene;
  private lastState: BattleState | null = null;

  private tileObjects: Phaser.GameObjects.GameObject[] = [];
  private rangeGraphics: Phaser.GameObjects.Graphics;
  private effectGraphics: Phaser.GameObjects.Graphics;
  private dangerZoneGraphics: Phaser.GameObjects.Graphics;
  
  // UI Overlays
  private apPreviewText: Phaser.GameObjects.Text;
  private facingGraphics: Phaser.GameObjects.Graphics;

  private unitSprites: Map<string, UnitSprite> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Graphics layers (drawn in order)
    this.rangeGraphics  = scene.add.graphics().setDepth(99999);
    this.effectGraphics = scene.add.graphics().setDepth(99999);
    this.dangerZoneGraphics = scene.add.graphics().setDepth(50000); // Above map tiles (0-1000), below highlights (99999)
    
    this.facingGraphics = scene.add.graphics().setDepth(100000); // Topmost
    this.apPreviewText = scene.add.text(0, 0, '', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(100001).setVisible(false);
  }

  private getElev(x: number, y: number, state: BattleState): number {
    return state.mapData.elevation?.[y]?.[x] ?? 0;
  }

  private tileToScreen(x: number, y: number, elev: number = 0): { sx: number; sy: number; depth: number } {
    const ELEV_STEP = 12;
    return {
      sx: x * (TILE_SIZE + 2) + MAP_OFFSET_X,
      sy: y * (TILE_SIZE + 2) - elev * ELEV_STEP + MAP_OFFSET_Y,
      depth: y * 100 + x * 2
    };
  }

  renderMap(state: BattleState): void {
    for (const t of this.tileObjects) t.destroy();
    this.tileObjects = [];

    for (let y = 0; y < state.mapData.height; y++) {
      for (let x = 0; x < state.mapData.width; x++) {
        const key = state.mapData.terrain[y]?.[x] as TerrainKey ?? 'plain';
        const elev = this.getElev(x, y, state);
        const colour = COL[key] ?? COL.plain;
        const { sx, sy, depth } = this.tileToScreen(x, y, elev);
        
        // Draw 2.5D cliff base
        if (elev > 0) {
           const cliff = this.scene.add.rectangle(sx, sy, TILE_SIZE, TILE_SIZE + elev * 12, 0x151515)
              .setOrigin(0,0).setDepth(depth - 0.2);
           this.tileObjects.push(cliff);
        }

        // Top face
        const rect = this.scene.add.rectangle(sx, sy, TILE_SIZE, TILE_SIZE, colour)
          .setOrigin(0,0).setDepth(depth - 0.1);
        rect.setStrokeStyle(1.5, 0x242d3d, 0.5);
        this.tileObjects.push(rect);
      }
    }
  }

  syncUnits(state: BattleState): void {
    this.lastState = state;
    for (const unit of Object.values(state.units)) {
      let sprite = this.unitSprites.get(unit.instanceId);
      const elev = this.getElev(unit.x, unit.y, state);
      const { sx, sy, depth } = this.tileToScreen(unit.x, unit.y, elev);
      
      if (!sprite && unit.hp > 0) {
        sprite = new UnitSprite(this.scene, unit, sx, sy, depth + 1);
        this.unitSprites.set(unit.instanceId, sprite);
      }
      
      if (sprite) {
        sprite.updateState(unit);
        // Don't teleport while a move tween is running
        if (!sprite.isMoving) {
          sprite.setPosition(sx, sy, depth + 1);
        }
      }
    }
  }

  destroyUnit(unitId: string): void {
    const sprite = this.unitSprites.get(unitId);
    if (sprite) {
      sprite.container.destroy();
      this.unitSprites.delete(unitId);
    }
  }

  highlightTiles(tiles: Pos[], mode: HighlightMode): void {
    const g = this.rangeGraphics;
    
    let color = COL.selected ?? 0xc9a84c;
    if (mode === 'move') color = COL.moveRange ?? 0x2e7a2e;
    if (mode === 'attack') color = COL.atkRange ?? 0x7a2020;
    if (mode === 'skill') color = COL.skillRange ?? 0x4a2080;

    g.clear();
    for (const tile of tiles) {
      const elev = this.lastState ? this.getElev(tile.x, tile.y, this.lastState) : 0;
      const { sx, sy } = this.tileToScreen(tile.x, tile.y, elev);
      g.lineStyle(2, color, 0.9);
      g.strokeRoundedRect(sx, sy, TILE_SIZE, TILE_SIZE, 3);

      if (mode !== 'selected') {
        g.fillStyle(color, 0.15);
        g.fillRoundedRect(sx, sy, TILE_SIZE, TILE_SIZE, 3);
      }
    }
  }

  clearHighlights(): void {
    this.rangeGraphics.clear();
  }

  // ── AP & Facing UI ─────────────────────────────
  
  showAPPreview(x: number, y: number, cost: number): void {
    const elev = this.lastState ? this.getElev(x, y, this.lastState) : 0;
    const { sx, sy } = this.tileToScreen(x, y, elev);
    
    this.apPreviewText.setText(`-${cost} AP`);
    // Position text above the tile center
    this.apPreviewText.setPosition(sx + TILE_SIZE / 2, sy);
    this.apPreviewText.setVisible(true);
  }

  hideAPPreview(): void {
    this.apPreviewText.setVisible(false);
  }

  showFacingSelection(unitX: number, unitY: number): void {
    const g = this.facingGraphics;
    g.clear();
    const elev = this.lastState ? this.getElev(unitX, unitY, this.lastState) : 0;
    const { sx, sy } = this.tileToScreen(unitX, unitY, elev);
    
    const cx = sx + TILE_SIZE / 2;
    const cy = sy + TILE_SIZE / 2;
    const offset = TILE_SIZE * 0.8;
    
    g.lineStyle(3, 0xffff00, 1.0);
    g.fillStyle(0xffff00, 0.4);
    
    // Helper to draw a small triangle arrow
    const drawArrow = (x: number, y: number, angle: number) => {
      g.save();
      g.translateCanvas(x, y);
      g.rotateCanvas(angle);
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(8, 6);
      g.lineTo(-8, 6);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.restore();
    };

    // N (up), E (right), S (down), W (left)
    drawArrow(cx, cy - offset, 0);                 // N
    drawArrow(cx + offset, cy, Math.PI / 2);       // E
    drawArrow(cx, cy + offset, Math.PI);           // S
    drawArrow(cx - offset, cy, -Math.PI / 2);      // W
  }

  hideFacingSelection(): void {
    this.facingGraphics.clear();
  }

  async animateMove(unitId: string, path: Pos[]): Promise<void> {
    const sprite = this.unitSprites.get(unitId);
    if (!sprite) return;
    // Use cached state — no await before playMoveAnim so isMoving is set
    // synchronously before store.notify() → syncUnits can fire setPosition.
    const state = this.lastState;
    const mappedPath = path.map(p => {
      const elev = state ? this.getElev(p.x, p.y, state) : 0;
      const { sx, sy, depth } = this.tileToScreen(p.x, p.y, elev);
      return { x: sx, y: sy, depth: depth + 1 };
    });
    await sprite.playMoveAnim(mappedPath);
  }

  animateAttack(attackerId: string, defenderId: string): Promise<void> {
    return new Promise(resolve => {
      this.scene.cameras.main.shake(180, 0.006);
      this.scene.time.delayedCall(180, resolve);
    });
  }

  animateSkillCast(casterId: string, skillId: string, targets: Pos[]): Promise<void> {
    return new Promise(resolve => {
      const sprite = this.unitSprites.get(casterId);
      if (!sprite) {
        resolve();
         return;
      }
      const x = sprite.container.x;
      const y = sprite.container.y;

      const pulse = this.scene.add.circle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, SPRITE_SIZE, 0xa060ff, 0.5);
      this.scene.tweens.add({
        targets: pulse, alpha: 0, scaleX: 2, scaleY: 2,
        duration: 350, ease: 'Quad.easeOut',
        onComplete: () => {
          pulse.destroy();
          resolve();
        },
      });
    });
  }

  showDamageNumber(pos: Pos, dmg: number, crit: boolean): void {
    const elev = this.lastState ? this.getElev(pos.x, pos.y, this.lastState) : 0;
    const { sx, sy } = this.tileToScreen(pos.x, pos.y, elev);
    const cx = sx + TILE_SIZE / 2 + Phaser.Math.Between(-8, 8);
    const cy = sy;

    const txt = this.scene.add.text(cx, cy, crit ? `💥${dmg}` : `-${dmg}`, {
      fontSize: crit ? '22px' : '18px',
      fontFamily: 'serif',
      color: '#ff6b6b',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(99999);

    this.scene.tweens.add({
      targets: txt,
      y: cy - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  showHealNumber(pos: Pos, amount: number): void {
    const elev = this.lastState ? this.getElev(pos.x, pos.y, this.lastState) : 0;
    const { sx, sy } = this.tileToScreen(pos.x, pos.y, elev);
    const cx = sx + TILE_SIZE / 2;
    const cy = sy;

    const txt = this.scene.add.text(cx, cy, `+${amount}`, {
      fontSize: '18px',
      fontFamily: 'serif',
      color: '#4ab3e0',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(99999);

    this.scene.tweens.add({
      targets: txt,
      y: cy - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  showMissText(pos: Pos): void {
    const elev = this.lastState ? this.getElev(pos.x, pos.y, this.lastState) : 0;
    const { sx, sy } = this.tileToScreen(pos.x, pos.y, elev);
    const txt = this.scene.add.text(sx + TILE_SIZE / 2, sy, "Miss", {
      fontSize: '18px',
      color: '#aaaaaa',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(99999);

    this.scene.tweens.add({
      targets: txt, y: sy - 40, alpha: 0, duration: 800,
      onComplete: () => txt.destroy()
    });
  }

  focusTile(pos: Pos): void {
      // Stub
  }

  renderDangerZone(tiles: Set<string>): void {
    this.dangerZoneGraphics.clear();
    const state = this.lastState;
    for (const key of tiles) {
      const parts = key.split(',');
      const x = parseInt(parts[0] ?? '0', 10);
      const y = parseInt(parts[1] ?? '0', 10);
      const elev = state ? this.getElev(x, y, state) : 0;
      const { sx, sy } = this.tileToScreen(x, y, elev);
      this.dangerZoneGraphics.fillStyle(0xff2020, 0.28);
      this.dangerZoneGraphics.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }
  }

  clearDangerZone(): void {
    this.dangerZoneGraphics.clear();
  }

  update(time: number, delta: number): void {
    // Stub
  }

  destroy(): void {
    for (const t of this.tileObjects) t.destroy();
    this.tileObjects = [];

    this.rangeGraphics.destroy();
    this.effectGraphics.destroy();
    this.dangerZoneGraphics.destroy();
    for (const sprite of this.unitSprites.values()) {
        sprite.container.destroy();
    }
    this.unitSprites.clear();
  }
}
