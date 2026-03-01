// ─────────────────────────────────────────────
//  Territory Runtime State — Spec 23 §2
// ─────────────────────────────────────────────

export interface TerritoryState {
  id: string;
  owner: string | null;           // Faction id or null (neutral)
  garrison: string[];             // General ids stationed here
  upgrades: string[];             // Upgrade ids (simplified for S-1)
  population: number;             // Affects production
  morale: number;                 // 0-100
  underSiege: boolean;
  turnsOwned: number;
}
