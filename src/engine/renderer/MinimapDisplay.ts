import Phaser from 'phaser';
import type { BattleState } from '@/engine/state/BattleState';
import { StateQuery } from '@/engine/state/BattleState';
import { CameraController } from './CameraController';
import type { TerrainKey } from '@/engine/data/types/Terrain';

const MINIMAP_TILE_SIZE = 4;
const PADDING = 10;

export class MinimapDisplay {
  private scene: Phaser.Scene;
  private cameraCtrl: CameraController;
  
  private container: Phaser.GameObjects.Container;
  private bgGraphics: Phaser.GameObjects.Graphics;
  private mapGraphics: Phaser.GameObjects.Graphics;
  private unitGraphics: Phaser.GameObjects.Graphics;
  
  private widthPx: number = 0;
  private heightPx: number = 0;

  constructor(scene: Phaser.Scene, cameraCtrl: CameraController) {
    this.scene = scene;
    this.cameraCtrl = cameraCtrl;

    this.container = scene.add.container(
      scene.cameras.main.width - PADDING,
      scene.cameras.main.height - PADDING
    ).setDepth(1000000); // Fixed UI layer, above everything

    // Scroll factor 0 so it stays fixed to the screen
    this.container.setScrollFactor(0);

    this.bgGraphics = scene.add.graphics();
    this.mapGraphics = scene.add.graphics();
    this.unitGraphics = scene.add.graphics();

    this.container.add([this.bgGraphics, this.mapGraphics, this.unitGraphics]);

    // Handle clicks on minimap to jump camera
    // We attach an invisible interactive zone over the minimap once bounds are known
  }

  public init(state: BattleState): void {
    const cols = state.mapData.width;
    const rows = state.mapData.height;

    this.widthPx = cols * MINIMAP_TILE_SIZE;
    this.heightPx = rows * MINIMAP_TILE_SIZE;

    // Origin is bottom-right corner based on Container position
    this.bgGraphics.clear();
    this.bgGraphics.fillStyle(0x000000, 0.6);
    this.bgGraphics.lineStyle(2, 0x444444, 0.8);
    this.bgGraphics.fillRect(-this.widthPx, -this.heightPx, this.widthPx, this.heightPx);
    this.bgGraphics.strokeRect(-this.widthPx, -this.heightPx, this.widthPx, this.heightPx);

    // Draw static terrain once
    this.drawTerrain(state);

    // Setup Interaction Zone
    const zone = this.scene.add.zone(
      -this.widthPx / 2, 
      -this.heightPx / 2, 
      this.widthPx, 
      this.heightPx
    );
    zone.setInteractive({ useHandCursor: true });
    
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.jumpCameraToMinimapPos(pointer.x, pointer.y, state);
    });

    this.container.add(zone);
  }

  private drawTerrain(state: BattleState): void {
    const cols = state.mapData.width;
    const rows = state.mapData.height;
    
    this.mapGraphics.clear();

    const colorMap: Record<TerrainKey | string, number> = {
      plain: 0x3a4a3a,
      forest: 0x1d2f1d,
      mountain: 0x4a4540,
      water: 0x1a2530,
      wall: 0x5a5250,
      ruins: 0x3e3a34,
      burning_forest: 0x5a2a1a,
      frozen_water: 0x2a4050,
      bridge: 0x614f3f
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const key = state.mapData.terrain[y]?.[x] as TerrainKey ?? 'plain';
        const color = colorMap[key] ?? 0x333333;

        const mx = -this.widthPx + x * MINIMAP_TILE_SIZE;
        const my = -this.heightPx + y * MINIMAP_TILE_SIZE;
        
        this.mapGraphics.fillStyle(color, 1);
        this.mapGraphics.fillRect(mx, my, MINIMAP_TILE_SIZE, MINIMAP_TILE_SIZE);
      }
    }
  }

  public updateBase(state: BattleState): void {
    // Redraw units every turn or move
    this.unitGraphics.clear();

    for (const unit of Object.values(state.units)) {
      if (unit.hp <= 0) continue;

      const mx = -this.widthPx + unit.x * MINIMAP_TILE_SIZE;
      const my = -this.heightPx + unit.y * MINIMAP_TILE_SIZE;

      const color = unit.team === 'ally' ? 0x44aadd : 0xdd4444;
      
      this.unitGraphics.fillStyle(color, 1);
      this.unitGraphics.fillRect(mx, my, MINIMAP_TILE_SIZE, MINIMAP_TILE_SIZE);
    }
  }

  private jumpCameraToMinimapPos(screenX: number, screenY: number, state: BattleState): void {
    // Get mouse pos relative to the minimap container top-left
    // container is at (scene_w - PADDING, scene_h - PADDING)
    // top-left of minimap is container - (widthPx, heightPx)
    
    const containerX = this.scene.cameras.main.width - PADDING;
    const containerY = this.scene.cameras.main.height - PADDING;

    const mx = screenX - (containerX - this.widthPx);
    const my = screenY - (containerY - this.heightPx);

    const tileX = Math.floor(mx / MINIMAP_TILE_SIZE);
    const tileY = Math.floor(my / MINIMAP_TILE_SIZE);

    if (tileX >= 0 && tileX < state.mapData.width && tileY >= 0 && tileY < state.mapData.height) {
      const elev = state.mapData.elevation?.[tileY]?.[tileX] ?? 0;
      this.cameraCtrl.focusOnTile(tileX, tileY, elev);
    }
  }

  public destroy(): void {
    this.container.destroy();
  }
}
