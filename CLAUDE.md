# CLAUDE.md — Agent Rules & Project Philosophy

This file governs all AI agent behavior for this project. Read this before making any changes.

---

## 1. Response Style

- **English dominant (70%+)**. Korean only for particles (은/는/이/가/을/를) and minimal connectors.
- No 존댓말. Keep concise for token efficiency.
- Code comments in English.
- Status/progress output in English.

---

## 2. Documentation Philosophy (CRITICAL)

### The Doc Structure Is Intentional — Do Not Break It

```
docs/
├── index.md                          ← AGENT ENTRY POINT (keyword → doc mapping)
├── architecture.md                   ← SRPGMaker platform overview + engine patterns
├── plans.md                          ← Engine + Editor + Refactor roadmap
├── game_project_format.md            ← Game project spec (game.json + directory layout)
├── editor_roadmap.md                 ← 3-phase editor development plan
├── export_pipeline.md                ← Platform export guide
├── engine_specs/
│   ├── 01–09                         ← Core systems (battle, renderer, tactics, state, scenes, UI, audio, metagame, difficulty)
│   ├── 10_dialogue_system.md         ← Dialogue system
│   ├── 11_game_project_loader.md     ← GameProjectLoader
│   ├── 12–14                         ← Stage conditions, save/load, campaign flow
│   ├── 15–17                         ← Progression (levelup, equipment, job system)
│   ├── 18_ai_personality.md          ← AI personality types
│   ├── 19_vfx_camera_minimap.md      ← VFX/Camera/Minimap
│   ├── 20_integration_test_guide.md  ← Test infrastructure guide
│   ├── 21–26                         ← Strategic layer specs (master plan, world map, factions, AI, deployment, time)
│   └── schema_definitions.md
└── todo/
    ├── pending_tasks.md              ← Consolidated backlog (prioritized)
    ├── implement-dialogue-system.md
    └── graphics-upgrade.md

games/
└── chronicle-of-shadows/             ← Sample game (validates game project format)
    ├── game.json                     ← Manifest
    ├── data/                         ← units.json, skills.json, terrains.json, maps/
    ├── assets/                       ← images/, audio/
    └── docs/                         ← Game-specific design docs
        ├── balance_tables.md         ← Numeric balance (GAME-SPECIFIC, not engine)
        ├── world_narrative.md        ← Story + characters (GAME-SPECIFIC)
        └── tutorial_onboarding.md   ← Tutorial design (GAME-SPECIFIC)
```

### Doc Maintenance Rules

1. **Always check `docs/index.md` first** before loading any other doc.
2. **Load only relevant docs** for the task at hand. Never preload all docs.
3. **When you make architectural changes**, update the appropriate doc AND `docs/index.md` mapping.
4. **New engine feature specs** go in `docs/engine_specs/` with sequential numbering.
5. **New implementation tasks** go in `docs/todo/` as individual files + backlog entry in `pending_tasks.md`.
6. **Game-specific docs** (story, balance, characters, tutorial) ALWAYS go in `games/<id>/docs/`. Never in `docs/engine_specs/`.
7. **Completed tasks**: remove from `pending_tasks.md`, mark phase in `plans.md`.
8. **Do not merge** engine_specs files — keep them topic-isolated for selective loading.

---

## 3. Core Architectural Principles & Code Rules

### Architectural Philosophy (CRITICAL)

**AWARENESS:** The codebase is in active refactoring (SRPGMaker pivot). Always read the current code state before executing.

All implementation must be structurally sound, following these primary directives:

- **Design First**: Plan structures, design patterns, and boundaries before coding.
- **Separation of Responsibilities**: Keep data, state, logic, and rendering strictly segregated.
- **Modularization**: Break large systems into independently testable modules.
- **Abstraction**: Use interfaces (e.g., `IRenderer`) to allow swapping underlying technologies without affecting game logic.
- **Fault Isolation**: Ensure failures in non-critical systems (like VFX or UI) do not propagate and break core combat state.
- **Reusability**: Write agnostic mechanics capable of being data-driven by JSON.
- **Guaranteed Performance**: Engine must smoothly support 100+ units. Utilize Web Workers for heavy AI/Pathfinding and avoid main-thread blocking.

