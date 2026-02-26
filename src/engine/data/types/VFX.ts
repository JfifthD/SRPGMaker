export type VfxKey = 'slash' | 'hit' | 'heal' | 'buff' | 'fire' | 'ice' | 'lightning';

export interface ParticleConfig {
  texture: string;
  frame?: string | string[];
  scale?: { start: number; end: number } | number;
  alpha?: { start: number; end: number } | number;
  speed?: { min: number; max: number } | number;
  angle?: { min: number; max: number } | number;
  gravityY?: number;
  lifespan: { min: number; max: number } | number;
  quantity: number;
  blendMode?: 'ADD' | 'NORMAL' | 'MULTIPLY' | 'SCREEN';
  tint?: number | number[];
}

export interface VFXConfig {
  id: string;          // Maps to VfxKey
  name: string;        // Human readable name
  durationMs: number;  // How long the emitter runs before stopping
  soundKey?: string;   // Optional SFX to play
  particle: ParticleConfig;
}
