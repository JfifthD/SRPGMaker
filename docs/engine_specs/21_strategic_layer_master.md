# Engine Spec 21 — Strategic Layer Master Plan

> Grand strategy layer over existing SRPG tactical combat.
> Reference: Koei 삼국지 14 strategic flow + SRPG tactical battles.

---

## 1. Two-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  STRATEGIC LAYER (new)                      │
│  WorldMapScene ← WorldCoordinator           │
│  WorldState / WorldStore / WorldActions      │
│  FactionSystem, TerritorySystem, ArmySystem  │
│  EconomySystem, DiplomacySystem             │
│  StrategicAI, FogOfWarSystem                │
│  TimeSystem, AutoBattleResolver             │
└────────────┬────────────────────────────────┘
             │  Battle triggered
             ▼
┌─────────────────────────────────────────────┐
│  TACTICAL LAYER (existing, unchanged)       │
│  BattleScene ← BattleCoordinator            │
│  BattleState / GameStore / GameActions       │
│  CombatSystem, AI, Movement, Skills         │
│  + NEW: DeploymentPhase (pre-battle)        │
└─────────────────────────────────────────────┘
```

**Core principles**:
- Strategic layer is fully additive. Existing `src/engine/systems/` remains untouched. New code lives in `src/engine/strategic/`.
- **API-first**: All creation/generation functions exposed as programmatic APIs (callable from editor, CLI, AI tools).
- **Serialization-ready**: All state and resources use JSON-serializable structures for multiplayer readiness.

---

## 2. Confirmed Design Decisions

| Item | Decision |
|------|----------|
| World map structure | **Graph-based** (nodes + edges) |
| Max world map size | 1000x1000 coordinate space, node count unlimited (performance-optimized) |
| Max factions | 32 (dynamic, set by game creator) |
| Max battle participants | 50 per side |
| Time model | World turn = 30 days. Battle = instant resolution (max 30 battle turns) |
| Multi-battle | Multiple battles per world turn. Player picks which to command. |
| Auto-battle | Headless resolution using existing combat system + EnemyAI |
| Leadership stat | Max 20. Buff = leadership * 1% (max 20%). Troops = leadership * 1000 (max 20,000) |
| Capture/recruitment | None. Instead: wandering generals (random stats, hired with gold) |
| Diplomacy | Simple (war/peace/alliance), extensible structure |
| FoW | Territory-based vision + character-based + scout mode |
| Faction death | Game over if player faction eliminated OR protagonist killed |
| Deployment | Manual placement OR formation presets (3 types + auto-pick) |
| Scout mode | Character goes immobile 3 world turns, invisible, extended vision |
| Troop casualties | **HP%-based**: each general's HP remaining → proportional troop loss |
| General death | Small permanent death chance (3-8%), excludable for story characters |
| General injury | 1-10 world turns recovery, higher probability than death, proportional to HP lost |
| AI personality | **Common 8-trait system** (1-10 scale). 6 presets provided. Custom profiles supported. |
| Field battle maps | **World map → battle map scaling**: terrain generated from edge/node properties |
| Territory battle maps | Creator-made (`battleMapId`) or auto-generated from territory type + terrain |
| API design | **API-first**: all creation functions callable from editor, CLI, AI tools |
| Serialization | **JSON-serializable** throughout: multiplayer-ready, no runtime-only state |
| Collision detection | Same node or opposite-direction edge = battle. One army = one battle per turn. |
| Army movement | Turn-based discrete: moveCost = turns needed. 1 edge per turn. No interception mid-path. |
| Turn order | Simultaneous: player actions → all AI simultaneous → resolve movements/collisions |
| Max armies per faction | Capped by territory count: maxArmies = ownedTerritories.length |
| Siege mechanics | Defender gets defenseBonus applied. Battle map includes walls for fortified territories. |
| Supply lines | MVP excluded. Army maintenance cost only (food + gold per turn). |
| Mid-battle reinforcements | MVP excluded. No allied army reinforcement during battle. |
| HP between battles | Full HP reset each battle. Penalty comes from injury/death system. |
| Army merge/split | Both allowed on same node. Subject to maxArmies constraint. |
| Troop recovery | Territory garrison: 10%/turn recovery. With Barracks upgrade: 20%/turn. |
| Battle retreat | Available after turn 10. Retreating side loses 20% additional troops. |

---

## 3. Game Loop

```
TITLE → NEW GAME (select faction)
  │
  ▼
