import Phaser from 'phaser';
import type { VFXConfig, VfxKey } from '@/engine/data/types/VFX';

export class VFXManager {
  private scene: Phaser.Scene;
  private emitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter>;
  private configs: Map<string, VFXConfig>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.emitters = new Map();
    this.configs = new Map();
  }

  public loadConfigs(configs: VFXConfig[]): void {
    for (const c of configs) {
      this.configs.set(c.id, c);
    }
  }

  public preloadAssets(): void {
    // A placeholder particle texture (e.g. white fading circle) should be loaded in BootScene,
    // but if specific textures are defined in VFXConfig, we could load them here dynamically
    // if we had a preloader phase. For now, assume textures like 'flare' or 'spark' exist.
  }

  public play(vfxId: string, x: number, y: number, depth: number = 2000): void {
    const config = this.configs.get(vfxId);
    if (!config) {
      console.warn(`[VFXManager] Unknown VFX ID: ${vfxId}`);
      return;
    }

    if (config.soundKey) {
      try {
        this.scene.sound.play(config.soundKey);
      } catch (e) {
        // sound might not be loaded, safely ignore
      }
    }

    // Convert config into Phaser generic particle emitter config
    const emitConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      x, y,
      ...config.particle
    };

    // Instantiate emitter
    const emitter = this.scene.add.particles(0, 0, config.particle.texture, emitConfig);
    emitter.setDepth(depth);
    
    // Auto destroy the emitter object after its configured duration
    this.scene.time.delayedCall(config.durationMs, () => {
      emitter.stop(); // Stop spawning new particles
      
      // Give existing particles time to fade before destroying the emitter object entirely
      const maxLife = typeof config.particle.lifespan === 'number' 
          ? config.particle.lifespan 
          : config.particle.lifespan?.max ?? 1000;
          
      this.scene.time.delayedCall(maxLife + 100, () => {
        emitter.destroy();
      });
    });
  }
}
