// ─────────────────────────────────────────────
//  Utility-Based AI Action Scorer
// ─────────────────────────────────────────────

import type { UnitInstance } from '@/engine/data/types/Unit';
import type { AIType } from '@/engine/data/types/Unit';
import type { BattleState } from '@/engine/state/BattleState';
import type { SkillData } from '@/engine/data/types/Skill';
import type { TerrainData } from '@/engine/data/types/Terrain';
import type { Pos } from '@/engine/data/types/Map';
import { DamageCalc } from '@/engine/systems/combat/DamageCalc';
import { ThreatMapCalc } from './ThreatMap';
import terrainJson from '@/assets/data/terrains.json';
import type { TerrainKey } from '@/engine/data/types/Terrain';

const TERRAIN_MAP: Record<string, TerrainData> = Object.fromEntries(
  (terrainJson as TerrainData[]).map(t => [t.key, t]),
);
const DEFAULT_TERRAIN = TERRAIN_MAP['plain']!;

function getTerrain(state: BattleState, x: number, y: number): TerrainData {
  return TERRAIN_MAP[state.mapData.terrain[y]?.[x] as TerrainKey] ?? DEFAULT_TERRAIN;
}

// ── AI Personality Weights ─────────────────────

/** Per-personality multipliers that influence scorer outputs */
export interface AIWeights {
  /** Multiplier on damage score — higher = more eager to attack */
  attackMult: number;
  /** HP ratio threshold below which self-preservation kicks in */
  retreatThreshold: number;
  /** Score penalty applied when below retreat threshold */
  retreatPenalty: number;
  /** Threat weight multiplier in scoreMove — higher = more threat-averse */
  threatMult: number;
  /** Distance weight in scoreMove — lower = less eager to close gap */
  distMult: number;
  /** Bonus for heal/buff skills (support archetype) */
  supportBonus: number;
}

const WEIGHTS: Record<AIType, AIWeights> = {
  aggressive: {
    attackMult:       1.2,
    retreatThreshold: 0.25,  // only retreat when very low HP
    retreatPenalty:   100,
    threatMult:       1.0,
    distMult:         12,
    supportBonus:     0,
  },
  defensive: {
    attackMult:       0.8,
    retreatThreshold: 0.50,  // retreat when below half HP
    retreatPenalty:   300,
    threatMult:       2.5,   // strongly avoids dangerous tiles
    distMult:         6,     // less aggressive about closing distance
    supportBonus:     0,
  },
  support: {
    attackMult:       0.7,
    retreatThreshold: 0.35,
    retreatPenalty:   200,
    threatMult:       2.0,
    distMult:         8,
    supportBonus:     200,   // strong bonus for heal/buff skills
  },
};

export function getWeights(aiType: AIType): AIWeights {
  return WEIGHTS[aiType];
}

export interface ScoredAction {
  type: 'attack' | 'skill' | 'move' | 'wait';
  target?: UnitInstance;
  skill?: SkillData;
  destination?: Pos;
  score: number;
}

export const AIScorer = {
  /**
   * Score a basic attack on a target.
   * Applies personality-specific multipliers and self-preservation penalties.
   */
  scoreAttack(attacker: UnitInstance, target: UnitInstance, state: BattleState): number {
    const w = getWeights(attacker.aiType);
    const atkT = getTerrain(state, attacker.x, attacker.y);
    const defT = getTerrain(state, target.x, target.y);
    const { baseDmg, affMult } = DamageCalc.preview(
      attacker, target, { mult: 1.0, type: 'phys' }, atkT, defT,
    );

    let score = baseDmg * w.attackMult;
    // Big bonus for a killing blow
    if (baseDmg >= target.hp) score += 400;
    // Affinity advantage
    score += (affMult - 1) * 80;
    // Self-preservation penalty
    const hpRatio = attacker.hp / attacker.maxHp;
    if (hpRatio < w.retreatThreshold) score -= w.retreatPenalty;

    return score;
  },

  /**
   * Score using a skill on a target.
   * Support units get a large bonus for heal/buff skills.
   */
  scoreSkill(
    caster: UnitInstance,
    target: UnitInstance,
    skill: SkillData,
    state: BattleState,
  ): number {
    const w = getWeights(caster.aiType);
    if (caster.mp < skill.mp) return -Infinity;

    if (skill.type === 'heal') {
      const urgency = 1 - target.hp / target.maxHp;
      return urgency * 300 + w.supportBonus;
    }
    if (skill.type === 'buff' || skill.type === 'debuff') {
      return 80 + w.supportBonus;
    }

    // Damage skill
    const atkT = getTerrain(state, caster.x, caster.y);
    const defT = getTerrain(state, target.x, target.y);
    const { baseDmg } = DamageCalc.preview(caster, target, skill, atkT, defT);

    let score = baseDmg * w.attackMult;
    if (baseDmg >= target.hp) score += 500;

    return score;
  },

  /**
   * Score moving to a destination tile.
   * Defensive units strongly avoid threat zones; aggressive units close distance eagerly.
   */
  scoreMove(
    unit: UnitInstance,
    dest: Pos,
    preferredTarget: UnitInstance,
    state: BattleState,
  ): number {
    const w = getWeights(unit.aiType);
    const threatGrid = ThreatMapCalc.build(state, unit);
    const threat = ThreatMapCalc.threatAt(threatGrid, dest.x, dest.y);
    const distToTarget = Math.abs(dest.x - preferredTarget.x) + Math.abs(dest.y - preferredTarget.y);

    // Defensive: strongly penalise moving when own HP is low
    let selfPreservation = 0;
    const hpRatio = unit.hp / unit.maxHp;
    if (unit.aiType === 'defensive' && hpRatio < w.retreatThreshold) {
      // Prefer tiles that maximise distance from the front
      selfPreservation = distToTarget * 5;
    }

    return -threat * w.threatMult - distToTarget * w.distMult + selfPreservation;
  },
};
