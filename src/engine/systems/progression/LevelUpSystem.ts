// ─────────────────────────────────────────────
//  LevelUpSystem
//  Pure TypeScript — no Phaser dependency.
//  Handles EXP calculation, level-ups, and stat growth.
// ─────────────────────────────────────────────

import type { UnitInstance, UnitStats } from '@/engine/data/types/Unit';
import { Logger } from '@/engine/utils/Logger';

// ── Constants ──

export const EXP_CONSTANTS = {
  BASE_ATTACK_EXP: 10,
  KILL_BONUS: 30,
  BASE_SUPPORT_EXP: 15,
  CLEAR_BONUS: 20,
  EXP_PER_LEVEL: 100,
  MAX_LEVEL: 30,
} as const;

// ── Types ──

export interface GrowthRates {
  hp: number;   // 0-100 percentage
  atk: number;
  def: number;
  spd: number;
  skl: number;
  mp: number;
  maxAP?: number;
}

export interface StatGain {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  skl: number;
  mp: number;
  maxAP?: number;
}

export interface LevelUpResult {
  previousLevel: number;
  newLevel: number;
  gains: StatGain;
}

export interface EXPResult {
  unit: UnitInstance;
  expGained: number;
  levelUps: LevelUpResult[];
}

// ── Default growth rates (fallback) ──

const DEFAULT_GROWTH: GrowthRates = {
  hp: 50, atk: 40, def: 40, spd: 40, skl: 40, mp: 30, maxAP: 5
};

// ── Core Functions ──

/**
 * Calculate EXP gained from attacking an enemy.
 */
export function calculateCombatEXP(
  attackerLevel: number,
  defenderLevel: number,
  killed: boolean,
): number {
  const levelDiff = defenderLevel - attackerLevel;
  let exp = EXP_CONSTANTS.BASE_ATTACK_EXP + levelDiff * 3;
  if (killed) {
    exp += EXP_CONSTANTS.KILL_BONUS + levelDiff * 5;
  }
  return Math.max(1, exp);
}

/**
 * Calculate EXP gained from support actions (heal, buff).
 */
export function calculateSupportEXP(skillRank = 1): number {
  return Math.max(1, EXP_CONSTANTS.BASE_SUPPORT_EXP + skillRank * 2);
}

/**
 * Process a single level-up using growth rates.
 * Guarantees at least 1 stat increases per level.
 */
export function processLevelUp(
  growthInput: Partial<UnitStats>,
  rng: () => number = Math.random,
): StatGain {
  const growth: GrowthRates = { ...DEFAULT_GROWTH, ...growthInput };
  const statKeys: (keyof StatGain)[] = ['hp', 'atk', 'def', 'spd', 'skl', 'mp', 'maxAP'];

  const gains: StatGain = { hp: 0, atk: 0, def: 0, spd: 0, skl: 0, mp: 0, maxAP: 0 };
  let totalGains = 0;

  for (const key of statKeys) {
    const rate = growth[key];
    if (rate !== undefined && rng() * 100 < rate) {
      gains[key] = 1;
      totalGains++;
    }
  }

  // Blessed level-up: guarantee at least 1 stat gain
  if (totalGains === 0) {
    // Pick the stat with the highest growth rate
    let bestKey = statKeys[0]!;
    let bestRate = 0;
    for (const key of statKeys) {
      const rate = growth[key] ?? 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestKey = key;
      }
    }
    gains[bestKey] = 1;
  }

  return gains;
}

export function applyStatGains(unit: UnitInstance, gains: StatGain): UnitInstance {
  return {
    ...unit,
    hp: unit.hp + gains.hp,
    maxHp: unit.maxHp + gains.hp,
    mp: unit.mp + gains.mp,
    maxMp: unit.maxMp + gains.mp,
    atk: unit.atk + gains.atk,
    def: unit.def + gains.def,
    spd: unit.spd + gains.spd,
    skl: unit.skl + gains.skl,
    maxAP: unit.maxAP + (gains.maxAP ?? 0),
  };
}

/**
 * Grant EXP to a unit, processing any level-ups.
 * Returns the modified unit and all level-up results.
 */
export function grantEXP(
  unit: UnitInstance,
  amount: number,
  growthRates: Partial<UnitStats>,
  rng: () => number = Math.random,
): EXPResult {
  if (unit.level >= EXP_CONSTANTS.MAX_LEVEL) {
    return { unit, expGained: 0, levelUps: [] };
  }

  let currentUnit = { ...unit };
  let remaining = amount;
  const levelUps: LevelUpResult[] = [];

  currentUnit.exp = (currentUnit.exp ?? 0) + remaining;

  while (
    currentUnit.exp >= EXP_CONSTANTS.EXP_PER_LEVEL &&
    currentUnit.level < EXP_CONSTANTS.MAX_LEVEL
  ) {
    currentUnit.exp -= EXP_CONSTANTS.EXP_PER_LEVEL;
    const prevLevel = currentUnit.level;
    const gains = processLevelUp(growthRates, rng);
    currentUnit = applyStatGains(currentUnit, gains);
    currentUnit.level = prevLevel + 1;

    levelUps.push({
      previousLevel: prevLevel,
      newLevel: currentUnit.level,
      gains,
    });

    Logger.log(`⬆️ ${currentUnit.name} Lv.${prevLevel} → Lv.${currentUnit.level}`, 'system');
  }

  return { unit: currentUnit, expGained: amount, levelUps };
}

/**
 * Distribute clear bonus EXP evenly to all surviving allies.
 */
export function distributeStageEXP(
  allies: UnitInstance[],
  growthMap: Record<string, Partial<UnitStats>>,
  rng: () => number = Math.random,
): EXPResult[] {
  const bonusPerUnit = Math.floor(
    (EXP_CONSTANTS.CLEAR_BONUS * allies.length) / allies.length,
  );
  return allies.map(u =>
    grantEXP(u, bonusPerUnit, growthMap[u.dataId] ?? {}, rng),
  );
}
