// ─────────────────────────────────────────────
//  Job / Class Types
//  Pure TypeScript — no Phaser dependency.
// ─────────────────────────────────────────────

import type { UnitStats } from './Unit';

export interface LearnableSkill {
  skillId: string;
  requiredLevel: number;
}

export interface PromotionTarget {
  jobId: string;
  requiredLevel: number;
  requiredItems?: string[];
}

export interface JobData {
  id: string;
  name: string;
  desc: string;
  tier: 1 | 2 | 3;
  /** Base stat modifiers applied on class change */
  statMod: Partial<UnitStats>;
  /** Skills learned in this class */
  learnableSkills: LearnableSkill[];
  /** Available promotion paths */
  promotionTargets?: PromotionTarget[];
  /** Equipment type tags allowed */
  equipTags: string[];
  /** Growth rate modifiers (additive) */
  growthMod?: Partial<UnitStats>;
}
