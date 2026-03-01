# SRPGMaker — Engine Architecture

> Platform overview + current system patterns · Updated 2026-03-01

---

## What Is SRPGMaker?

**SRPGMaker** is a game engine + editor platform for creating, playing, and exporting SRPGs.

- Users create games using the SRPGMaker tool
- Created games are **exported as standalone products** (engine embedded, editor excluded)
- Export targets: Web, iOS/Android (Capacitor), Desktop (Tauri/Electron), Console (future)
- Engine source is **not exposed** in exports (minified on web, compiled into native packages)
- Game data lives in `games/<game-id>/` — swapping `GAME_ID` env var plays a different game

The sample game `games/chronicle-of-shadows/` validates the engine and the game project format simultaneously.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.x |
| Build | Vite 6.x |
| Render Engine | Phaser 3.90 |
| State / Immutability | Immer 10 (`produce`) |
| Tests | Vitest 3.x + @vitest/coverage-v8 |
| Data | JSON files (data-driven, loaded via `GameProjectLoader`) |

---

## 2. Product Layers

```
┌─────────────────────────────────────────────────────────────┐
│  SRPGMaker (the TOOL — runs on developer's machine)         │
│                                                             │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │  Engine Core     │  │  Editor Layer                  │  │
│  │  (src/engine/)   │  │  (src/editor/)                 │  │
│  │                  │  │                                │  │
│  │  state/          │  │  Phase E-1: JSON-first (now)   │  │
│  │  systems/        │  │  Phase E-2: Form-based editor  │  │
│  │  coordinator/    │  │  Phase E-3: Visual map editor  │  │
│  │  renderer/       │  │                                │  │
│  │  input/          │  │  + Exporter (→ standalone ZIP) │  │
│  │  utils/          │  └────────────────────────────────┘  │
│  │  loader/         │                                       │
│  └──────────────────┘                                       │
│           ↕ loads at runtime via GameProjectLoader          │
│  ┌──────────────────────────────────┐                       │
│  │  Game Project (games/<id>/)      │                       │
│  │  game.json + data/ + assets/     │                       │
│  └──────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                         │ Export
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Exported Game (standalone — shipped to end users)          │
│                                                             │
│  Engine Core (minified) + Game Data (bundled)               │
│  NO editor code. NO engine source.                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
src/
├── engine/                     # Engine core — zero Phaser in systems/
│   ├── state/
│   │   ├── BattleState.ts      # Readonly state shape + StateQuery helpers
│   │   ├── GameStore.ts        # Singleton store: dispatch(), nextTurn(), subscribe()
│   │   └── actions/            # Command objects (GameAction interface)
│   ├── systems/                # Pure game logic — zero Phaser dependency
│   │   ├── combat/             # DamageCalc, AffinityTable, CritSystem
│   │   ├── movement/           # BFS, RangeCalc, AStarWorker, PathfindingWorkerClient
│   │   ├── skill/              # SkillExecutor, BuffSystem
│   │   ├── ai/                 # EnemyAI, AIScorer, ThreatMap
│   │   └── turn/               # TurnManager (BattlePhase FSM)
│   ├── strategic/             # Strategic (grand strategy) layer — zero Phaser
│   │   ├── state/             # WorldState, WorldStore, WorldAction
│   │   ├── systems/           # CasualtySystem, WorldTurnSystem, StrategicAI, etc.
│   │   ├── data/types/        # World, Faction, Territory, Army, General, Diplomacy, BattleResult
│   │   └── WorldEventBus.ts   # Strategic event bus (separate from tactical)
│   ├── coordinator/
│   │   ├── BattleCoordinator.ts  # Pure battle logic, no Phaser imports
│   │   ├── WorldCoordinator.ts   # Pure strategic logic, no Phaser imports
│   │   └── AudioCoordinator.ts   # Audio event routing
│   ├── renderer/
│   │   └── PhaserRenderer.ts   # IRenderer impl — all Phaser draw calls
│   ├── input/
│   │   └── InputHandler.ts     # Pointer + keyboard → coordinator calls
│   ├── data/types/             # TypeScript interfaces (Unit, Skill, Terrain, Map)
│   ├── utils/
│   │   ├── EventBus.ts         # Typed global event bus (20+ events)
│   │   └── Logger.ts           # Battle log channels
│   └── loader/
│       └── GameProjectLoader.ts  # Loads game.json + all referenced data
├── editor/                     # Editor UI — excluded from game exports
│   ├── scenes/
│   │   └── EditorScene.ts
│   └── ui/
├── scenes/                     # Phaser scenes (game runtime)
│   ├── BootScene.ts
│   ├── TitleScene.ts
│   ├── BattleScene.ts
│   ├── UIScene.ts
│   ├── ResultScene.ts
│   └── WorldMapScene.ts       # Strategic world map
└── main.ts                     # Entry point (load game project → launch)

games/
└── chronicle-of-shadows/       # Sample game project
    ├── game.json               # Manifest
    ├── data/                   # Game content JSON
    └── docs/                   # Game-specific design docs

tests/                          # Vitest — mirrors src/engine/systems/
├── combat/
├── movement/
├── skill/
├── ai/
├── turn/
└── strategic/              # WorldStore, Territory, Army, Faction, CasualtySystem, etc.
```

---

## 4. Core Patterns

### 4-1. Immutable State + Command Pattern

All state mutations go through `GameAction.execute(state): BattleState`. No direct mutation.

