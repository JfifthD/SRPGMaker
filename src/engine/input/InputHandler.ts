import Phaser from 'phaser';
import type { BattleCoordinator } from '@/engine/coordinator/BattleCoordinator';
import { TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y } from '@/config';

export class InputHandler {
  private scene: Phaser.Scene;
  private coordinator: BattleCoordinator;

  constructor(scene: Phaser.Scene, coordinator: BattleCoordinator) {
    this.scene = scene;
    this.coordinator = coordinator;
    this.registerPointer();
    this.registerKeyboard();
  }

  private registerPointer(): void {
    // Disable right click menu
    this.scene.input.mouse?.disableContextMenu();

    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown()) {
        this.coordinator.onCancel();
        return;
      }
      
      const tx = Math.floor((ptr.worldX - MAP_OFFSET_X) / (TILE_SIZE + 2));
      const ty = Math.floor((ptr.worldY - MAP_OFFSET_Y) / (TILE_SIZE + 2));
      this.coordinator.onTileClick(tx, ty);
    });

    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor((ptr.worldX - MAP_OFFSET_X) / (TILE_SIZE + 2));
      const ty = Math.floor((ptr.worldY - MAP_OFFSET_Y) / (TILE_SIZE + 2));
      this.coordinator.onTileHover(tx, ty);
    });
  }

  private registerKeyboard(): void {
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      this.coordinator.onCancel();
    });
  }

  destroy(): void {
    this.scene.input.removeAllListeners();
  }
}
