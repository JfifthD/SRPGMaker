# Doc Index — Agent Lookup Table

**Rule**: Load only the docs relevant to the task. Never preload unrelated docs.
When making structural changes, update both the target doc AND this index.

## Keyword → Doc Mapping

| Keyword / Task                                                                                                          | Load Doc                                                                                    | What It Covers                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| architecture, overview, tech stack, patterns, overall, platform, srpgmaker                                              | `docs/architecture.md`                                                                      | SRPGMaker platform overview, engine patterns, product layers            |
| state, BattleState, GameStore, dispatch, command pattern, undo, history, replay, immer                                  | `docs/engine_specs/04_state_commands_hooks.md`                                              | Immutable state shape, GameStore API, Action interface, all actions     |
| scene, BattleScene, UIScene, BootScene, TitleScene, coordinator, BattleCoordinator, renderer, IRenderer, PhaserRenderer | `docs/engine_specs/05_scene_coordinator.md`                                                 | Scene hierarchy, Coordinator pattern, renderer abstraction              |
| plan, roadmap, phase, milestone, what is done, what is next                                                             | `docs/plans.md`                                                                             | Phase roadmap with current completion status                            |
| battle spec, turn system, CT, AP, action point, facing, side attack, back attack, spd                                   | `docs/engine_specs/01_core_battle.md`                                                       | CT turn queue, AP economy, Facing/angle mechanics                       |
| rendering spec, map, z-axis, elevation, depth, isometric, tile size, depth sorting                                      | `docs/engine_specs/02_renderer_architecture.md`                                             | Scale, Z-axis depth formula, elevation matrix                           |
| tactics spec, zoc, counter, evade, reaction, assist, class, job, equipment, heatmap                                     | `docs/engine_specs/03_advanced_tactics.md`                                                  | ZOC, Reactions, Chain attacks, Classes, Geodata                         |
| effect node, effectnode, trigger, condition, payload, script escape                                                     | `src/engine/data/types/EffectNode.ts` + `src/engine/systems/effectnode/EffectNodeRunner.ts` | Data-driven tactical gimmick runtime                                    |
| terrain interaction, burning forest, transform terrain, reactive terrain                                                | `src/engine/systems/terrain/TerrainInteractionSystem.ts`                                    | Reactive terrain effects via Effect Node                                |
| danger zone, heatmap, enemy range                                                                                       | `src/engine/systems/movement/DangerZoneCalc.ts`                                             | Union of all enemy move+attack ranges                                   |
| ui spec, action menu, ring command, wait, end turn, facing, radial                                                      | `docs/engine_specs/06_action_menu_ui.md`                                                    | UI/UX decoupling for Action Menus, Wait vs EndTurn                      |
| ai, enemy AI, utility scoring, AIScorer, ThreatMap, EnemyAI, behavior                                                   | `docs/architecture.md` §AI                                                                  | AI overview; see `src/engine/systems/ai/` for code                      |
| backlog, pending, todo, upcoming, what to implement                                                                     | `docs/todo/pending_tasks.md`                                                                | Consolidated pending task list                                          |
| dialogue, conversation, portrait, cutscene, scenario                                                                    | `docs/engine_specs/10_dialogue_system.md`                                                   | Dialogue system design + impl plan                                      |
| irenderer, renderer abstraction, swap engine                                                                            | `docs/todo/implement-irenderer.md`                                                          | IRenderer interface layer task                                          |
| graphics, upgrade, sprite, animation, hd-2d, spine, pixellab, vfx, tile, asset pipeline                                 | `docs/todo/graphics-upgrade.md`                                                             | Graphics upgrade roadmap                                                |
| balance, stats, numeric, damage formula, ap economy, affinity, critical, scaling                                        | `games/chronicle-of-shadows/docs/balance_tables.md`                                         | Master sheet for all numeric balance, stats, and formulas (sample game) |
| integration test, e2e test, headless test, balance test, api-driven test, buildStore, NullRenderer, deterministic damage | `docs/engine_specs/20_integration_test_guide.md`                                            | Headless dispatch-based test infra: architecture, balance verification workflow, all test file descriptions |
| e2e test, gameplay test, strategic loop test, multi-turn test, campaign test, AI regression test                         | `docs/engine_specs/20_integration_test_guide.md` §10                                        | Planned E2E gameplay testing: strategic loop, battle integration, balance     |
| audio, sound, bgm, sfx, music, spatial audio, volume ducking, AudioCoordinator, IAudioManager, PhaserAudioManager       | `docs/engine_specs/07_audio_framework.md`                                                   | Audio architecture, data-driven audio.json, event-to-SFX routing        |
| narrative, story, lore, world, characters, factions, affinity, choices                                                  | `games/chronicle-of-shadows/docs/world_narrative.md`                                        | World lore, character profiles, synopsis (sample game)                  |
| tutorial, onboarding, learning curve, help, undo, tips                                                                  | `games/chronicle-of-shadows/docs/tutorial_onboarding.md`                                    | Phased learning curve design (sample game)                              |
| metagame, loop, camp, shop, equipment, prep, progression                                                                | `docs/engine_specs/08_metagame_loop.md`                                                     | Out-of-combat loop: results, camp, prep phase                           |
| difficulty, accessibility, casual, hard, nightmare, permadeath                                                          | `docs/engine_specs/09_difficulty_accessibility.md`                                          | Difficulty tiers and accessibility options                              |
| editor, srpgmaker tool, json editor, form editor, visual editor                                                         | `docs/editor_roadmap.md`                                                                    | 3-phase editor development plan (E-1 JSON → E-2 Form → E-3 Visual)      |
| game project, manifest, game.json, project format, project structure                                                    | `docs/game_project_format.md`                                                               | Canonical spec for game.json manifest + directory layout                |
| export, deploy, package, build, ios, android, desktop, web build, capacitor, tauri                                      | `docs/export_pipeline.md`                                                                   | Platform export guide (Web, iOS, Android, Desktop, Console)             |
| campaign, stage flow, stage select, world map, progression, roster                                                      | `docs/engine_specs/14_campaign_stage_flow.md`                                               | Multi-stage campaign state and flow transition                          |
| save, load, indexeddb, state persistence, restore, autosave                                                             | `docs/engine_specs/13_save_load_system.md`                                                  | IndexedDB Save/Load architecture for BattleState                        |
| victory condition, dynamic win loss, survival, escort, assassination, game rule, stage condition                        | `docs/engine_specs/12_dynamic_stage_conditions.md`                                          | Advanced win/loss conditions evaluation                                 |
| platform separation, decouple engine, GameProjectLoader, phase r-1, manifest, game.json                                 | `docs/engine_specs/11_game_project_loader.md`                                               | Engine/Data decoupling architecture                                     |
| sample game, chronicle, chronicle of shadows, kael, lyra, zara, serra                                                   | `games/chronicle-of-shadows/`                                                               | Sample game project directory (game.json + data/ + docs/)               |
| game design, playtime, 20 hours, story arc, spectacle, campaign design, act, chapter                                    | `games/chronicle-of-shadows/docs/game_design_master.md`                                     | Full game design document: 20h playtime, 4 acts, story arcs, strategic campaign |
| strategic layer, grand strategy, 삼국지, world conquest, two-layer, strategic overview                                   | `docs/engine_specs/21_strategic_layer_master.md`                                            | Master plan: architecture, game loop, confirmed decisions, MVP roadmap  |
| world map, graph, node, edge, territory map, fog of war, FoW, scouting, scout, vision, world rendering, WorldMapScene, PhaserWorldRenderer, IWorldRenderer, WorldCameraController, WorldMinimapDisplay, WorldInputHandler | `docs/engine_specs/22_world_map_system.md`                                                  | Graph-based world map, FoW, vision, rendering approach. Impl: `src/scenes/WorldMapScene.ts`, `src/engine/renderer/PhaserWorldRenderer.ts` |
| faction, economy, diplomacy, territory, resources, gold, food, troops, wandering generals, recruitment, alliance, war    | `docs/engine_specs/23_faction_economy_diplomacy.md`                                         | Factions, economy, territory upgrades, diplomacy, wandering generals    |
| strategic AI, AI personality, faction AI, fortress guardian, blitz, opportunist, AI matrix                                | `docs/engine_specs/24_strategic_ai_matrix.md`                                               | 6 AI personality types, decision scoring, trait weight matrix           |
| deployment, formation, pre-battle, lineup, commander, leadership, auto-pick, line attack, defense formation              | `docs/engine_specs/25_deployment_formation.md`                                              | Pre-battle unit selection, 3 formation presets, commander buffs         |
| time system, world turn, multi-battle, auto-battle, simultaneous, battle resolution, replay, 30 turns, 30 days          | `docs/engine_specs/26_time_multi_battle.md`                                                 | World turn ↔ battle turn mapping, auto-battle resolver, multi-battle   |
| casualty, troop loss, death roll, injury, post-battle, CasualtySystem                                                  | `src/engine/strategic/systems/CasualtySystem.ts`                                            | HP%-based troop loss, death/injury rolls, territory transfer, retreat  |
| world turn cycle, turn system, phase transition, advance turn, WorldTurnSystem, StrategicAI, auto-battle, BattleMapBuilder | `src/engine/strategic/systems/WorldTurnSystem.ts`, `StrategicAI.ts`, `AutoBattleResolver.ts` | Turn cycle orchestration, AI decisions, headless battle simulation    |

