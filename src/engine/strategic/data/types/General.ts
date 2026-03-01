// ─────────────────────────────────────────────
//  General Types — Spec 23 §3
//  Generals are SRPG characters on the strategic map.
//  leadership * 1000 = max troops (max 20,000 at leadership 20)
//  leadership * 1% = commander buff (max 20%)
// ─────────────────────────────────────────────

export type GeneralStatus = 'idle' | 'army' | 'scouting' | 'building' | 'injured';

// Static data (from JSON)
export interface GeneralData {
  id: string;
  name: string;
  unitDataId: string;           // Reference to UnitData for SRPG battles
  leadership: number;           // 1-20
  intellect: number;            // 1-10
  politics: number;             // 1-10
  charm: number;                // 1-10
}

// Runtime state
export interface GeneralState {
  id: string;
  name: string;
  unitDataId: string;
  leadership: number;
  intellect: number;
  politics: number;
  charm: number;
  faction: string | null;       // null = wandering
  location: string;             // Territory id or army id
  status: GeneralStatus;
  injuryTurns: number;          // 0 = healthy
  loyalty: number;              // 0-100
  currentTroops: number;        // Current troop count (max = leadership * 1000)
}

export function createGeneralState(data: GeneralData, factionId: string | null, location: string): GeneralState {
  return {
    id: data.id,
    name: data.name,
    unitDataId: data.unitDataId,
    leadership: data.leadership,
    intellect: data.intellect,
    politics: data.politics,
    charm: data.charm,
    faction: factionId,
    location,
    status: 'idle',
    injuryTurns: 0,
    loyalty: 70,
    currentTroops: data.leadership * 1000,
  };
}
