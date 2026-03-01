// ─────────────────────────────────────────────
//  Audio Data Types
//  Defines the audio.json schema for game projects.
//  Game creators configure all audio here — no code changes needed.
// ─────────────────────────────────────────────

export type AudioCategory = 'bgm' | 'sfx';

/** A single audio asset entry in audio.json */
export interface AudioEntry {
  id: string;
  category: AudioCategory;
  /** Relative path from audioDir, e.g. "bgm/title.mp3" */
  file: string;
  /** 0.0–1.0, default 1.0 */
  defaultVolume?: number;
  /** Default true for BGM, false for SFX */
  loop?: boolean;
  /** Filterable tags, e.g. ["tense", "epic"] */
  tags?: string[];
}

/** Maps EventBus combat events to SFX asset IDs (data-driven) */
export interface AudioEventMap {
  onUnitMoved?: string;
  onUnitDamaged?: string;
  onCriticalHit?: string;
  onUnitHealed?: string;
  onUnitDefeated?: string;
  onBuffApplied?: string;
  onDebuffApplied?: string;
  onSkillCast?: string;
  onTurnStart?: string;
  onEnemyPhase?: string;
  onVictory?: string;
  onDefeat?: string;
  onMenuOpen?: string;
}

/** Scene-level BGM assignments (data-driven) */
export interface BGMFlowMap {
  title?: string;
  battle?: string;
  victory?: string;
  defeat?: string;
  camp?: string;
}

/** Top-level audio.json schema */
export interface AudioConfig {
  entries: Record<string, AudioEntry>;
  eventMap: AudioEventMap;
  bgmFlow: BGMFlowMap;
}
