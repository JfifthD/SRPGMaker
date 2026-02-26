// ─────────────────────────────────────────────
//  CampaignManager
//  Engine-level campaign progression controller.
//  Pure TypeScript — no Phaser dependency.
// ─────────────────────────────────────────────

import type { CampaignState, CampaignDefinition, StageEntry } from '@/engine/data/types/Campaign';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { EventBus } from '@/engine/utils/EventBus';
import { Logger } from '@/engine/utils/Logger';

// ── Default State Factory ──

export function createDefaultCampaign(): CampaignState {
  return {
    currentStageIdx: 0,
    roster: [],
    inventory: {},
    flags: {},
    completedStages: [],
  };
}

// ── CampaignManager ──

export class CampaignManager {
  private _state: CampaignState;
  private _definition: CampaignDefinition | null = null;

  constructor(initial?: CampaignState) {
    this._state = initial ?? createDefaultCampaign();
  }

  // ── Accessors ──

  get state(): CampaignState { return this._state; }
  get definition(): CampaignDefinition | null { return this._definition; }

  /** Load a campaign definition (stage list) from game data */
  setDefinition(def: CampaignDefinition): void {
    this._definition = def;
  }

  /** Replace the entire campaign state (e.g., from a save file) */
  setState(s: CampaignState): void {
    this._state = s;
  }

  /** Initialize roster from unit data (first play) */
  initRoster(units: UnitInstance[]): void {
    this._state = { ...this._state, roster: [...units] };
  }

  // ── Stage Queries ──

  /** Get the list of stages the player has unlocked */
  getUnlockedStages(): StageEntry[] {
    if (!this._definition) return [];
    return this._definition.stages.filter(s => s.order <= this._state.currentStageIdx);
  }

  /** Get the next stage to play (current stage idx) */
  getCurrentStage(): StageEntry | null {
    if (!this._definition) return null;
    return this._definition.stages.find(s => s.order === this._state.currentStageIdx) ?? null;
  }

  /** Get a specific stage by ID */
  getStage(stageId: string): StageEntry | null {
    return this._definition?.stages.find(s => s.id === stageId) ?? null;
  }

  /** Check if a stage is unlocked */
  isUnlocked(stageId: string): boolean {
    const stage = this.getStage(stageId);
    if (!stage) return false;
    return stage.order <= this._state.currentStageIdx;
  }

  /** Check if a stage has been completed */
  isCompleted(stageId: string): boolean {
    return this._state.completedStages.includes(stageId);
  }

  // ── Progression ──

  /**
   * Mark a stage as completed and unlock the next one.
   * Called from ResultScene after a VICTORY.
   */
  completeStage(stageId: string): void {
    if (this._state.completedStages.includes(stageId)) return;

    const stage = this.getStage(stageId);
    if (!stage) return;

    this._state = {
      ...this._state,
      completedStages: [...this._state.completedStages, stageId],
      currentStageIdx: Math.max(this._state.currentStageIdx, stage.order + 1),
    };

    Logger.log(`📋 Stage "${stageId}" completed — unlocked stage ${this._state.currentStageIdx}`, 'system');
    EventBus.emit('stageCompleted', { stageId });
  }

  /**
   * Update the roster after a battle (apply level ups, HP recovery, etc.)
   * The updated units come from the BattleState at victory time.
   */
  updateRoster(survivingAllies: UnitInstance[]): void {
    // Merge surviving units back — update stats, keep roster order
    const rosterMap = new Map(this._state.roster.map(u => [u.dataId, u]));
    for (const unit of survivingAllies) {
      rosterMap.set(unit.dataId, { ...unit, hp: unit.maxHp, moved: false, acted: false, ct: 0 });
    }
    this._state = { ...this._state, roster: Array.from(rosterMap.values()) };
  }

  /**
   * Set a story flag (e.g., "ch01_boss_defeated").
   */
  setFlag(key: string, value = true): void {
    this._state = {
      ...this._state,
      flags: { ...this._state.flags, [key]: value },
    };
  }

  /** Get a story flag value */
  getFlag(key: string): boolean {
    return this._state.flags[key] ?? false;
  }

  /**
   * Add items to inventory.
   */
  addItem(itemId: string, quantity = 1): void {
    const current = this._state.inventory[itemId] ?? 0;
    this._state = {
      ...this._state,
      inventory: { ...this._state.inventory, [itemId]: current + quantity },
    };
  }
}

/** Module-level singleton */
export const campaignManager = new CampaignManager();
