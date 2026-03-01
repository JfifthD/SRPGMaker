// ─────────────────────────────────────────────
//  WorldCameraController — Pan/zoom for strategic world map
//  Mirrors CameraController.ts but uses free-form coordinates (no tile math).
// ─────────────────────────────────────────────

import Phaser from 'phaser';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const ZOOM_LERP = 0.1;
const DRAG_THRESHOLD = 4; // Pixels before drag starts (prevents click-drag conflict)
const FOCUS_DURATION = 400;

export class WorldCameraController {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private dragActivated = false;

  private targetZoom: number;
  private mapWidthPx = 800;
  private mapHeightPx = 600;

  private nodePositions: Record<string, { x: number; y: number }> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.targetZoom = this.camera.zoom;

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('wheel', this.onWheel, this);
  }

  setMapBounds(w: number, h: number): void {
    this.mapWidthPx = w;
    this.mapHeightPx = h;
  }

  setNodePositions(positions: Record<string, { x: number; y: number }>): void {
    this.nodePositions = positions;
  }

  focusOnNode(nodeId: string): void {
    const pos = this.nodePositions[nodeId];
    if (!pos) return;
    this.focusOnPosition(pos.x, pos.y);
  }

  focusOnPosition(x: number, y: number): void {
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: x - this.camera.width / (2 * this.camera.zoom),
      scrollY: y - this.camera.height / (2 * this.camera.zoom),
      duration: FOCUS_DURATION,
      ease: 'Cubic.easeOut',
    });
  }

  /** Returns true if the last pointer interaction was a drag (not a click). */
  wasDrag(): boolean {
    return this.dragActivated;
  }

  update(_delta: number): void {
    // Smooth zoom lerp
    if (Math.abs(this.camera.zoom - this.targetZoom) > 0.01) {
      this.camera.zoom += (this.targetZoom - this.camera.zoom) * ZOOM_LERP;
    }
    this.constrainCamera();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.isDragging = true;
    this.dragActivated = false;
    this.pointerDownX = pointer.x;
    this.pointerDownY = pointer.y;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.camStartX = this.camera.scrollX;
    this.camStartY = this.camera.scrollY;
  }

  private onPointerUp(_pointer: Phaser.Input.Pointer): void {
    this.isDragging = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return;

    const totalDx = pointer.x - this.pointerDownX;
    const totalDy = pointer.y - this.pointerDownY;
    const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

    if (totalDist >= DRAG_THRESHOLD) {
      this.dragActivated = true;
    }

    if (!this.dragActivated) return;

    const dx = (pointer.x - this.dragStartX) / this.camera.zoom;
    const dy = (pointer.y - this.dragStartY) / this.camera.zoom;

    this.camera.scrollX = this.camStartX - dx;
    this.camera.scrollY = this.camStartY - dy;
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    if (deltaY > 0) {
      this.targetZoom = Math.max(MIN_ZOOM, this.targetZoom - ZOOM_STEP);
    } else if (deltaY < 0) {
      this.targetZoom = Math.min(MAX_ZOOM, this.targetZoom + ZOOM_STEP);
    }
  }

  private constrainCamera(): void {
    const viewW = this.camera.width / this.camera.zoom;
    const viewH = this.camera.height / this.camera.zoom;

    const minX = -viewW / 2;
    const minY = -viewH / 2;
    const maxX = this.mapWidthPx - viewW / 2;
    const maxY = this.mapHeightPx - viewH / 2;

    if (this.camera.scrollX < minX) this.camera.scrollX = minX;
    if (this.camera.scrollY < minY) this.camera.scrollY = minY;
    if (this.camera.scrollX > maxX) this.camera.scrollX = maxX;
    if (this.camera.scrollY > maxY) this.camera.scrollY = maxY;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('wheel', this.onWheel, this);
  }
}