```typescript
interface GameAction {
  execute(state: BattleState): BattleState;  // returns new state (immer produce)
}
```

`GameStore.dispatch(action)` runs `action.execute`, saves old state to `stateHistory` (max 50), then notifies subscribers.
See `docs/engine_specs/04_state_commands_hooks.md` for full detail.

### 4-2. CT/Tick Turn Queue

Units accumulate CT each tick proportional to their SPD. Unit with CT ≥ 100 acts next.
`GameStore.nextTurn()` handles ticking + selecting the active unit.

### 4-3. BattlePhase FSM (TurnManager)

Strict transition map enforced in `TurnManager`. Invalid transitions are no-ops.

```
PLAYER_IDLE → UNIT_SELECTED → MOVE_SELECT → ANIMATING → PLAYER_IDLE
                            ↘ ACTION_SELECT → SKILL_SELECT → ANIMATING
                                            ↘ ANIMATING
ANIMATING → ENEMY_PHASE → PLAYER_IDLE | VICTORY | DEFEAT
```

### 4-4. Scene Hierarchy

```
BootScene → TitleScene → BattleScene (+ UIScene)
                       → WorldMapScene → BattleScene → ResultScene → WorldMapScene
```

`BattleScene` is the public facade. All logic runs inside `BattleCoordinator`.
`WorldMapScene` is the strategic facade. All logic runs inside `WorldCoordinator`.
See `docs/engine_specs/05_scene_coordinator.md`.

### 4-5. Event Bus (Typed)

`EventBus` decouples logic / rendering / UI / audio. 20+ typed events.
Key events: `turnStarted`, `unitMoved`, `unitDamaged`, `unitDefeated`, `skillUsed`, `buffApplied`, `phaseChanged`, `victory`, `defeat`, `unitSelected`.

### 4-6. IRenderer Abstraction

`BattleCoordinator` depends on `IRenderer` interface, not `PhaserRenderer` directly.
This allows swapping render engines without touching game logic.

### 4-7. Utility-Based AI

`EnemyAI.decide()` → evaluates all possible actions via `AIScorer` (scoreAttack/scoreSkill/scoreMove), uses `ThreatMapCalc.build()` for positional threat, picks best score.
Pathfinding via `AStarWorker` (Web Worker, A* + BFS).

### 4-8. Data-Driven Design

No hardcoded unit/skill/terrain data in TypeScript. All in `games/<id>/data/`.
TypeScript interfaces in `src/engine/data/types/`.
`GameProjectLoader` loads the active game project at startup.

### 4-9. Two-Layer Architecture (Strategic + Tactical)

```
Strategic Layer (WorldState/WorldStore)
  ↕ Battle triggers / results flow
Tactical Layer (BattleState/GameStore)
```

The strategic layer (`src/engine/strategic/`) mirrors the tactical layer's patterns:
- `WorldStore` follows `GameStore` pattern (immer produce, dispatch, subscribe, stateHistory)
- `WorldAction` interface mirrors `GameAction` (validate + execute, pure state transforms)
- `WorldEventBus` is separate from `EventBus` to prevent event collision
- `WorldCoordinator` has zero Phaser imports, depends on `IWorldRenderer` interface
- `NullWorldRenderer` enables headless testing (same pattern as `NullRenderer`)

---

## 5. Key Conventions

- **No Phaser in `src/engine/systems/`**: All files under `systems/` are pure TypeScript.
- **Immutability**: Use `produce()` from immer for all state changes inside actions.
- **Actions are value objects**: Constructor injects all parameters; `execute()` is pure.
- **EventBus.clear()** in test `beforeEach` when testing FSM/store listeners.
- **Test coverage scope**: `src/engine/systems/**` + `src/engine/state/actions/**` (vitest.config.ts).
- **Current**: 492 tests, 40 files, 83.44% coverage.
- **`@` alias** resolves to `src/` in both vite and vitest configs.
- **`@game` alias** resolves to `games/${GAME_ID}/` — swap game project by env var.

---

## 6. AI Systems Detail

| Component | File | Role |
|---|---|---|
| `EnemyAI` | `engine/systems/ai/EnemyAI.ts` | Orchestrates enemy turn: picks target, skill, move |
| `AIScorer` | `engine/systems/ai/AIScorer.ts` | Scores actions: `scoreAttack`, `scoreSkill`, `scoreMove` |
| `ThreatMapCalc` | `engine/systems/ai/ThreatMap.ts` | Builds `number[][]` threat heatmap per tile |
| `Pathworker` | `engine/systems/movement/PathfindingWorkerClient.ts` | Singleton bridge to A* Web Worker |
| `StrategicAI` | `engine/strategic/systems/StrategicAI.ts` | Basic AI for world-map faction decisions |
| `AutoBattleResolver` | `engine/strategic/systems/AutoBattleResolver.ts` | Headless battle simulation (separate GameStore) |

`scoreMove` formula: `= -threat * 1.5 - distToTarget * 10`

---

## 7. Combat Formula Overview

`DamageCalc.preview(attacker, defender)`:
- Base: `ATK - DEF` (minimum 1)
- Affinity: `AffinityTable.get(atkAffinity, defAffinity)` multiplier
- Facing: Side +10% dmg / +15% crit; Back +30% dmg / +35% crit
- Crit: `baseCrit = 0.1 + SKL/200`; crit multiplier = 1.8×

See `docs/engine_specs/01_core_battle.md` for full spec.
