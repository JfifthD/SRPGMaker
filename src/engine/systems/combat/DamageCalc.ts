// ─────────────────────────────────────────────
//  Damage Calculation System
//  Pure functions — no side effects, fully testable.
// ─────────────────────────────────────────────

import type { UnitInstance } from '@/engine/data/types/Unit';
import type { SkillData } from '@/engine/data/types/Skill';
import type { TerrainData } from '@/engine/data/types/Terrain';
import { AffinityTable } from './AffinityTable';
import { CritSystem } from './CritSystem';
import { MathUtils } from '@/engine/utils/MathUtils';

export interface CombatResult {
  dmg: number;
  crit: boolean;
  affMult: number;
}

export interface CombatPreview {
  /** Expected damage without randomness */
  baseDmg: number;
  critChance: number;
  affMult: number;
}

function traitMultiplier(att: UnitInstance, def: UnitInstance, sk: SkillData): number {
  let mult = 1.0;
  // Warrior iron_wall: when own DEF >= 16, receive 20% less damage (applied on defence side)
  if (att.trait === 'iron_wall' && def.def >= 16) mult *= 0.8;
  // Mage mana_amplify: magic damage +25%
  if (att.trait === 'mana_amplify' && sk.type === 'magic') mult *= 1.25;
  return mult;
}

export const DamageCalc = {
  /**
   * Calculate combat damage for a single hit.
   *
   * @param att       Attacking unit (with all active buffs already applied to stats)
   * @param def       Defending unit
   * @param sk        Skill being used
   * @param atkTerrain Terrain the attacker stands on
   * @param defTerrain Terrain the defender stands on
   * @param forceCrit  Used in tests to fix crit outcome
   */
  calc(
    att: UnitInstance,
    def: UnitInstance,
    sk: Pick<SkillData, 'mult' | 'ignoreDef' | 'type'>,
    atkTerrain: TerrainData,
    defTerrain: TerrainData,
    forceCrit?: boolean,
  ): CombatResult {
    const affMult = AffinityTable.get(att.affinity, def.affinity);
    const angle = MathUtils.getHitAngle(att.x, att.y, def.x, def.y, def.facing);

    const baseAtk = att.atk * (sk.mult ?? 1.0) + atkTerrain.atkBonus;
    const effectiveDef = sk.ignoreDef
      ? 0
      : Math.max(0, (def.def + defTerrain.defBonus) * 0.6);

    let raw = Math.max(1, baseAtk - effectiveDef);
    
    // Apply Angle Multipliers
    if (angle === 'SIDE') raw *= 1.1; // 10% bonus
    if (angle === 'BACK') raw *= 1.3; // 30% bonus

    raw *= affMult;
    raw *= traitMultiplier(att, def, sk as SkillData);
    
    // Adjust Crit Roll by Angle
    let critChance = CritSystem.baseChance(att);
    if (angle === 'SIDE') critChance += 0.15; // +15% crit
    if (angle === 'BACK') critChance += 0.35; // +35% crit
    
    // Explicit test override check or roll
    const isCrit = forceCrit !== undefined ? forceCrit : MathUtils.rand() < critChance;
    if (isCrit) raw *= CritSystem.MULTIPLIER;

    // ±12% variance
    const variance = 0.88 + MathUtils.rand() * 0.24;
    const dmg = Math.round(Math.max(1, raw * variance));

    return { dmg, crit: isCrit, affMult };
  },

  /**
   * Deterministic preview for UI/AI (no random roll, no variance).
   */
  preview(
    att: UnitInstance,
    def: UnitInstance,
    sk: Pick<SkillData, 'mult' | 'ignoreDef' | 'type'>,
    atkTerrain: TerrainData,
    defTerrain: TerrainData,
  ): CombatPreview {
    const affMult = AffinityTable.get(att.affinity, def.affinity);
    const angle = MathUtils.getHitAngle(att.x, att.y, def.x, def.y, def.facing);
    
    const baseAtk = att.atk * (sk.mult ?? 1.0) + atkTerrain.atkBonus;
    const effectiveDef = sk.ignoreDef
      ? 0
      : Math.max(0, (def.def + defTerrain.defBonus) * 0.6);

    let baseDmg = Math.max(1, (baseAtk - effectiveDef));
    if (angle === 'SIDE') baseDmg *= 1.1;
    if (angle === 'BACK') baseDmg *= 1.3;
    baseDmg *= affMult;
    
    let critChance = CritSystem.baseChance(att);
    if (angle === 'SIDE') critChance += 0.15;
    if (angle === 'BACK') critChance += 0.35;

    return { baseDmg: Math.round(baseDmg), critChance, affMult };
  },
};
