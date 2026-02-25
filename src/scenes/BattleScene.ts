import Phaser from 'phaser';
import { PhaserRenderer } from '@/engine/renderer/PhaserRenderer';
import { BattleCoordinator } from '@/engine/coordinator/BattleCoordinator';
import { InputHandler } from '@/engine/input/InputHandler';
import { store } from '@/engine/state/GameStore';
import { loadGameProject } from '@/engine/loader/GameProjectLoader';
import { RingMenu } from '@/ui/RingMenu';
import '@/engine/systems/combat/ReactionSystem'; // Initialize the passive event listener

export class BattleScene extends Phaser.Scene {
  private gameRenderer!: PhaserRenderer;
  private coordinator!: BattleCoordinator;
  private inputHandler!: InputHandler;
  private ringMenu!: RingMenu;

  private stageId!: string;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: { stageId?: string }): void {
    this.stageId = data.stageId || 'stage_01';
  }

  create(): void {
    const mapData = this.cache.json.get(this.stageId);
    if (!mapData) {
      console.error(`Failed to load map data for stage: ${this.stageId}`);
      return;
    }
    const gameProject = loadGameProject();
    store.init(mapData, gameProject);

    this.gameRenderer = new PhaserRenderer(this);
    this.coordinator  = new BattleCoordinator(this.gameRenderer);
    this.inputHandler = new InputHandler(this, this.coordinator);

    this.gameRenderer.renderMap(store.getState());
    this.gameRenderer.syncUnits(store.getState());

    this.ringMenu = new RingMenu(this);

    // Launch the HUD overlay scene on top of BattleScene
    this.scene.launch('UIScene');

    store.nextTurn();
  }

  // ── Public API delegated to coordinator (called by UIScene) ──────

  endTurn(): void {
    this.coordinator.endTurn();
  }

  waitAction(): void {
    this.coordinator.waitAction();
  }

  activateSkill(skillId: string): void {
    this.coordinator.activateSkill(skillId);
  }

  activateAttack(): void {
    this.coordinator.activateAttack();
  }

  // ─────────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    this.gameRenderer.update(time, delta);
  }

  shutdown(): void {
    this.scene.stop('UIScene');
    this.ringMenu.destroy();
    this.inputHandler.destroy();
    this.gameRenderer.destroy();
  }
}
