// ─────────────────────────────────────────────
//  WorldMapScene — Phaser scene for strategic world map
//  Follows BattleScene.ts pattern: creates renderer, coordinator, input handler.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import { PhaserWorldRenderer } from '@/engine/renderer/PhaserWorldRenderer';
import { PhaserAudioManager } from '@/engine/renderer/PhaserAudioManager';
import { AudioCoordinator } from '@/engine/coordinator/AudioCoordinator';
import { WorldCoordinator } from '@/engine/coordinator/WorldCoordinator';
import { WorldInputHandler } from '@/engine/input/WorldInputHandler';
import { WorldStore } from '@/engine/strategic/state/WorldStore';
import { loadGameProject } from '@/engine/loader/GameProjectLoader';

export class WorldMapScene extends Phaser.Scene {
  private worldRenderer!: PhaserWorldRenderer;
  private coordinator!: WorldCoordinator;
  private inputHandler!: WorldInputHandler;
  private audioCoord?: AudioCoordinator;

  constructor() {
    super({ key: 'WorldMapScene' });
  }

  create(): void {
    const gameProject = loadGameProject();

    // Validate strategic data exists
    if (!gameProject.worldMap || !gameProject.factionsData || !gameProject.generalsData || !gameProject.diplomacyData) {
      console.error('[WorldMapScene] Missing strategic layer data in game project');
      this.scene.start('TitleScene');
      return;
    }

    // Initialize WorldStore
    const worldStore = new WorldStore();
    const playerFaction = gameProject.factionsData.find(f => f.isPlayer);
    const playerFactionId = playerFaction?.id ?? gameProject.factionsData[0]!.id;
    const protagonistId = playerFaction?.leader ?? '';

    worldStore.init(
      gameProject.worldMap,
      gameProject.factionsData,
      gameProject.generalsData,
      gameProject.diplomacyData,
      playerFactionId,
      protagonistId,
    );

    // Create renderer + coordinator + input
    this.worldRenderer = new PhaserWorldRenderer(this);
    this.coordinator = new WorldCoordinator(
      this.worldRenderer,
      worldStore,
      gameProject.worldMap,
      gameProject.factionsData,
    );
    this.inputHandler = new WorldInputHandler(this, this.coordinator, this.worldRenderer.getCameraController());

    // Audio
    const audioMgr = new PhaserAudioManager(this);
    this.audioCoord = new AudioCoordinator(audioMgr, gameProject.audioConfig);
    this.audioCoord.playBGM(gameProject.audioConfig?.bgmFlow?.title);
    this.events.once('shutdown', () => this.audioCoord?.destroy());

    // Connect coordinator to game project + battle scene launcher
    this.coordinator.setGameProject(gameProject);
    this.coordinator.setLaunchBattleCallback((battle) => {
      // Launch BattleScene for manual battles, pass battle context
      this.scene.start('BattleScene', {
        stageId: battle.battleMapId,
        worldBattle: battle,
      });
    });

    // End Turn button (bottom-right, fixed to screen)
    const cam = this.cameras.main;
    const endTurnBtn = this.add.text(cam.width - 20, cam.height - 20, 'END TURN', {
      fontFamily: 'serif', fontSize: '18px', color: '#c9a84c',
      backgroundColor: '#1a1a2e', padding: { x: 16, y: 8 },
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(100_001).setInteractive({ useHandCursor: true });

    endTurnBtn
      .on('pointerover', () => endTurnBtn.setColor('#ffd700'))
      .on('pointerout', () => endTurnBtn.setColor('#c9a84c'))
      .on('pointerdown', () => this.coordinator.endPlayerTurn());

    // Initial render
    this.coordinator.initialRender();

    // Focus camera on player capital
    if (playerFaction) {
      this.worldRenderer.focusNode(playerFaction.capital);
    }
  }

  update(time: number, delta: number): void {
    this.worldRenderer?.update(time, delta);
  }

  shutdown(): void {
    this.inputHandler?.destroy();
    this.worldRenderer?.destroy();
  }
}
