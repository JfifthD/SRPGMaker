// ─────────────────────────────────────────────
//  WorldMinimapDisplay — Fixed minimap for strategic world map
//  Mirrors MinimapDisplay.ts but renders graph nodes/edges instead of tile grid.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { WorldState } from '@/engine/strategic/state/WorldState';
import type { WorldCameraController } from './WorldCameraController';

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
const PADDING = 10;
const NODE_DOT_RADIUS = 3;
const ARMY_DOT_SIZE = 4;

export class WorldMinimapDisplay {
  private scene: Phaser.Scene;
  private cameraCtrl: WorldCameraController;
  private container: Phaser.GameObjects.Container;
  private bgGraphics: Phaser.GameObjects.Graphics;
  private edgeGraphics: Phaser.GameObjects.Graphics;
  private nodeGraphics: Phaser.GameObjects.Graphics;
  private armyGraphics: Phaser.GameObjects.Graphics;

  private worldMap: WorldMapData | null = null;
  private scaleX = 1;
  private scaleY = 1;

  constructor(scene: Phaser.Scene, cameraCtrl: WorldCameraController) {
    this.scene = scene;
    this.cameraCtrl = cameraCtrl;

    this.container = scene.add.container(
      scene.cameras.main.width - PADDING,
      scene.cameras.main.height - PADDING,
    ).setDepth(1_000_000).setScrollFactor(0);

    this.bgGraphics = scene.add.graphics();
    this.edgeGraphics = scene.add.graphics();
    this.nodeGraphics = scene.add.graphics();
    this.armyGraphics = scene.add.graphics();

    this.container.add([this.bgGraphics, this.edgeGraphics, this.nodeGraphics, this.armyGraphics]);
  }

  init(worldMap: WorldMapData, factionColors: Record<string, number>, state: WorldState): void {
    this.worldMap = worldMap;
    this.scaleX = MINIMAP_WIDTH / worldMap.mapWidth;
    this.scaleY = MINIMAP_HEIGHT / worldMap.mapHeight;

    // Background
    this.bgGraphics.clear();
    this.bgGraphics.fillStyle(0x000000, 0.6);
    this.bgGraphics.lineStyle(2, 0x444444, 0.8);
    this.bgGraphics.fillRect(-MINIMAP_WIDTH, -MINIMAP_HEIGHT, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    this.bgGraphics.strokeRect(-MINIMAP_WIDTH, -MINIMAP_HEIGHT, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Edges
    this.edgeGraphics.clear();
    this.edgeGraphics.lineStyle(1, 0x555555, 0.5);
    const nodeMap: Record<string, { x: number; y: number }> = {};
    for (const node of worldMap.nodes) {
      nodeMap[node.id] = { x: node.x, y: node.y };
    }
    for (const edge of worldMap.edges) {
      const from = nodeMap[edge.from];
      const to = nodeMap[edge.to];
      if (!from || !to) continue;
      this.edgeGraphics.lineBetween(
        -MINIMAP_WIDTH + from.x * this.scaleX,
        -MINIMAP_HEIGHT + from.y * this.scaleY,
        -MINIMAP_WIDTH + to.x * this.scaleX,
        -MINIMAP_HEIGHT + to.y * this.scaleY,
      );
    }

    // Nodes
    this.drawNodes(worldMap, factionColors, state);

    // Interaction zone
    const zone = this.scene.add.zone(
      -MINIMAP_WIDTH / 2,
      -MINIMAP_HEIGHT / 2,
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
    );
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.jumpCamera(pointer.x, pointer.y);
    });
    this.container.add(zone);
  }

  private drawNodes(worldMap: WorldMapData, factionColors: Record<string, number>, state: WorldState): void {
    this.nodeGraphics.clear();
    for (const node of worldMap.nodes) {
      const territory = state.territories[node.id];
      const ownerColor = territory?.owner ? (factionColors[territory.owner] ?? 0xaaaaaa) : 0x666666;

      const mx = -MINIMAP_WIDTH + node.x * this.scaleX;
      const my = -MINIMAP_HEIGHT + node.y * this.scaleY;

      this.nodeGraphics.fillStyle(ownerColor, 1);
      this.nodeGraphics.fillCircle(mx, my, NODE_DOT_RADIUS);
    }
  }

  updateArmies(state: WorldState, factionColors: Record<string, number>): void {
    if (!this.worldMap) return;

    this.armyGraphics.clear();
    const nodeMap: Record<string, { x: number; y: number }> = {};
    for (const node of this.worldMap.nodes) {
      nodeMap[node.id] = { x: node.x, y: node.y };
    }

    for (const army of Object.values(state.armies)) {
      const pos = nodeMap[army.locationNodeId];
      if (!pos) continue;

      const color = factionColors[army.factionId] ?? 0xffffff;
      const mx = -MINIMAP_WIDTH + pos.x * this.scaleX;
      const my = -MINIMAP_HEIGHT + pos.y * this.scaleY - 5;

      this.armyGraphics.fillStyle(color, 0.9);
      this.armyGraphics.fillRect(mx - ARMY_DOT_SIZE / 2, my - ARMY_DOT_SIZE / 2, ARMY_DOT_SIZE, ARMY_DOT_SIZE);
    }

    // Also refresh node colors
    this.drawNodes(this.worldMap, factionColors, state);
  }

  private jumpCamera(screenX: number, screenY: number): void {
    if (!this.worldMap) return;

    const containerX = this.scene.cameras.main.width - PADDING;
    const containerY = this.scene.cameras.main.height - PADDING;

    const mx = screenX - (containerX - MINIMAP_WIDTH);
    const my = screenY - (containerY - MINIMAP_HEIGHT);

    const worldX = mx / this.scaleX;
    const worldY = my / this.scaleY;

    if (worldX >= 0 && worldX <= this.worldMap.mapWidth && worldY >= 0 && worldY <= this.worldMap.mapHeight) {
      this.cameraCtrl.focusOnPosition(worldX, worldY);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
