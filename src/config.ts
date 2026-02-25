import Phaser from 'phaser';

export const GAME_WIDTH  = 1440;
export const GAME_HEIGHT = 900;
export const TILE_SIZE   = 52;
export const SPRITE_SIZE = 40;

/** Pixel offset applied to all tile→screen conversions so the map
 *  renders in the transparent center column of the HUD grid.
 *  Left panel = 200px + 8px (padding) + 6px (gap) = 214px ≈ 216.
 *  Top area (top-bar + timeline) ≈ 88px. */
export const MAP_OFFSET_X = 216;
export const MAP_OFFSET_Y = 88;

export const PhaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#06090f',
  pixelArt: true,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Scenes are registered in main.ts
  scene: [],
};
