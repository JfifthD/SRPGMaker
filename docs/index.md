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
| dialogue, conversation, portrait, cutscene, scenario                                                                    | `docs/todo/implement-dialogue-system.md`                                                    | Dialogue system design + impl plan                                      |
| irenderer, renderer abstraction, swap engine                                                                            | `docs/todo/implement-irenderer.md`                                                          | IRenderer interface layer task                                          |
| graphics, upgrade, sprite, animation, hd-2d, spine, pixellab, vfx, tile, asset pipeline                                 | `docs/todo/graphics-upgrade.md`                                                             | Graphics upgrade roadmap                                                |
| balance, stats, numeric, damage formula, ap economy, affinity, critical, scaling                                        | `games/chronicle-of-shadows/docs/balance_tables.md`                                         | Master sheet for all numeric balance, stats, and formulas (sample game) |
| audio, sound, bgm, sfx, music, spatial audio, volume ducking                                                            | `docs/engine_specs/07_audio_framework.md`                                                   | Audio architecture, BGM/SFX asset list, spatial audio                   |
| narrative, story, lore, world, characters, factions, affinity, choices                                                  | `games/chronicle-of-shadows/docs/world_narrative.md`                                        | World lore, character profiles, synopsis (sample game)                  |
| tutorial, onboarding, learning curve, help, undo, tips                                                                  | `games/chronicle-of-shadows/docs/tutorial_onboarding.md`                                    | Phased learning curve design (sample game)                              |
| metagame, loop, camp, shop, equipment, prep, progression                                                                | `docs/engine_specs/08_metagame_loop.md`                                                     | Out-of-combat loop: results, camp, prep phase                           |
| difficulty, accessibility, casual, hard, nightmare, permadeath                                                          | `docs/engine_specs/09_difficulty_accessibility.md`                                          | Difficulty tiers and accessibility options                              |
| editor, srpgmaker tool, json editor, form editor, visual editor                                                         | `docs/editor_roadmap.md`                                                                    | 3-phase editor development plan (E-1 JSON → E-2 Form → E-3 Visual)      |
| game project, manifest, game.json, project format, project structure                                                    | `docs/game_project_format.md`                                                               | Canonical spec for game.json manifest + directory layout                |
| export, deploy, package, build, ios, android, desktop, web build, capacitor, tauri                                      | `docs/export_pipeline.md`                                                                   | Platform export guide (Web, iOS, Android, Desktop, Console)             |
| sample game, chronicle, chronicle of shadows, kael, lyra, zara, serra                                                   | `games/chronicle-of-shadows/`                                                               | Sample game project directory (game.json + data/ + docs/)               |

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
| Tests                  | `tests/` (mirrors `src/engine/systems/`)                           |

## Usage

1. Read user request keywords
2. Match against first column above
3. Load **only** matched doc(s)
4. If no match → read `docs/architecture.md` first as overview
