// ─────────────────────────────────────────────
//  Diplomacy Types — Spec 23 §5
// ─────────────────────────────────────────────

export type DiplomaticStatus = 'war' | 'hostile' | 'neutral' | 'friendly' | 'allied';

export interface DiplomaticRelation {
  status: DiplomaticStatus;
  favorability: number;           // -100 to +100
  treatyTurnsLeft: number;        // 0 = no active treaty
}

export interface DiplomacyState {
  // relations[factionA][factionB] = relation between A and B
  relations: Record<string, Record<string, DiplomaticRelation>>;
}

export function createDefaultRelation(): DiplomaticRelation {
  return { status: 'neutral', favorability: 0, treatyTurnsLeft: 0 };
}