WORLD MAP SCENE (strategic)
  │
  ├─ [Player Phase]
  │   ├─ View territories, armies, faction status
  │   ├─ Move armies (along graph edges)
  │   ├─ Manage territories (upgrade, recruit)
  │   ├─ Diplomacy actions
  │   ├─ Assign wandering generals
  │   └─ End Turn
  │
  ├─ [Resolution Phase] (automated)
  │   ├─ AI factions take actions (move, build, diplomacy)
  │   ├─ Resolve army movements (simultaneous)
  │   ├─ Detect collisions → create BattleContext[]
  │   ├─ Collect resources from territories
  │   └─ Spawn wandering generals (if applicable)
  │
  ├─ [Battle Phase] (if battles triggered)
  │   ├─ Player chooses which battle(s) to command
  │   ├─ Manual battles:
  │   │   └─ DeploymentScene → BattleScene → ResultScene → back
  │   ├─ Auto battles:
  │   │   └─ AutoBattleResolver (headless, instant)
  │   └─ Apply all battle results to WorldState
  │
  └─ [Advance Time]
      ├─ +30 days
      ├─ Check win/lose conditions
      └─ → back to Player Phase
```

---

## 4. Directory Structure (New)

```
src/engine/
├── strategic/                  ← NEW (all pure TS, zero Phaser)
│   ├── state/
│   │   ├── WorldState.ts       ← Immutable strategic state
│   │   ├── WorldStore.ts       ← produce()-based state management
│   │   └── actions/            ← WorldAction command pattern
│   │       ├── MoveArmyAction.ts
│   │       ├── BuildAction.ts
│   │       ├── DiplomacyAction.ts
│   │       └── RecruitAction.ts
│   ├── systems/
│   │   ├── FactionSystem.ts
│   │   ├── TerritorySystem.ts
│   │   ├── ArmySystem.ts
│   │   ├── EconomySystem.ts
│   │   ├── DiplomacySystem.ts
│   │   ├── FogOfWarSystem.ts
│   │   ├── TimeSystem.ts
│   │   ├── WanderingGeneralSystem.ts
│   │   └── AutoBattleResolver.ts
│   ├── ai/
│   │   ├── StrategicAI.ts       ← Master AI decision maker
│   │   ├── FactionEvaluator.ts  ← Threat/opportunity scoring
│   │   └── ArmyAllocator.ts    ← General/troop assignment
│   └── data/
│       └── types/
│           ├── World.ts
│           ├── Faction.ts
│           ├── Territory.ts
│           ├── Army.ts
│           └── Diplomacy.ts
│
├── coordinator/
│   ├── BattleCoordinator.ts     ← existing
│   └── WorldCoordinator.ts      ← NEW (orchestrates strategic turn)
│
└── data/types/
    └── Deployment.ts             ← NEW (formation config)

src/scenes/
├── WorldMapScene.ts              ← NEW
├── DeploymentScene.ts            ← NEW
├── BattleScene.ts                ← existing (minor: accepts DeploymentConfig)
└── ...

games/<game-id>/data/
├── world.json                    ← NEW (graph nodes, edges, territories)
├── factions.json                 ← NEW (faction definitions)
├── wandering_generals.json       ← NEW (generator config: name pools, stat ranges)
├── diplomacy.json                ← NEW (initial relations)
└── ... (existing files unchanged)
```

---

## 5. State Architecture

```typescript
interface WorldState {
  // Core
  turn: number;
  day: number;                    // turn * 30
  phase: 'player' | 'resolution' | 'battle' | 'advance';

