import type { EffectNode } from './EffectNode';

// ─────────────────────────────────────────────
//  Skill Types
// ─────────────────────────────────────────────

export type DamageType = 'phys' | 'magic' | 'holy' | 'dark' | 'nature';
export type EffectType = DamageType | 'heal' | 'buff' | 'debuff';
export type TargetType = 'self' | 'ally' | 'enemy' | 'any';

export interface SkillDebuff {
  stat: string;
  val: number;
  dur: number;
}

export interface SkillData {
  /** Unique identifier matching JSON key */
  id: string;
  name: string;
  /** Visual / audio categorisation */
  type: EffectType;
  /** Particle Visual Effect ID from vfx.json */
  vfxId?: string;
  target: TargetType;
  /** MP cost to cast */
  mp: number;
  /** AP cost to cast. If not provided, defaults to 3 */
  ap?: number;
  /** Tile radius from caster */
  range: number;
  /** Whether to hit all valid targets in a 1-tile radius around the aimed tile */
  aoe: boolean;
  /** Damage multiplier (damage skills) */
  mult?: number;
  /** Base heal value (heal skills) */
  healVal?: number;
  /** Stat key to modify (buff/debuff) */
  buffStat?: string;
  /** Amount to add (positive = buff, negative = debuff) */
  buffVal?: number;
  /** Duration in turns */
  buffDur?: number;
  /** Whether to ignore defender DEF */
  ignoreDef?: boolean;
  /** Additional debuff applied alongside a damage hit */
  debuff?: SkillDebuff;
  desc: string;
  tags: string[];
  /** Data-driven additional effects beyond simple damage/heal */
  effectNodes?: EffectNode[];
}
