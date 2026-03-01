// ─────────────────────────────────────────────
//  WorldInputHandler — Pointer/keyboard input for strategic world map
//  Translates clicks into WorldCoordinator calls via node hit-testing.
//  Mirrors InputHandler.ts pattern.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import type { WorldCoordinator } from '@/engine/coordinator/WorldCoordinator';
import type { WorldCameraController } from '@/engine/renderer/WorldCameraController';
import { WorldStateQuery } from '@/engine/strategic/state/WorldState';

const BASE_HIT_RADIUS = 22;

export class WorldInputHandler {
  private scene: Phaser.Scene;
  private coordinator: WorldCoordinator;
  private cameraCtrl: WorldCameraController;

  constructor(scene: Phaser.Scene, coordinator: WorldCoordinator, cameraCtrl: WorldCameraController) {
    this.scene = scene;
    this.coordinator = coordinator;
    this.cameraCtrl = cameraCtrl;

    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerup', this.onPointerUp, this);

    const kb = scene.input.keyboard;
    if (kb) {
      kb.on('keydown-ESC', () => this.coordinator.onCancel());
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    // Right-click → cancel
    if (pointer.rightButtonDown()) {
      this.coordinator.onCancel();
      return;
    }

    // If this was a camera drag, ignore as a click
    if (this.cameraCtrl.wasDrag()) return;

    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    // Hit test against nodes (scaled by zoom)
    const hitRadius = BASE_HIT_RADIUS / this.scene.cameras.main.zoom;
    const nodePositions = this.coordinator.getNodePositions();
    let hitNodeId: string | null = null;
    let minDist = hitRadius;

    for (const [nodeId, pos] of Object.entries(nodePositions)) {
      const dx = worldX - pos.x;
      const dy = worldY - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        hitNodeId = nodeId;
      }
    }

    if (hitNodeId) {
      // Check if player army exists at this node
      const state = this.coordinator.getState();
      const armiesAtNode = WorldStateQuery.armiesAtNode(state, hitNodeId);
      const playerArmy = armiesAtNode.find(a => a.factionId === state.playerFactionId);

      if (playerArmy) {
        this.coordinator.onArmyClick(playerArmy.id);
      } else {
        this.coordinator.onNodeClick(hitNodeId);
      }
    } else {
      this.coordinator.onEmptyClick();
    }
  }

  destroy(): void {
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.removeAllListeners();
  }
}