  // Entities
  factions: Record<string, FactionState>;
  territories: Record<string, TerritoryState>;
  armies: Record<string, ArmyState>;
  generals: Record<string, GeneralState>;

  // Systems
  diplomacy: DiplomacyState;
  fogOfWar: Record<string, FoWState>;     // per-faction visibility
  pendingBattles: BattleContext[];
  activeBattles: BattleContext[];
  scoutOrders: ScoutOrder[];          // Active scout missions

  // Player
  playerFactionId: string;
  protagonistId: string;          // death = game over

  // Wandering generals available for hire
  availableGenerals: GeneralState[];
}
```

```typescript
interface ArmyState {
  id: string;
  factionId: string;
  generals: string[];           // General ids (unique: 1 general = 1 army only)
  locationNodeId: string;       // Current position (node id)
  status: 'idle' | 'moving' | 'in_battle' | 'retreating';
  // Movement (when status === 'moving')
  movementPath?: string[];      // Remaining path node ids
  movementProgress?: number;    // Days progressed on current edge
  targetNodeId?: string;        // Final destination
}
// Constraint: generals.length === 0 → army auto-disbanded
// Constraint: 1 general can only belong to 1 army at a time
```

```typescript
// WorldAction base interface (same pattern as GameAction)
interface WorldAction {
  type: string;
  execute(state: WorldState): WorldState;
  validate(state: WorldState): boolean;
}
```

`WorldStore` follows exact same pattern as `GameStore`:
- Immutable state via `immer produce()`
- `WorldStore.dispatch(action)` is the only legal write path
- Uses **WorldEventBus** (separate from tactical EventBus to prevent event collision)

```typescript
// Strategic events (WorldEventBus)
type StrategicEvent =
  | 'armyMoved' | 'armyCreated' | 'armyDisbanded'
  | 'territoryCapture' | 'territorySieged'
  | 'battleStarted' | 'battleEnded'
  | 'generalHired' | 'generalDied' | 'generalInjured' | 'generalDeserted'
  | 'diplomacyChanged' | 'allianceFormed' | 'warDeclared'
  | 'upgradeStarted' | 'upgradeCompleted'
  | 'turnAdvanced' | 'resourceCollected'
  | 'scoutStarted' | 'scoutCompleted';
