import Phaser from 'phaser';
import { PhaserRenderer } from '@/engine/renderer/PhaserRenderer';
import { PhaserDialogueRenderer } from '@/engine/renderer/PhaserDialogueRenderer';
import { PhaserAudioManager } from '@/engine/renderer/PhaserAudioManager';
import { AudioCoordinator } from '@/engine/coordinator/AudioCoordinator';
import { BattleCoordinator } from '@/engine/coordinator/BattleCoordinator';
import { InputHandler } from '@/engine/input/InputHandler';
import { store } from '@/engine/state/GameStore';
import { loadGameProject } from '@/engine/loader/GameProjectLoader';
import { RingMenu } from '@/ui/RingMenu';
import { DialogueManager } from '@/engine/systems/dialogue/DialogueManager';
import { DialogueTriggerSystem } from '@/engine/systems/dialogue/DialogueTriggerSystem';
import type { DialogueScript } from '@/engine/data/types/Dialogue';
import type { BattleContext } from '@/engine/strategic/state/WorldState';
import '@/engine/systems/combat/ReactionSystem'; // Initialize the passive event listener

export class BattleScene extends Phaser.Scene {
  private gameRenderer!: PhaserRenderer;
  private coordinator!: BattleCoordinator;
  private inputHandler!: InputHandler;
  private ringMenu!: RingMenu;
  private audioCoord!: AudioCoordinator;

  // ── Dialogue subsystem (battle_overlay mode) ─────────────
  private dlgRenderer!: PhaserDialogueRenderer;
  private dlgManager!: DialogueManager;
  private dlgTriggers!: DialogueTriggerSystem;

  private stageId!: string;
  /** Strategic battle context — set when launched from WorldMapScene. */
  private worldBattle: BattleContext | null = null;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: { stageId?: string; worldBattle?: BattleContext }): void {
    this.stageId = data.stageId || 'stage_01';
    this.worldBattle = data.worldBattle ?? null;
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

    // ── Audio: create coordinator + play battle BGM ──
    const audioMgr = new PhaserAudioManager(this);
    this.audioCoord = new AudioCoordinator(audioMgr, gameProject.audioConfig);
    const battleBgm = mapData.bgmId ?? gameProject.audioConfig?.bgmFlow?.battle;
    this.audioCoord.playBGM(battleBgm);

    this.gameRenderer.renderMap(store.getState());
    this.gameRenderer.syncUnits(store.getState());

    this.ringMenu = new RingMenu(this);

    // ── Dialogue: battle_overlay mode (does NOT pause BattleScene) ──
    this.dlgRenderer = new PhaserDialogueRenderer(this, 'battle_overlay');
    this.dlgManager  = new DialogueManager(this.dlgRenderer);
    this.dlgTriggers = new DialogueTriggerSystem(this.dlgManager);

    // Load dialogue scripts for this stage (cached in BootScene)
    const dialogueKey = `${this.stageId}_dialogues`;
    const scripts: DialogueScript[] | null = this.cache.json.get(dialogueKey);
    if (scripts && Array.isArray(scripts)) {
      this.dlgManager.registerScripts(scripts);
      scripts.forEach(s => {
        // Register a battle_start trigger for any script in battle_overlay mode
        if (s.mode === 'battle_overlay') {
          this.dlgTriggers.register({
            scriptId: s.id,
            event: 'battle_start',
            once: true,
          });
        }
      });
    }

    // Launch the HUD overlay scene on top of BattleScene
    this.scene.launch('UIScene');

    // Fire battle_start dialogue triggers BEFORE first turn begins
    this.dlgTriggers.evaluate('battle_start', {}).then(() => {
      store.nextTurn();
    });
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
    this.dlgRenderer?.destroy();
    this.audioCoord?.destroy();
  }
}
