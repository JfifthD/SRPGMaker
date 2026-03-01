# SRPGMaker — Project Roadmap

> Status: 2026-03-01

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

## Phase 3 — Rendering & UX ✅ DONE

- UnitSprite (Container + procedural shape rendering) ✅
- Move/attack/cast Tween animations ✅
- UIScene (side panel, battle preview tooltip, skill buttons, end turn button) ✅
- PhaserRenderer + IRenderer interface separation ✅
- BattleCoordinator (pure logic layer, no Phaser) ✅
- Particle VFX ✅ (VFXManager + vfx.json — Phase 7)
- Camera pan/zoom ✅ (CameraController — Phase 7)
- Minimap ✅ (MinimapDisplay — Phase 7)
- Sprite replacement (current: procedural shapes) ❌ → `docs/todo/graphics-upgrade.md`

---

## Phase 4 — AI ✅ DONE

- A\* pathfinding (AStarWorker — Web Worker) ✅
- Utility-Based AI scorer (AIScorer) ✅
- ThreatMap (threat heatmap) ✅
- EnemyAI.decide() orchestrator ✅
- Per-enemy-type AI personality (aggressive/defensive/support/hit_and_run/boss/patrol) ✅

---

## Phase 5 — Content, Dynamics & Toolchain ✅ DONE

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

### Phase R-1: GameProjectLoader + Decouple Engine ✅ DONE

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

## Phase S — Strategic Layer (Grand Strategy) 🔄 IN PROGRESS

> 삼국지14-style grand strategy layer over existing SRPG tactical combat.
> Master plan: `docs/engine_specs/21_strategic_layer_master.md`

### Phase S-1: Strategic Foundation ✅ DONE
- WorldState/WorldStore/WorldAction + WorldEventBus
- Territory, Army, Faction, General systems
- world.json + factions.json + diplomacy.json
- 68 strategic tests

### Phase S-2: World Map Scene ✅ DONE
- IWorldRenderer/NullWorldRenderer + PhaserWorldRenderer
- WorldCoordinator FSM + WorldInputHandler + WorldCameraController
- WorldMapScene + TitleScene integration
- 17 WorldCoordinator tests

### Phase S-3: Turn System + Battle Integration ✅ DONE
- Full turn cycle (player → AI → resolution → battles → advance)
- CasualtySystem, AutoBattleResolver, BattleMapBuilder, StrategicAI
- Scene flow: WorldMapScene ↔ BattleScene ↔ ResultScene
- 64 new tests (total: 492 tests, 40 files)

### Phase S-4 through S-10: See `docs/todo/pending_tasks.md`

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

## Current Priority (Next Actions) — updated 2026-03-01

Phases 1–7, 8-A, R-1, S-1/S-2/S-3 are complete. 492 tests, 83.44% coverage.

### Next focus areas:
1. **Phase S-4**: Deployment + Formation (pre-battle general selection)
2. **Phase S-5**: Auto-Battle polish + Multi-Battle per turn
3. **E2E Gameplay Testing**: Multi-turn strategic simulation tests
4. **Chronicle of Shadows**: Full game design (20h playtime)
5. See `docs/todo/pending_tasks.md` for complete prioritized backlog
