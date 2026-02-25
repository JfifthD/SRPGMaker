// ─────────────────────────────────────────────
//  Unit Types
// ─────────────────────────────────────────────

import type { DamageType } from './Skill';
import type { EffectNode } from './EffectNode';

export type AffinityType = DamageType;
export type TeamType = 'ally' | 'enemy';

export interface UnitStats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  skl: number;
}

export type StatKey = keyof UnitStats;

/** Static template loaded from JSON — never mutated */
export interface UnitData {
  id: string;
  name: string;
  job: string;
  affinity: AffinityType;
  /** Base stats at level 1 */
  baseStats: UnitStats;
  /** Percentage growth rate per level-up (0-100) */
  growthRates: Partial<UnitStats>;
  maxMp: number;
  skills: string[];
  /** Unique passive trait identifier */
  trait?: string;
  /** Sprite sheet key registered in Phaser */
  spriteKey: string;
  /** Default attack range (tiles) */
  atkRange: number;
  team: TeamType;
  /** Data-driven passive effects (ZOC, counter, chain-assist, etc.) */
  passiveEffects?: EffectNode[];
}

/** Active buff/debuff on a unit */
export interface ActiveBuff {
  stat: string;
  val: number;
  dur: number;
}

export type Facing = 'N' | 'E' | 'S' | 'W';

/** Runtime instance of a unit — state that can change */
export interface UnitInstance {
  readonly dataId: string;
  /** Runtime unique ID (may differ from dataId when cloned) */
  instanceId: string;
  name: string;
  job: string;
  affinity: AffinityType;
  team: TeamType;
  spriteKey: string;
  atkRange: number;
  trait?: string;
  skills: string[];
  /** Runtime passive effects from UnitData */
  passiveEffects: EffectNode[];

  // Mutable stats
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  skl: number;

  // Position
  x: number;
  y: number;
  /** Direction the unit is facing */
  facing: Facing;

  // AP & CT System
  currentAP: number;
  maxAP: number;
  ct: number;

  // Turn state
  moved: boolean;
  acted: boolean;

  // Active buffs/debuffs
  buffs: ActiveBuff[];

  // Undo support
  prevX?: number;
  prevY?: number;

  // Level (for future growth system)
  level: number;
}

/** Creates a UnitInstance from UnitData with a given spawn position */
export function createUnit(data: UnitData, x: number, y: number): UnitInstance {
  const unit: UnitInstance = {
    dataId: data.id,
    instanceId: data.id,
    name: data.name,
    job: data.job,
    affinity: data.affinity,
    team: data.team,
    spriteKey: data.spriteKey,
    atkRange: data.atkRange,
    skills: [...data.skills],

    hp: data.baseStats.hp,
    maxHp: data.baseStats.hp,
    mp: data.baseStats.mp,
    maxMp: data.maxMp,
    atk: data.baseStats.atk,
    def: data.baseStats.def,
    spd: data.baseStats.spd,
    skl: data.baseStats.skl,

    x,
    y,
    facing: 'S', // Default facing south

    currentAP: 0,
    maxAP: 5, // Default max AP
    ct: 0,

    moved: false,
    acted: false,

    buffs: [],
    level: 1,
    passiveEffects: data.passiveEffects ? [...data.passiveEffects] : [],
  };
  
  if (data.trait) {
    unit.trait = data.trait;
  }
  
  return unit;
}
