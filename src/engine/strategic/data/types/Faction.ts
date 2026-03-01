// ─────────────────────────────────────────────
//  Faction Types — Spec 23 §1 + Spec 24
// ─────────────────────────────────────────────

export interface ResourcePool {
  gold: number;
  food: number;
  troops: number;
}

// --- AI Profile (Spec 24 §3) ---

export type AIPresetType =
  | 'fortress_guardian'
  | 'ambush_predator'
  | 'steady_expander'
  | 'blitz_conqueror'
  | 'diplomat_king'
  | 'opportunist';

export interface AIWeights {
  aggression: number;       // 1-10
  defense: number;          // 1-10
  expansion: number;        // 1-10
  economy: number;          // 1-10
  diplomacy: number;        // 1-10
  scouting: number;         // 1-10
  riskTolerance: number;    // 1-10
  patience: number;         // 1-10
}

export interface StrategicAIProfile {
  preset?: AIPresetType;
  weights?: AIWeights;
  overrides?: Partial<AIWeights>;
}

// --- Faction Data (static, from JSON) ---

export interface FactionData {
  id: string;
  name: string;
  color: number;                // 0xRRGGBB hex color
  leader: string;               // General id
  capital: string;              // Territory id
  aiProfile: StrategicAIProfile;
  startTerritories: string[];
  startGenerals: string[];
  startResources: ResourcePool;
  isPlayer?: boolean;
}

// --- Faction Runtime State ---

export interface FactionState {
  id: string;
  territories: string[];
  generals: string[];
  armies: string[];
  resources: ResourcePool;
  alive: boolean;
}
