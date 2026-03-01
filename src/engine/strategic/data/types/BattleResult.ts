// ─────────────────────────────────────────────
//  BattleResult — Post-battle outcome types
//  Used by CasualtySystem, AutoBattleResolver, ResolveBattleAction.
// ─────────────────────────────────────────────

export interface BattleResult {
  winnerId: string;               // Faction ID
  loserId: string;                // Faction ID
  turns: number;                  // Tactical turns elapsed
  attackerCasualties: CasualtyReport;
  defenderCasualties: CasualtyReport;
  territoryCaptured: boolean;     // Attacker took territory
  generalResults: GeneralBattleResult[];
}

export interface CasualtyReport {
  totalTroopsLost: number;
  generalReports: GeneralCasualtyDetail[];
}

export interface GeneralCasualtyDetail {
  generalId: string;
  troopsLost: number;
  hpPercent: number;              // 0.0–1.0 (final HP / max HP)
  wasDefeated: boolean;           // HP reached 0
  died: boolean;                  // Death roll result
  injury?: { turns: number };     // Injury duration if injured
}

export interface GeneralBattleResult {
  generalId: string;
  unitDataId: string;
  maxHp: number;
  finalHp: number;
  wasDefeated: boolean;           // HP reached 0
  team: 'ally' | 'enemy';        // Which side in the tactical battle
}