```

---

## 6. MVP Roadmap

### Phase S-1: Strategic Foundation (Data + Logic)
> Playable: No (headless only)

- WorldState, WorldStore, WorldAction base classes
- Territory, Faction, Army, General data types
- world.json + factions.json schema
- TerritorySystem: ownership, adjacency queries
- ArmySystem: creation, movement along edges
- Graph pathfinding (A* on edges)
- Sample: Chronicle of Shadows world map (12-15 nodes)
- Tests: WorldStore dispatch, territory ownership, army movement

### Phase S-2: World Map Scene (Visual)
> Playable: Can see map, click around

- WorldMapScene with Phaser
- Graph renderer (nodes = circles/sprites, edges = lines)
- Camera controls (drag pan, wheel zoom)
- Faction color coding on territories
- Select territory → info panel
- Select army → movement range highlight
- Basic HUD: turn counter, faction resources

### Phase S-3: Turn System + Battle Integration
> Playable: **First Playable MVP** — move armies, fight battles, conquer

- World turn cycle: player actions → end turn → AI moves → battles
- Army movement orders (click destination, pathfind)
- Collision detection → BattleContext creation
- Battle trigger → BattleScene (existing SRPG)
- Post-battle: winner takes territory
- Simple win condition: control all territories
- 2-3 AI factions with basic aggression logic

### Phase S-4: Deployment + Formation
> Playable: tactical depth before battles

- DeploymentScene: select which generals to field (max 50)
- Auto-pick algorithm (best available by role)
- 3 formation presets + manual placement
- Commander assignment (highest leadership = buffs)
- Deploy zones on battle maps

### Phase S-5: Auto-Battle + Multi-Battle
> Playable: delegate battles, manage multiple fronts

- AutoBattleResolver: headless combat using existing systems
- Commander delegation UI
- Multiple battles per turn resolution
- Battle report (casualties, captures)
- Visual timeline: 30-day progression with battle markers

### Phase S-6: Economy + Territory Upgrades
> Playable: resource management layer

- Gold, food, troops production per territory
- Territory upgrades (walls, barracks, market, watchtower)
- Army maintenance costs
- Troop replenishment
- Build queue UI

### Phase S-7: Fog of War + Scouting
> Playable: information warfare

- FoW overlay on world map
- Vision radius per territory type (7/5 hops)
- Character vision (3 hops)
- Scout mode (3 turns, invisible, extended vision)
- Enemy army revelation rules

### Phase S-8: Strategic AI (Full)
> Playable: challenging AI opponents

- 6 AI personality types with weighted decision matrix
- Territory evaluation (value, threat, opportunity)
- Army allocation and target selection
- Multi-front coordination
- Adaptive behavior based on game state

### Phase S-9: Diplomacy + Wandering Generals
> Playable: full strategic depth

- Alliance, war, peace, non-aggression pact
- Diplomacy actions + AI reactions
- Wandering general spawning (random stats, name/portrait generation)
- Recruitment at owned territories
- General loyalty (hidden stat, affects desertion risk)

### Phase S-10: Polish + Sample Campaign
> Playable: **Release candidate**

- Chronicle of Shadows full strategic campaign
- 5-8 factions with unique personalities
- Story events (scripted general defections, etc.)
- Balance tuning
- Tutorial integration
- Performance optimization for large maps

---

## 7. Integration Points with Existing Engine

| Existing System | Integration |
|----------------|-------------|
| `GameStore` / `BattleState` | Unchanged. WorldStore is separate. Battle results written back to WorldState. |
| `BattleScene` | New `init()` data includes `DeploymentConfig`. Otherwise unchanged. |
| `EnemyAI` | Reused as-is for auto-battle resolution. Both sides use EnemyAI. |
| `NullRenderer` | Used by AutoBattleResolver for headless battles. |
| `AudioCoordinator` | WorldMapScene gets its own AudioCoordinator instance. |
| `EventBus` | Extended with strategic events (`armyMoved`, `territoryCapture`, etc.) |
| `GameProjectLoader` | Extended to load `world.json`, `factions.json`, etc. |
| `SaveManager` | Extended to serialize WorldState alongside BattleState. |
| `CampaignManager` | Replaced by strategic layer (campaign = world conquest). |

---

## 8. Resolved Questions

| # | Topic | Resolution |
|---|-------|------------|
| Q1 | **Troop casualties** | **HP%-based.** Each general's final HP / max HP → proportional troop loss. See Spec 26 §6.2. |
| Q4 | **General death** | **Yes, permanent death possible.** Small chance (3-8%), excludable for story characters. See Spec 25 §5.5. |
| Q5 | **Territory battle maps** | **Creator-made OR auto-generated.** `battleMapId` in WorldNode → custom map. Null → generate from territory type + terrain. See Spec 22 §8.3. |
| Q6 | **Field battle maps** | **World map → battle map scaling.** Edge terrain + adjacent node terrains → blended battle map. See Spec 22 §8.2. |
| Q2 | **Siege mechanics** | Defender gets `defenseBonus` from WorldNode. Battle map includes walls for city/fortress territories. |
| Q3 | **Supply lines** | MVP excluded. Army maintenance cost (food + gold) is the only supply mechanic. |
| Q7 | **World map background** | Hybrid: static illustration + dynamic sprite overlays. Already confirmed. |
| Q8 | **Turn order** | Simultaneous resolution. Player → all AI simultaneous → resolve. |
| Q9 | **Max armies per faction** | `maxArmies = ownedTerritories.length`. |
| Q10 | **Reinforcements mid-battle** | MVP excluded. No reinforcement system. |

---

## 9. Sample Game Extension: Chronicle of Shadows

Current: Linear 1-stage SRPG demo.
Target: Aldora kingdom vs Shadow forces on a strategic map.

```
Proposed world map (MVP):
  12-15 territory nodes
  3 factions: Aldora (player), Shadow Legion (enemy), Northern Clans (neutral→enemy)
  Key locations: Capital, border forts, mountain pass, port city
  Win condition: defeat Shadow Legion leader
