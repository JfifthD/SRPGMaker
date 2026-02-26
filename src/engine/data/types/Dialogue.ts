// ─────────────────────────────────────────────
//  Dialogue System Types
//  Pure data types — no Phaser, no logic.
//  Used by DialogueManager, PhaserDialogueRenderer,
//  and JSON script files.
// ─────────────────────────────────────────────

// ── Emotion / Side ──────────────────────────────────────────────────────────

export type PortraitEmotion =
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'determined' | 'wounded' | 'smug' | 'fearful';

// ── Script Line ─────────────────────────────────────────────────────────────

export type DialogueLineType =
  | 'line'        // A character speaks
  | 'narration'   // No speaker, centered italic text
  | 'choice'      // Show choice buttons → branch
  | 'wait'        // Wait for tap/click
  | 'pause'       // Auto-pause N ms then continue
  | 'sfx'         // Play a sound effect
  | 'bgm'         // Change background music
  | 'background'  // Change background image
  | 'shake'       // Screen shake
  | 'flash'       // Screen flash
  | 'end';        // Explicit end marker

export interface DialogueLine {
  type: DialogueLineType;

  // For type: 'line'
  speaker?: string;           // character key, e.g. "kael"
  emotion?: PortraitEmotion;  // portrait variant
  side?: 'left' | 'right';    // which side portrait appears on
  text?: string;              // dialogue text (supports \n)

  // For type: 'choice'
  choices?: DialogueChoice[];

  // For type: 'pause'
  duration?: number;          // milliseconds

  // For type: 'sfx' | 'bgm'
  key?: string;               // Phaser asset key

  // For type: 'background'
  backgroundKey?: string;

  // Optional voice acting
  voiceKey?: string;
}

export interface DialogueChoice {
  label: string;
  next: string;               // branch key in script.branches
  condition?: string;         // e.g. "flag:kael_alive" (reserved for future use)
}

// ── Script ──────────────────────────────────────────────────────────────────

export interface DialogueScript {
  id: string;                               // unique ID, e.g. "ch01_prologue"
  mode: 'scenario' | 'battle_overlay';
  lines: DialogueLine[];
  branches?: Record<string, DialogueLine[]>; // choice branch arrays
}

// ── Trigger ─────────────────────────────────────────────────────────────────

export type DialogueTriggerEvent =
  | 'battle_start'
  | 'battle_end'
  | 'unit_defeated'
  | 'turn_start'              // triggers on specific turn number
  | 'map_event'               // triggers when player steps on a tile
  | 'scenario';               // triggered explicitly from game flow

export interface DialogueTrigger {
  scriptId: string;
  event: DialogueTriggerEvent;
  once: boolean;              // if true, only fires on first match

  // Optional conditions — all present must pass
  unitId?: string;            // for unit_defeated: which unit
  turn?: number;              // for turn_start: which turn number
  tileX?: number;             // for map_event: tile coordinate
  tileY?: number;
  flag?: string;              // arbitrary game flag that must be set
}

// ── Runtime State ────────────────────────────────────────────────────────────

export interface DialogueState {
  active: boolean;
  scriptId: string | null;
  lineIndex: number;
  mode: 'scenario' | 'battle_overlay' | null;
  flags: Set<string>;          // game flags set during dialogue
  triggered: Set<string>;      // scriptIds already triggered (for once:true)
  awaitingChoice: boolean;
}
