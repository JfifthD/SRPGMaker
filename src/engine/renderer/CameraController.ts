import Phaser from 'phaser';
import { TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y } from '@/config';
import type { BattleState } from '@/engine/state/BattleState';
import { StateQuery } from '@/engine/state/BattleState';

export class CameraController {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  private minZoom = 0.5;
  private maxZoom = 2.0;
  private targetZoom = 1.0;

  // Map Bounds to constrain camera
  private mapWidthPx = 0;
  private mapHeightPx = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.targetZoom = this.camera.zoom;

    // Listen to Input Events
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('wheel', this.onWheel, this);
  }

  public setMapBounds(width: number, height: number): void {
    // 2.5D Isometric spacing roughly
    this.mapWidthPx = width * (TILE_SIZE + 2) + MAP_OFFSET_X * 2;
    this.mapHeightPx = height * (TILE_SIZE + 2) + MAP_OFFSET_Y * 2;
  }

  public update(delta: number): void {
    // Smooth Zoom
    if (Math.abs(this.camera.zoom - this.targetZoom) > 0.01) {
      this.camera.zoom += (this.targetZoom - this.camera.zoom) * 0.1;
    }

    // Constrain Pan
    this.constrainCamera();
  }

  public focusOnTile(x: number, y: number, elev: number = 0): void {
    const ELEV_STEP = 12;
    const sx = x * (TILE_SIZE + 2) + MAP_OFFSET_X;
    const sy = y * (TILE_SIZE + 2) - elev * ELEV_STEP + MAP_OFFSET_Y;

    this.scene.tweens.add({
      targets: this.camera,
      scrollX: sx - this.camera.width / 2,
      scrollY: sy - this.camera.height / 2 + TILE_SIZE,
      duration: 300,
      ease: 'Cubic.easeOut',
    });
  }
  
  public focusOnUnit(unitId: string, state: BattleState): void {
     const unit = StateQuery.unit(state, unitId);
     if (!unit) return;
     const elev = state.mapData.elevation?.[unit.y]?.[unit.x] ?? 0;
     this.focusOnTile(unit.x, unit.y, elev);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Only drag with middle mouse or right click, or if no UI element was hit
    // Simple implementation: left click dragging is allowed outside UI
    this.isDragging = true;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.camStartX = this.camera.scrollX;
    this.camStartY = this.camera.scrollY;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.isDragging = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return;

    // Delta matches movement direction
    const dx = (pointer.x - this.dragStartX) / this.camera.zoom;
    const dy = (pointer.y - this.dragStartY) / this.camera.zoom;

    this.camera.scrollX = this.camStartX - dx;
    this.camera.scrollY = this.camStartY - dy;
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number
  ): void {
    // Zoom in (deltaY < 0) or zoom out (deltaY > 0)
    const zoomStep = 0.1;
    if (deltaY > 0) {
      this.targetZoom = Math.max(this.minZoom, this.targetZoom - zoomStep);
    } else if (deltaY < 0) {
      this.targetZoom = Math.min(this.maxZoom, this.targetZoom + zoomStep);
    }
  }

  private constrainCamera(): void {
    // The camera's scrollX/scrollY represents the top-left coordinate of the view.
    // However, when zoomed in, the visible area shrinks towards the center.
    // Phaser 3 camera scroll values need to be clamped relative to the map size
    // AND the scaled viewport size.

    // Viewport dimensions adjusted for zoom
    const viewW = this.camera.width / this.camera.zoom;
    const viewH = this.camera.height / this.camera.zoom;

    // We want to allow panning so the center of the screen can reach the edges of the map.
    // This provides a generous overscan feel.
    const minX = -viewW / 2;
    const minY = -viewH / 2;
    const maxX = this.mapWidthPx - viewW / 2;
    const maxY = this.mapHeightPx - viewH / 2;

    if (this.camera.scrollX < minX) this.camera.scrollX = minX;
    if (this.camera.scrollY < minY) this.camera.scrollY = minY;
    if (this.camera.scrollX > maxX) this.camera.scrollX = maxX;
    if (this.camera.scrollY > maxY) this.camera.scrollY = maxY;
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('wheel', this.onWheel, this);
  }
}
