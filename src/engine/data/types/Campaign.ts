// ─────────────────────────────────────────────
//  Campaign Types
//  Defines the multi-stage progression model.
//  Pure TypeScript — no Phaser dependency.
// ─────────────────────────────────────────────

import type { UnitInstance } from './Unit';

/**
 * A single stage entry in the campaign manifest.
 * Defines metadata used by StageSelectScene and the flow controller.
 */
export interface StageEntry {
  id: string;               // e.g. "stage_01"
  name: string;             // e.g. "The Sunken Bridge"
  /** Map file key (same as MapData.id) */
  mapId: string;
  /** Optional pre-battle dialogue script ID */
  preDialogue?: string;
  /** Optional post-battle dialogue script ID */
  postDialogue?: string;
  /** Stage order index (0-based) for unlock progression */
  order: number;
  /** Optional description for stage select UI */
  description?: string;
}

/**
 * Persistent campaign progression state.
 * Saved separately from BattleState — represents permanent progression.
 */
export interface CampaignState {
  /** Index of the highest unlocked stage (0-based) */
  currentStageIdx: number;

  /** The player's persistent roster — carries stats/level between maps */
  roster: UnitInstance[];

  /** Global inventory (potions, gold, key items) */
  inventory: Record<string, number>;

  /** Story progression flags (e.g., "ch01_boss_defeated": true) */
  flags: Record<string, boolean>;

  /** IDs of completed stages */
  completedStages: string[];
}

/**
 * Campaign definition — loaded from the game project manifest.
 * Lists all stages in order and provides default roster.
 */
export interface CampaignDefinition {
  id: string;               // "chronicle-of-shadows"
  name: string;              // "The Chronicle of Shadows"
  stages: StageEntry[];
}
