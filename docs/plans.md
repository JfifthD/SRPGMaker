# SRPGMaker — Project Roadmap

> Status: 2026-02-26

---

## Phase 1 — Foundation ✅ DONE

- Vite + TypeScript project init
- Phaser 3 integration, basic scene structure (BootScene, TitleScene, BattleScene, UIScene)
- ESLint + Prettier + Vitest setup
- TypeScript type definitions (Unit, Skill, Terrain, Map)
- Data JSON files (skills.json, units_allies.json, units_enemies.json, terrains.json)

---

## Phase 2 — Core Systems ✅ DONE

- BattleState immutable state + Command pattern (immer produce)
- TurnManager FSM (BattlePhase strict transitions)
- DamageCalc, AffinityTable, CritSystem, BFS — unit tested
- EventBus (TypedEventBus, 20+ events)
- GameStore (dispatch / nextTurn / subscribe / stateHistory)
- CT/Tick-based individual unit turn queue
- AP economy system (currentAP, maxAP, move/attack costs)
- Facing mechanics (Side / Back attack multipliers)
- Buff/Debuff system (BuffSystem.apply / tick)

---

## Phase 3 — Rendering & UX ✅ MOSTLY DONE

- UnitSprite (Container + procedural shape rendering) ✅
- Move/attack/cast Tween animations ✅
- UIScene (side panel, battle preview tooltip, skill buttons, end turn button) ✅
- PhaserRenderer + IRenderer interface separation ✅
- BattleCoordinator (pure logic layer, no Phaser) ✅
- Particle VFX ❌ not yet implemented
- Camera pan/zoom ❌ not yet implemented
- Sprite replacement (current: procedural shapes) ❌ → `docs/todo/graphics-upgrade.md`

---

## Phase 4 — AI ✅ DONE

- A\* pathfinding (AStarWorker — Web Worker) ✅
- Utility-Based AI scorer (AIScorer) ✅
- ThreatMap (threat heatmap) ✅
- EnemyAI.decide() orchestrator ✅
- Per-enemy-type AI personality (aggressive/defensive/support) ❌ not yet implemented

---

## Phase 5 — Content, Dynamics & Toolchain 🔄 IN PROGRESS

**[CRITICAL PREREQUISITE]**
Before implementing features, the following design docs must be finalized:

- **Balance & numeric design:** `games/chronicle-of-shadows/docs/balance_tables.md`
- **Sound system architecture:** `docs/engine_specs/07_audio_framework.md`
- **World & narrative:** `games/chronicle-of-shadows/docs/world_narrative.md`

**[IMPLEMENTATION]**

- **Phase 5.0: Action Menu UI** (Ring Command rendering, Decoupled Payload architecture)
- **Phase 5.1: Reactive Combat** (ZOC/opportunity attacks, reaction skills, chain attacks)
- **Phase 5.2: Environment & Spatial** (terrain interactions, Danger Zone heatmap)
- **Phase 5.3: Progression & Setup** (class tree, equipment, level-up/growth, metagame loop `docs/engine_specs/08_metagame_loop.md`)
- **Phase 5.4: Flow & Pipeline** (multiple win/loss conditions, save/load, cutscenes)
- Advanced graphics (HD-2D, Spine, PixelLab, isometric) → `docs/todo/graphics-upgrade.md`
- Tutorial & accessibility/difficulty design (`games/chronicle-of-shadows/docs/tutorial_onboarding.md`, `docs/engine_specs/09_difficulty_accessibility.md`)

---

## Phase R — SRPGMaker Pivot (Refactor) 🔄 IN PROGRESS

Pivot from single game to engine + editor platform.

### Phase R-0: Game Project Format ✅ DONE

- Created `games/chronicle-of-shadows/` canonical game project directory
- Merged `units_allies.json` + `units_enemies.json` → `games/chronicle-of-shadows/data/units.json`
- Copied all game data to `games/chronicle-of-shadows/data/`
- Created `games/chronicle-of-shadows/game.json` manifest
- Moved game-specific docs from `docs/design_specs/` → `games/chronicle-of-shadows/docs/`
- Written `docs/game_project_format.md` spec
- `src/assets/data/` kept intact (engine still loads from there until R-1)

### Phase R-1: GameProjectLoader + Decouple Engine 🔄 IN PROGRESS

- Create `src/data/types/GameProject.ts` (GameManifest + GameProject types)
- Create `src/engine/loader/GameProjectLoader.ts`
- Update `GameStore.init(mapData, gameProject)` — accept full game project
- Update `EnemyAI` — remove static skill/terrain imports, accept via GameProject
- Update `vite.config.ts` — add `@game` alias + build modes (`game`, `editor`)
- Update `src/main.ts` — use GameProjectLoader

**Goal**: After R-1, swapping `GAME_ID` env var = playing a different game.

### Phase R-2: Source Directory Reorganization

- Create `src/engine/` — move: `state/`, `systems/`, `coordinator/`, `renderer/`, `input/`, `data/types/`, `utils/`
- Update ALL `@/` alias imports across codebase
- Update `vitest.config.ts` coverage path: `src/engine/systems/**`

### Phase R-3: Editor Foundation (JSON-first)

- Create `src/editor/scenes/EditorScene.ts` (Phase E-1 stub)
- Two entry modes in `main.ts`: `MODE=editor` vs `MODE=game`
- JSON viewer/editor panels for units, skills, terrains, maps

---

## Phase 6 — Editor: Form-Based (Phase E-2)

- Unit editor form, Skill editor form, Terrain editor
- Live preview: changes reflected in embedded battle preview
- Save to `games/<id>/data/*.json`

---

## Phase 7 — Export Pipeline

- Web export: `vite build --mode game` → `dist/` (engine minified + game data bundled)
- iOS/Android: Capacitor wrapping web build
- Desktop: Tauri (preferred) or Electron
- Console: Documented in `docs/export_pipeline.md`; implement when SDK available

---

## Current Priority (Next Actions)

1. Complete Phase R-1: GameProjectLoader + GameStore/EnemyAI decoupling
2. Verify: `npx tsc --noEmit` + `npx vitest run --coverage`
3. Phase R-2: src/engine/ directory reorganization
4. Phase R-3: Editor foundation stub
5. `docs/todo/pending_tasks.md` for detailed backlog
