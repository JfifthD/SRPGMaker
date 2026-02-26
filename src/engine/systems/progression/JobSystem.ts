// ─────────────────────────────────────────────
//  JobSystem
//  Pure TypeScript — no Phaser dependency.
//  Handles class promotion, skill learning, and growth modifiers.
// ─────────────────────────────────────────────

import type { JobData } from '@/engine/data/types/Job';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { Logger } from '@/engine/utils/Logger';

/** Maximum skills that can be carried over during promotion */
export const MAX_CARRYOVER_SKILLS = 2;

// ── Core Functions ──

/**
 * Check if a unit can promote to a target job.
 */
export function canPromote(
  unit: UnitInstance,
  targetJobId: string,
  currentJob: JobData,
  inventory?: Record<string, number>,
): boolean {
  if (!currentJob.promotionTargets) return false;

  const target = currentJob.promotionTargets.find(p => p.jobId === targetJobId);
  if (!target) return false;

  // Level check
  if (unit.level < target.requiredLevel) return false;

  // Item check
  if (target.requiredItems) {
    for (const itemId of target.requiredItems) {
      if (!inventory || (inventory[itemId] ?? 0) <= 0) return false;
    }
  }

  return true;
}

/**
 * Promote a unit to a new job class.
 * - Applies statMod from the new job
 * - Keeps up to MAX_CARRYOVER_SKILLS from the old job
 * - Sets the unit's job to the new class
 */
export function promote(
  unit: UnitInstance,
  newJob: JobData,
  carrySkills: string[],
): UnitInstance {
  // Limit carry-over skills
  const kept = carrySkills.slice(0, MAX_CARRYOVER_SKILLS);

  // Combine new job's learnable skills (level 1 only) with carried skills
  const newSkills = [
    ...kept,
    ...newJob.learnableSkills
      .filter(ls => ls.requiredLevel <= 1)
      .map(ls => ls.skillId),
  ];

  // Apply stat modifiers
  const result: UnitInstance = {
    ...unit,
    job: newJob.id,
    skills: [...new Set(newSkills)], // Deduplicate
    atk: unit.atk + (newJob.statMod.atk ?? 0),
    def: unit.def + (newJob.statMod.def ?? 0),
    spd: unit.spd + (newJob.statMod.spd ?? 0),
    skl: unit.skl + (newJob.statMod.skl ?? 0),
    hp: unit.hp + (newJob.statMod.hp ?? 0),
    maxHp: unit.maxHp + (newJob.statMod.hp ?? 0),
    mp: unit.mp + (newJob.statMod.mp ?? 0),
    maxMp: unit.maxMp + (newJob.statMod.mp ?? 0),
  };

  Logger.log(`🎓 ${unit.name}: ${unit.job} → ${newJob.name} (Tier ${newJob.tier})`, 'system');
  return result;
}

/**
 * Get skills a unit has unlocked at their current level for a given job.
 */
export function getLearnableSkills(
  unitLevel: number,
  jobData: JobData,
): string[] {
  return jobData.learnableSkills
    .filter(ls => ls.requiredLevel <= unitLevel)
    .map(ls => ls.skillId);
}

/**
 * Apply job-based growth rate modifiers.
 */
export function getModifiedGrowth(
  baseGrowth: Partial<Record<string, number>>,
  jobData: JobData,
): Record<string, number> {
  const result: Record<string, number> = { ...baseGrowth } as Record<string, number>;
  if (jobData.growthMod) {
    for (const [key, val] of Object.entries(jobData.growthMod)) {
      result[key] = (result[key] ?? 0) + (val ?? 0);
    }
  }
  return result;
}

/**
 * Consume promotion items from inventory.
 */
export function consumePromotionItems(
  inventory: Record<string, number>,
  requiredItems: string[],
): Record<string, number> {
  const updated = { ...inventory };
  for (const itemId of requiredItems) {
    updated[itemId] = (updated[itemId] ?? 0) - 1;
    if (updated[itemId]! <= 0) delete updated[itemId];
  }
  return updated;
}