```

Detailed world map design → `games/chronicle-of-shadows/docs/world_map_design.md` (to be created with game-specific content).

---

## 10. API-First Design Principle

All strategic layer creation and generation functions are exposed as programmatic APIs, enabling:
- **Editor integration**: form-based or visual editor can call the same functions
- **AI content creation**: LLM or procedural tools can generate worlds, factions, maps via API
- **CLI tooling**: batch generation and testing from command line

### 10.1 API Surface

```typescript
// World creation
function createWorldMap(config: WorldMapConfig): WorldMapData;
function addTerritory(world: WorldMapData, node: WorldNode): WorldMapData;
function addRoute(world: WorldMapData, edge: WorldEdge): WorldMapData;

// Faction creation
function createFaction(config: FactionConfig): FactionState;
function createGeneral(config: GeneralConfig): GeneralState;

// Battle map generation (see Spec 22 §8)
function generateFieldBattleMap(params: FieldBattleMapParams): MapData;
function generateTerritoryBattleMap(params: TerritoryBattleMapParams): MapData;

// AI profile
function resolveAIWeights(profile: StrategicAIProfile): AIWeights;

// Validation
function validateWorldMap(world: WorldMapData): ValidationResult;
function validateFactions(factions: FactionConfig[]): ValidationResult;
```

All functions are **pure** (no side effects) and return **JSON-serializable** outputs.

---

## 11. Serialization & Multiplayer Readiness

### 11.1 Serialization Guarantee

All state and configuration objects must satisfy:

```typescript
// For any state/config object X:
JSON.parse(JSON.stringify(X)) deep-equals X
```

This means:
- **No class instances** in state — use plain interfaces/types
- **No functions, symbols, or circular references** in state
- **No runtime-only handles** (Phaser objects, DOM refs, etc.) in state
- **Dates** stored as ISO strings or epoch numbers
- **Maps** stored as `Record<string, T>` (not `Map<K,V>`)

### 11.2 State Snapshot Protocol

```typescript
interface WorldStateSnapshot {
  version: string;          // Schema version for migration
  timestamp: number;        // Epoch ms
  state: WorldState;        // Full strategic state
  battleState?: BattleState; // If mid-battle, includes tactical state
}

// Serialize
function serializeWorld(state: WorldState): string {
  return JSON.stringify({ version: '1.0', timestamp: Date.now(), state });
}

// Deserialize
function deserializeWorld(json: string): WorldStateSnapshot {
  return JSON.parse(json);
}
```

### 11.3 Multiplayer Considerations (Future)

While multiplayer is not in MVP scope, the serialization-ready architecture enables:
- **State sync**: send WorldStateSnapshot over network
- **Action replay**: WorldActions are serializable commands → can be sent to peers
- **Deterministic resolution**: auto-battle with seeded RNG → same result on all clients
- **Turn-based multiplayer**: each player submits actions → server resolves → broadcasts new state

No multiplayer code is implemented now, but all data structures are designed to support it.

---

## References

- Spec 22: World Map System (graph, FoW, rendering, battle map generation)
- Spec 23: Faction, Economy, Diplomacy, Wandering Generals
- Spec 24: Strategic AI Personality Matrix (common 8-trait system + 6 presets)
- Spec 25: Deployment & Formation System (leadership 1%/point, death/injury)
- Spec 26: Time System & Multi-Battle Resolution (HP%-based casualties)