### Immutability (Non-negotiable)

- All state changes via `GameAction.execute()` → returns new `BattleState`.
- Use `immer produce()`. Never mutate state directly outside of produce recipes.
- `GameStore.dispatch(action)` is the only legal write path.

### No Phaser in Systems

- `src/engine/systems/**` = zero Phaser imports. Pure TypeScript only.
- Phaser belongs in `src/scenes/`, `src/engine/renderer/`, `src/engine/input/`.
- `BattleCoordinator` has no Phaser imports — depends on `IRenderer` interface.

### No Phaser in Strategic Systems

- `src/engine/strategic/**` = zero Phaser imports. Pure TypeScript only.
- `WorldCoordinator` has no Phaser imports — depends on `IWorldRenderer` interface.
- WorldStore follows the same immutability pattern as GameStore.

### Data-Driven

- No hardcoded unit/skill/terrain stats in TypeScript. All in `games/<game-id>/data/*.json`.
- New game content = new JSON entry, not new code.
- Engine loads game data via `GameProjectLoader` using the `@game` alias.

### FSM Transitions

- `TurnManager` enforces strict `BattlePhase` transitions via the `TRANSITIONS` map.
- Never set `phase` directly on BattleState without going through `TurnManager.transition()`.

### Two-Layer State Architecture

- **Tactical**: `GameStore` / `BattleState` / `GameAction` / `EventBus`
- **Strategic**: `WorldStore` / `WorldState` / `WorldAction` / `WorldEventBus`
- These are fully separate singletons. Battle results flow back to WorldState after each battle.
- `exactOptionalPropertyTypes` is enabled: use `delete` or omit field instead of `= undefined`.

### EventBus

- Game logic emits events; renderers/UI/audio subscribe.
- Never call renderer methods directly from `src/engine/systems/` — emit events instead.

### Editor Separation

- Editor code lives in `src/editor/` only.
- `vite build --mode game` must produce zero editor code in output.
- Never import `src/editor/` from `src/engine/` or `src/scenes/`.

---

## 4. Testing Rules

- Test coverage scope: `src/engine/systems/**` + `src/engine/state/actions/**` (vitest.config.ts).
- Run: `npx vitest run --coverage`
- Target: maintain ≥ 80% coverage statements (current: 83.44%).
- **Test count**: 492 tests across 40 files (unit + integration + strategic).
- `AStarWorker.ts` and `PathfindingWorkerClient.ts` are untestable in Node (Web Worker APIs) — expected 0%.
- Use `vi.mock('@/engine/systems/movement/PathfindingWorkerClient', ...)` to mock Pathworker in EnemyAI tests.
- `EventBus.clear()` in `beforeEach` when testing TurnManager or store subscribers.
- `WorldEventBus.clear()` + `resetArmyIdCounter()` in `beforeEach` for strategic tests.
- Factory pattern: `makeUnit(overrides)` and `makeState(units, width?, height?)` in each test file.
- Strategic tests: `tests/strategic/` mirrors `src/engine/strategic/`.

---

## 5. Task Workflow

1. Read `docs/index.md` to find relevant context docs
2. Load only matched doc(s)
3. Plan changes before implementing
4. Implement + update docs atomically (don't defer doc updates)
5. Run `npx tsc --noEmit` to verify type correctness
6. Run `npx vitest run --coverage` if touching `src/engine/systems/`

---

## 6. Roles

Embody based on user request focus:

- **Principal Architect**: Command Pattern, Save/Load, FSM design, GameProjectLoader
- **AI Orchestrator**: Utility-Based AI, threat assessment, scoring
- **DevOps/TechOps**: Vite build modes, Vitest, export pipeline, CI/CD
- **Gameplay Developer**: Combat formulas, VFX triggers, Phaser rendering
- **Game Designer / PL**: Unit stats, skill balance, UX, game feel (sample game)
