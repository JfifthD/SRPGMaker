# Engine Spec 22 — World Map System

> Graph-based world map with Fog of War, scouting, and scalable rendering.

---

## 1. Graph Structure

The world map is a **weighted directed graph** where:
- **Nodes** = territories (cities, forts, villages, passes)
- **Edges** = routes between territories (roads, mountain paths, sea routes)

### 1.1 Node Schema

```typescript
interface WorldNode {
  id: string;                     // "capital_aldora"
  name: string;                   // "Aldora Capital"
  type: TerritoryType;            // 'city' | 'fortress' | 'village' | 'port' | 'pass' | 'camp'
  x: number;                      // World coordinate (0-1000 range)
  y: number;                      // World coordinate (0-1000 range)
  sprite?: string;                // Optional custom sprite key
  visionRadius: number;           // Fog of War radius in hops (default by type)
  defenseBonus: number;           // Combat buff for defenders (0-100)
  maxUpgradeSlots: number;        // How many upgrades this territory supports
  battleMapId?: string;           // Optional custom battle map. If null → template by terrain.
  terrain: WorldTerrain;          // Affects visuals, battle map template, movement cost
}

type TerritoryType = 'city' | 'fortress' | 'village' | 'port' | 'pass' | 'camp';
type WorldTerrain = 'plains' | 'forest' | 'mountain' | 'desert' | 'coastal' | 'swamp' | 'snow';
```

Default vision radius by type:

| Type | Vision (hops) | Defense Bonus | Description |
|------|:---:|:---:|-------------|
| city | 7 | 30 | Major settlement, high production |
| fortress | 7 | 50 | Military stronghold, high defense |
| village | 5 | 10 | Small settlement, low production |
| port | 5 | 20 | Sea trade, naval routes |
| pass | 5 | 40 | Mountain chokepoint |
| camp | 3 | 5 | Temporary position, low everything |

### 1.2 Edge Schema

```typescript
interface WorldEdge {
  id: string;
  from: string;                   // Node id
  to: string;                     // Node id
  bidirectional: boolean;         // Most roads are true. One-way = river current, etc.
  moveCost: number;               // Days to traverse (1-10)
  terrain: WorldTerrain;          // Affects field battle map if interception happens
  passable: boolean;              // false = blocked (mountain range, destroyed bridge)
  requiresKey?: string;           // Optional: need item/event to unlock
  width?: number;                 // Visual rendering hint (1-3, narrow pass → wide road)
}
```

### 1.3 world.json Top-Level

```json
{
  "mapWidth": 800,
  "mapHeight": 600,
  "backgroundImage": "assets/images/world_map_bg.png",
  "nodes": [ ... ],
  "edges": [ ... ],
  "fieldBattleTemplates": {
    "plains": "battle_field_plains",
    "forest": "battle_field_forest",
    "mountain": "battle_field_mountain"
  }
}
```

---

## 2. World Map Coordinate System

- Coordinate space: `(0, 0)` to `(mapWidth, mapHeight)` — configurable per game, up to 1000x1000
- Nodes are placed at `(x, y)` pixel coordinates on a background image/canvas
- **Rendering uses viewport culling**: only nodes within camera bounds are drawn
- Camera: Phaser camera with bounds set to map dimensions, supports pan + zoom

### 2.1 Scalability

For 1000x1000 maps with hundreds of nodes:
- **Spatial index** (quadtree) for click detection and viewport culling
- **Lazy edge rendering**: only draw edges connected to visible nodes
- **LOD (Level of Detail)**: at zoom-out, nodes become dots; at zoom-in, show sprites + names
- Graph operations (pathfinding, vision) are O(V+E), negligible even for 500+ nodes

---

## 3. Fog of War (FoW)

### 3.1 Visibility States

```typescript
type FoWState = 'hidden' | 'explored' | 'visible';
```

- **hidden**: Never seen. Node/edge not rendered at all (or silhouette).
- **explored**: Previously visible but no current vision. Greyed out. Shows terrain type but not current occupant/army info.
- **visible**: Currently in vision range. Full info displayed.

### 3.2 Vision Sources

| Source | Range (hops) | Notes |
|--------|:---:|-------|
| Owned territory (city/fortress) | 7 | Permanent while owned |
| Owned territory (village/port/pass) | 5 | Permanent while owned |
| Character/army on map | 3 | Follows army movement |
| Scout mode character | 8 | Stationary, invisible, 3 world turns |
| Watchtower upgrade | +2 | Territory upgrade bonus |

### 3.3 Vision Computation

