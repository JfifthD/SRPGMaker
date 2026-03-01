// ─────────────────────────────────────────────
//  World Map Data Types — Graph-based world map
//  Spec 22 §1: Nodes (territories) + Edges (routes)
// ─────────────────────────────────────────────

export type TerritoryType = 'city' | 'fortress' | 'village' | 'port' | 'pass' | 'camp';

export type WorldTerrain = 'plains' | 'forest' | 'mountain' | 'desert' | 'coastal' | 'swamp' | 'snow';

export interface WorldNode {
  id: string;
  name: string;
  type: TerritoryType;
  x: number;                      // World coordinate (0-1000)
  y: number;                      // World coordinate (0-1000)
  sprite?: string;
  visionRadius: number;           // FoW radius in hops
  defenseBonus: number;           // 0-100, combat buff for defenders
  maxUpgradeSlots: number;
  battleMapId?: string;           // Custom battle map. null → auto-generate.
  terrain: WorldTerrain;
}

export interface WorldEdge {
  id: string;
  from: string;                   // Node id
  to: string;                     // Node id
  bidirectional: boolean;
  moveCost: number;               // Days to traverse (1-10)
  terrain: WorldTerrain;
  passable: boolean;
  requiresKey?: string;
  width?: number;                 // Visual hint (1-3)
}

export interface WorldMapData {
  mapWidth: number;
  mapHeight: number;
  backgroundImage?: string;
  nodes: WorldNode[];
  edges: WorldEdge[];
  fieldBattleTemplates?: Partial<Record<WorldTerrain, string>>;
}