## Key File Paths (Quick Reference)

| System                 | Entry Point                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| Game state             | `src/engine/state/GameStore.ts`, `src/engine/state/BattleState.ts` |
| Actions (commands)     | `src/engine/state/actions/`                                        |
| Scene graph            | `src/scenes/`                                                      |
| Game logic (no Phaser) | `src/engine/systems/`                                              |
| Phaser rendering       | `src/engine/renderer/PhaserRenderer.ts`                            |
| Action coordinator     | `src/engine/coordinator/BattleCoordinator.ts`                      |
| Input                  | `src/engine/input/InputHandler.ts`                                 |
| AI systems             | `src/engine/systems/ai/`                                           |
| Combat formulas        | `src/engine/systems/combat/`                                       |
| Turn FSM               | `src/engine/systems/turn/TurnManager.ts`                           |
| Data types             | `src/engine/data/types/`                                           |
| Game project loader    | `src/engine/loader/GameProjectLoader.ts`                           |
| Sample game data       | `games/chronicle-of-shadows/data/`                                 |
| Unit tests             | `tests/<system>/` (mirrors `src/engine/systems/`)                  |
| Integration tests      | `tests/integration/` — headless battle simulation, balance harness |
| Test helpers           | `tests/integration/helpers.ts` — `buildStore()`, `makeUnitData()`  |
| Headless renderer      | `src/engine/renderer/NullRenderer.ts` — IRenderer no-op stub       |
| Audio coordinator      | `src/engine/coordinator/AudioCoordinator.ts`                       |
| Audio interface        | `src/engine/renderer/IAudioManager.ts`                             |
| Strategic types        | `src/engine/strategic/data/types/`                                 |
| Strategic state        | `src/engine/strategic/state/` (WorldStore, WorldAction, WorldState)|
| Strategic systems      | `src/engine/strategic/systems/` (Territory, Army, Faction)         |
| Strategic actions      | `src/engine/strategic/state/actions/`                              |
| Strategic event bus    | `src/engine/strategic/WorldEventBus.ts`                            |
| Strategic battle types | `src/engine/strategic/data/types/BattleResult.ts`                  |
| Strategic turn system  | `src/engine/strategic/systems/WorldTurnSystem.ts`                  |
| Strategic AI           | `src/engine/strategic/systems/StrategicAI.ts`                      |
| Casualty system        | `src/engine/strategic/systems/CasualtySystem.ts`                   |
| Battle map builder     | `src/engine/strategic/systems/BattleMapBuilder.ts`                 |
| Auto-battle resolver   | `src/engine/strategic/systems/AutoBattleResolver.ts`               |
| Advance turn action    | `src/engine/strategic/state/actions/AdvanceTurnAction.ts`          |
| Resolve battle action  | `src/engine/strategic/state/actions/ResolveBattleAction.ts`        |
| Strategic tests        | `tests/strategic/` (85+ tests)                                     |
| Strategic data (JSON)  | `games/chronicle-of-shadows/data/world.json`, `factions.json`, `diplomacy.json` |
| World coordinator      | `src/engine/coordinator/WorldCoordinator.ts`                       |
| World renderer         | `src/engine/renderer/PhaserWorldRenderer.ts`, `IWorldRenderer.ts`  |
| World camera           | `src/engine/renderer/WorldCameraController.ts`                     |
| World minimap          | `src/engine/renderer/WorldMinimapDisplay.ts`                       |
| World input            | `src/engine/input/WorldInputHandler.ts`                            |
| World map scene        | `src/scenes/WorldMapScene.ts`                                      |
| World coordinator test | `tests/strategic/WorldCoordinator.test.ts`                         |
| Game design master     | `games/chronicle-of-shadows/docs/game_design_master.md`            |
| E2E test (planned)     | `tests/e2e/` (not yet created)                                     |

## Usage

1. Read user request keywords
2. Match against first column above
3. Load **only** matched doc(s)
4. If no match → read `docs/architecture.md` first as overview