```
Per faction, per turn:
1. Start with all nodes as 'explored' (if previously visible) or 'hidden'
2. For each owned territory: BFS from node, mark visible up to visionRadius hops
3. For each army on map: BFS from current node, mark visible up to 3 hops
4. For each scout: BFS from node, mark visible up to 8 hops
5. Merge: any 'visible' overrides 'explored' overrides 'hidden'
```

### 3.4 Enemy Visibility

- Enemy armies are only visible if they are on a **visible** node
- If enemy enters explored (not visible) territory, they are not shown
- If enemy was visible and moves into fog, last known position shown as ghost marker for 1 turn

---

## 4. Scouting

```typescript
interface ScoutOrder {
  generalId: string;
  nodeId: string;             // Where they're scouting
  turnsRemaining: number;     // Starts at 3
  active: boolean;
}
```

- Player sends a general to a node → enters scout mode
- For 3 world turns: general cannot move, cannot be attacked (invisible on map)
- Vision radius increased to 8 hops from that node
- After 3 turns: returns to normal state (visible, movable)

---

## 5. Rendering Approach

### 5.1 Layer Stack (bottom to top)

```
1. Background image (painted world map illustration or tiled terrain)
2. FoW overlay (dark/grey masks on hidden/explored areas)
3. Edge lines (routes between nodes, color-coded by terrain)
4. Node sprites (territory icons, color-coded by faction)
5. Army sprites (military unit icons on nodes or moving along edges)
6. UI overlays (selection highlights, movement range, tooltips)
7. HUD (fixed: minimap, faction panel, turn counter)
```

### 5.2 IWorldRenderer Interface

Follows existing `IRenderer` pattern for testability:

```typescript
interface IWorldRenderer {
  renderNodes(nodes: WorldNode[], visibility: Record<string, FoWState>): void;
  renderEdges(edges: WorldEdge[], visibility: Record<string, FoWState>): void;
  renderArmies(armies: ArmyState[]): void;
  renderFoW(factionFoW: Record<string, FoWState>): void;
  highlightPath(nodeIds: string[]): void;
  highlightTerritory(nodeId: string): void;
  showArmyMovement(armyId: string, path: string[], onComplete: () => void): void;
  destroy(): void;
}
```

Implementations:
- `PhaserWorldRenderer` — Phaser-based for runtime
- `NullWorldRenderer` — No-op for headless tests

### 5.3 Background Options

| Approach | Pros | Cons |
|----------|------|------|
| **Static illustration** | Beautiful, artistic | Can't dynamically change terrain |
| **Tile-based terrain** | Dynamic, editable | Requires tileset art, more complex |
| **Hybrid** (illustration + overlay sprites) | Best of both | Slightly more rendering layers |

**Recommendation**: Hybrid. Background illustration for aesthetics, with dynamic sprite overlays for nodes, armies, and FoW. This allows:
- Game creators to provide a painted world map
- Engine to overlay interactive elements
- Animation (army movement, battles, effects) layered on top

### 5.4 Animation Support

- **Army movement**: Tween along edge path coordinates
- **Battle markers**: Animated clash icons on contested nodes
- **Territory capture**: Flash/glow effect on ownership change
- **FoW reveal**: Gradual fade from dark to visible when scouting
- **Turn resolution**: Cinematic sequence showing all movements + battles

---

## 6. Graph Pathfinding

Simple A* on the edge graph:

```typescript
function findPath(
  graph: WorldGraph,
  from: string,      // node id
  to: string,        // node id
  faction: string,   // for passability checks (allied territory = OK, enemy = blocked unless attacking)
): { path: string[]; totalCost: number } | null;
```

- Weight = `edge.moveCost`
- Blocked edges: `passable === false` or enemy territory (unless deliberately attacking)
- Allied/neutral territory: passable
- Result: ordered list of node IDs

---

## 7. world.json Sample (Chronicle of Shadows MVP)

```json
{
  "mapWidth": 800,
  "mapHeight": 600,
  "backgroundImage": "assets/images/world_map_aldora.png",
  "nodes": [
    { "id": "capital_aldora", "name": "Aldora Capital", "type": "city", "x": 200, "y": 300, "terrain": "plains", "visionRadius": 7, "defenseBonus": 40, "maxUpgradeSlots": 4 },
    { "id": "fort_north", "name": "Northern Bastion", "type": "fortress", "x": 250, "y": 100, "terrain": "mountain", "visionRadius": 7, "defenseBonus": 50, "maxUpgradeSlots": 3 },
    { "id": "village_east", "name": "Thornfield", "type": "village", "x": 450, "y": 250, "terrain": "forest", "visionRadius": 5, "defenseBonus": 10, "maxUpgradeSlots": 2 }
  ],
  "edges": [
    { "id": "e1", "from": "capital_aldora", "to": "fort_north", "bidirectional": true, "moveCost": 3, "terrain": "mountain", "passable": true },
    { "id": "e2", "from": "capital_aldora", "to": "village_east", "bidirectional": true, "moveCost": 2, "terrain": "plains", "passable": true }
  ],
  "fieldBattleTemplates": {
    "plains": "battle_field_plains",
    "forest": "battle_field_forest",
    "mountain": "battle_field_mountain"
  }
}
```

