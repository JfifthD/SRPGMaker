// ─────────────────────────────────────────────
//  Utility-Based AI Action Scorer
// ─────────────────────────────────────────────

import type { UnitInstance } from '@/engine/data/types/Unit';
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
   */
  scoreAttack(attacker: UnitInstance, target: UnitInstance, state: BattleState): number {
    const atkT = getTerrain(state, attacker.x, attacker.y);
    const defT = getTerrain(state, target.x, target.y);
    const { baseDmg, affMult } = DamageCalc.preview(
      attacker, target, { mult: 1.0, type: 'phys' }, atkT, defT,
    );

    let score = baseDmg;
    // Big bonus for a killing blow
    if (baseDmg >= target.hp) score += 400;
    // Affinity advantage
    score += (affMult - 1) * 80;
    // Penalise if attacker is low HP (should protect self)
    const hpRatio = attacker.hp / attacker.maxHp;
    if (hpRatio < 0.4) score -= 150;

    return score;
  },

  /**
   * Score using a skill on a target.
   */
  scoreSkill(
    caster: UnitInstance,
    target: UnitInstance,
    skill: SkillData,
    state: BattleState,
  ): number {
    if (caster.mp < skill.mp) return -Infinity;

    if (skill.type === 'heal') {
      const urgency = 1 - target.hp / target.maxHp;
      return urgency * 300;
    }
    if (skill.type === 'buff' || skill.type === 'debuff') {
      return 80;
    }

    // Damage skill
    const atkT = getTerrain(state, caster.x, caster.y);
    const defT = getTerrain(state, target.x, target.y);
    const { baseDmg } = DamageCalc.preview(caster, target, skill, atkT, defT);

    let score = baseDmg;
    if (baseDmg >= target.hp) score += 500;

    return score;
  },

  /**
   * Score moving to a destination tile.
   * Lower threat = better; closer to a target = better.
   */
  scoreMove(
    unit: UnitInstance,
    dest: Pos,
    preferredTarget: UnitInstance,
    state: BattleState,
  ): number {
    const threatGrid = ThreatMapCalc.build(state, unit);
    const threat = ThreatMapCalc.threatAt(threatGrid, dest.x, dest.y);
    const distToTarget = Math.abs(dest.x - preferredTarget.x) + Math.abs(dest.y - preferredTarget.y);

    return -threat * 1.5 - distToTarget * 10;
  },
};
