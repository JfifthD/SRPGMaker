// ─────────────────────────────────────────────
//  Effect Node Types — SRPG Maker Core
//  All tactical gimmicks are defined as JSON EffectNode[] arrays.
//  The engine interprets them at runtime via EffectNodeRunner.
// ─────────────────────────────────────────────

// ── Trigger Types ──

/** When does this effect fire? */
export type TriggerType =
  | "OnActiveUse" // Skill activated directly by player
  | "OnTurnStart" // Unit's turn begins
  | "OnTurnEnd" // Unit's turn ends
  | "OnBeforeDamaged" // Before damage is applied (shield, evade, survive)
  | "OnAfterDamaged" // After damage is applied (counter-attack)
  | "OnMoveEnter" // Unit enters a tile (ZOC trigger from adjacent enemy)
  | "OnMoveLeave" // Unit leaves a tile
  | "OnAllyAttacking" // An ally initiates an attack (chain-assist)
  | "OnHitByTag" // Terrain/entity hit by a skill with a specific tag
  | "OnUnitDefeated"; // A unit is reduced to 0 HP

// ── Target Selectors ──

/** Who is affected by this effect? */
export type TargetSelector =
  | "Self" // The effect owner
  | "TriggeringEntity" // The entity that triggered the event (e.g. the moving unit)
  | "EventTarget" // The target of the triggering event (e.g. ally's attack target)
  | "AlliesInRange" // All allies within specified range
  | "EnemiesInRange" // All enemies within specified range
  | "Tile"; // The tile itself (for terrain transforms)

// ── Condition Nodes ──

/** A single condition that must be true for the effect to fire */
export interface ConditionNode {
  /** Condition type identifier */
  type: string;
  /** Operator for comparison */
  op?: "==" | "!=" | ">=" | "<=" | ">" | "<";
  /** Value to compare against */
  value?: number | string | boolean;
  /** For tag checks */
  tag?: string;
}

// ── Effect Payload ──

export interface EffectPayload {
  /** Action to execute (e.g. "BasicAttack", "ApplyBuff") */
  action?: string;
  /** Damage multiplier for reaction strikes */
  damageMultiplier?: number;
  /** AP cost for this reaction (0 = free) */
  apCost?: number;
  /** Whether to interrupt the triggering movement */
  interruptMovement?: boolean;
  /** Terrain key to transform the tile into */
  transformTerrainTo?: string;
  /** Buff/debuff to apply */
  buff?: {
    stat: string;
    val: number;
    dur: number;
  };
  /** Override incoming damage to a specific value expression */
  setDamageTo?: string;
  /** Custom variable mutations */
  mutateCustomVar?: Record<string, unknown>;
  /** Escape hatch: ID of a registered TypeScript function */
  scriptId?: string;
  /** Range for area-of-effect conditions */
  range?: number;
}

// ── Effect Node (Main Type) ──

export interface EffectNode {
  /** Human-readable identifier */
  name: string;
  /** Effect category */
  type: string;
  /** When does this effect trigger? */
  trigger: TriggerType;
  /** Who is affected? */
  target: TargetSelector;
  /** All conditions must be true for the effect to fire */
  conditions: ConditionNode[];
  /** What happens when the effect fires */
  payload: EffectPayload;
  /** Priority for ordering multiple effects (higher = first). Default: 0 */
  priority?: number;
}

// ── Effect Context (Runtime) ──

/** Context passed to EffectNodeRunner.evaluate() */
export interface EffectContext {
  /** The entity that owns the effect nodes being evaluated */
  ownerId: string;
  /** The entity that triggered the event (e.g. the attacking unit) */
  triggeringEntityId?: string;
  /** The target of the triggering event */
  eventTargetId?: string;
  /** Current trigger being evaluated */
  currentTrigger: TriggerType;
  /** Tags on the triggering skill/action (for OnHitByTag) */
  tags?: string[];
  /** Position of the triggering event */
  position?: { x: number; y: number };
  /** Distance between relevant entities */
  distance?: number;
  /** Custom variables tracked per-unit or per-game */
  customVars?: Record<string, unknown>;
}

/** Result of evaluating a single effect node */
export interface EffectResult {
  /** The node that fired */
  node: EffectNode;
  /** Resolved targets (unit instanceIds or tile positions) */
  targets: string[];
  /** Whether the effect should interrupt movement */
  interruptMovement: boolean;
  /** Computed payload after condition evaluation */
  payload: EffectPayload;
}