---

## 8. Battle Map Generation from World Map

### 8.1 Concept: World Map → Battle Map Scaling

When a battle triggers on the world map, the battle map is derived from the world map context. The goal: **the battle "feels like" it's happening at that location**.

```
World Map Context → Battle Map Generator → SRPG Tactical Map
  (terrain, node type,        ↓
   surrounding nodes,    MapData with
   edge properties)      terrain tiles matching
                         the world context
```

### 8.2 Field Battle Maps (Edge Battles)

When armies collide on a route (edge), the battle map is generated from the edge's terrain and surrounding context:

```typescript
interface FieldBattleMapParams {
  edgeTerrain: WorldTerrain;           // plains, forest, mountain, etc.
  fromNodeTerrain: WorldTerrain;       // Blends toward origin side
  toNodeTerrain: WorldTerrain;         // Blends toward destination side
  edgeWidth: number;                   // 1-3: narrow pass → wide road
  mapSize: 'small' | 'medium' | 'large';  // Based on army sizes
}
```

Generation approach:
1. **Template selection**: pick base template from `fieldBattleTemplates` by `edgeTerrain`
2. **Terrain blending**: left side of map leans toward `fromNodeTerrain`, right side toward `toNodeTerrain`
3. **Chokepoints**: narrow edges (`width: 1`) generate maps with bottleneck terrain (mountains, rivers on flanks)
4. **Scale**: small (15x15), medium (20x20), large (25x25) based on participant count

Example: edge terrain = mountain, from = plains, to = forest:
```
Left side: flat plains tiles → center: mountain/rocky tiles → right side: forest tiles
Road path runs through the center
Deploy zones: left (attacker), right (defender)
```

### 8.3 Territory Battle Maps (Siege/Defense)

Two options (game creator decides per territory):

**Option A: Creator-made map** — `battleMapId` set in `WorldNode`, points to a hand-crafted map in `data/maps/`.

**Option B: Auto-generated from world map** — if `battleMapId` is null, generate based on:

```typescript
interface TerritoryBattleMapParams {
  territoryType: TerritoryType;        // city, fortress, village, etc.
  terrain: WorldTerrain;               // plains, mountain, etc.
  defenseBonus: number;                // Affects wall/fortification density
  mapSize: 'small' | 'medium' | 'large';
}
```

Generation rules:
- **City/Fortress**: walls around defender side, gate chokepoints, internal buildings
- **Village**: open terrain with scattered buildings, low fortification
- **Port**: coastal map, one side is water (impassable), docks
- **Pass**: narrow map, mountain walls on both flanks, single corridor
- **Camp**: fully open field, no fortifications

### 8.4 Map Size Parameter

```typescript
function resolveBattleMapSize(totalUnits: number): 'small' | 'medium' | 'large' {
  if (totalUnits <= 20) return 'small';    // 15x15
  if (totalUnits <= 40) return 'medium';   // 20x20
  return 'large';                           // 25x25
}
```

### 8.5 API-First Generation

All map generation functions must be exposed as API endpoints for AI-assisted content creation:

```typescript
// Programmatic map generation (callable from editor, CLI, or AI tools)
function generateFieldBattleMap(params: FieldBattleMapParams): MapData;
function generateTerritoryBattleMap(params: TerritoryBattleMapParams): MapData;
```

These return serializable `MapData` JSON — can be saved as custom maps or used on-the-fly.

---

## 9. Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| W1 | Background rendering | Game-specific static PNG. Fallback to solid color if none provided. |
| W2 | Node sprites | Engine provides 6 default types (city/fortress/village/port/pass/camp) + per-game custom sprites via `WorldNode.sprite`. |
| W3 | Edge rendering | Straight lines for MVP. Bezier curves deferred to polish phase (S-10). |
| W4 | Minimap | Yes. Bottom-right corner, shows full map with FoW overlay applied. |
| W5 | Multiple armies on node | Stack display with army count badge. Click to expand list. |
| W6 | Battle map generation | Deterministic seed-based: `seed = hash(edgeId + turn)`. Same location + same turn = same map. |
| W7 | Auto-generated map caching | No caching. Seed-based regeneration produces identical results. |
