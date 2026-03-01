# Pending Task Backlog

> Updated: 2026-03-01 | 492 tests | 83.44% coverage | tsc clean

> **[CRITICAL RULE: Design-First Approach]**
> Before implementing ANY feature, create or update the design doc first. Then implement to spec.

---

## Priority Order (Top → Bottom)

| # | Task | Category | Effort | Why This Order |
|---|------|----------|--------|----------------|
| 1 | **E2E Gameplay Testing** | Quality | M | Validates everything built so far; catches bugs before adding more features |
| 2 | **Phase S-4: Deployment + Formation** | Strategic | L | Next strategic phase; pre-battle general selection enables real tactical depth |
| 3 | **Phase S-5: Auto-Battle Polish + Multi-Battle** | Strategic | L | Completes the battle loop; seeded RNG + multi-front battles |
| 4 | **Phase S-6: Economy + Territory Upgrades** | Strategic | L | Resource management; makes strategic layer meaningful |
| 5 | **Phase S-7: Fog of War + Scouting** | Strategic | M | Information warfare; critical for strategy depth |
| 6 | **Phase S-8: Strategic AI (Full)** | Strategic | L | 8-trait personality system; makes AI opponents interesting |
| 7 | **Phase S-9: Diplomacy + Wandering Generals** | Strategic | L | Full strategic depth |
| 8 | **SRPGMaker Platform Tooling** | Platform | M | CLI, validation, asset pipeline — needed before editor |
| 9 | **Phase R-3: Editor Foundation (JSON-first)** | Editor | L | Core platform feature for game creators |
| 10 | **Phase S-10: Polish + Strategic Campaign** | Strategic | L | Final strategic layer polish |
| 11 | **Chronicle of Shadows: Full Game Content** | Content | XL | 20h playtime game; validates all engine systems |
| 12 | **Graphics Upgrade** | Visual | L | HD-2D, Spine, PixelLab; deferred until engine stable |

**Effort**: S = < 1 day, M = 1-3 days, L = 3-7 days, XL = 2+ weeks

---

## ✅ Completed Phases (Archive)

<details>
<summary>Click to expand completed phases (4.5, 5, 6, 7, 8-A, R-1, S-1, S-2, S-3)</summary>

- **Phase R-1**: GameProjectLoader + engine decoupling → `docs/engine_specs/11_game_project_loader.md` ✅
- **Phase 4**: Dynamic win/loss conditions → `docs/engine_specs/12_dynamic_stage_conditions.md` ✅
- **Phase 4**: Campaign flow → `docs/engine_specs/14_campaign_stage_flow.md` ✅
- **Phase 4**: Save/Load → `docs/engine_specs/13_save_load_system.md` ✅
- **Phase 4.5**: AP overhaul (hit-and-run, dynamic hovering, 3-zone overlay) ✅ 2026-02-27
- **Phase 5-1**: Level-up + growth system → `docs/engine_specs/15_levelup_growth.md` ✅
- **Phase 5-2**: Equipment system → `docs/engine_specs/16_equipment_system.md` ✅
- **Phase 5-3**: Job/class system → `docs/engine_specs/17_job_class_system.md` ✅
- **Phase 6**: AI personality types → `docs/engine_specs/18_ai_personality.md` ✅
- **Phase 7**: VFX, camera, minimap → `docs/engine_specs/19_vfx_camera_minimap.md` ✅
- **Phase 8-A**: Audio system → `docs/engine_specs/07_audio_framework.md` ✅
- **Phase S-1**: Strategic foundation (WorldState/Store/Action, Territory/Army/Faction systems) ✅
- **Phase S-2**: World map scene (IWorldRenderer, WorldCoordinator, PhaserWorldRenderer) ✅
- **Phase S-3**: Turn system + battle integration (CasualtySystem, AutoBattleResolver, BattleMapBuilder, StrategicAI, full turn cycle, scene flow) ✅
- **Tech Debt**: Undo UI (Z key), test coverage 69% → 83%, integration test infra ✅

</details>

---

## 🧪 Priority 1: E2E Gameplay Testing

> **Spec**: `docs/engine_specs/20_integration_test_guide.md` §10
> **Purpose**: Validate game at the player-experience level. Catch bugs that unit tests miss.

Current testing is all unit/integration (individual dispatch). No multi-turn gameplay simulation exists.

### E2E-1. StrategicTestRunner Helper
- [ ] `tests/e2e/helpers/strategicTestRunner.ts` — headless N-turn simulation
- [ ] Combines WorldStore + WorldTurnSystem + StrategicAI + AutoBattleResolver
- [ ] Pure sync loop (no setTimeout, no Phaser, no scene transitions)
- [ ] Seeded RNG for deterministic results

### E2E-2. Strategic Loop Test
- [ ] `tests/e2e/StrategicLoop.test.ts`
- [ ] 3-faction game resolves within 50 turns
- [ ] No army stuck in invalid state after N turns
- [ ] Faction elimination triggers correctly
- [ ] Territory ownership converges (one faction dominates)

### E2E-3. Battle Integration Test
- [ ] `tests/e2e/BattleIntegration.test.ts`
- [ ] Strategic collision → BattleMapBuilder → AutoBattleResolver → CasualtySystem → back to WorldState
- [ ] Verify casualties applied correctly (troop counts decrease)
- [ ] Verify territory transfer on siege victory
- [ ] Verify injury/death rolls affect general status

### E2E-4. AI Regression Test
- [ ] `tests/e2e/AIRegression.test.ts`
- [ ] AI factions create armies when idle generals exist
- [ ] AI armies move toward enemies (not stuck)
- [ ] No infinite loops or state corruption after 30 turns
- [ ] AI doesn't create more armies than territory count

### E2E-5. Balance Progression Test (Future)
- [ ] Multi-battle level/stat progression stays within expected range
- [ ] Commander buff doesn't create runaway advantage
- [ ] Death roll probability produces reasonable general attrition over 30 turns

---

## 🗺️ Priority 2: Phase S-4 — Deployment + Formation

> **Spec**: `docs/engine_specs/25_deployment_formation.md`

Pre-battle general selection and unit placement. Currently generals auto-map to spawns; this adds player choice.

- [ ] `DeploymentScene`: general selection UI (max 50 units, strict cap)
- [ ] Auto-pick algorithm (combatPower sorting by leadership + stats)
- [ ] 3 formation presets (Line Attack, Defense, Small Party) — no stat bonuses
- [ ] Commander leadership buff (1%/point, baked at init) — extend BattleMapBuilder
- [ ] Deploy zones: tiles = max(deployCount × 2, 15)
- [ ] Battle retreat option (after turn 10, 20% additional loss)
- [ ] Tests: deployment validation, formation placement, commander buff application

---

## ⚔️ Priority 3: Phase S-5 — Auto-Battle Polish + Multi-Battle

> **Spec**: `docs/engine_specs/26_time_multi_battle.md`

S-3 built a basic AutoBattleResolver. S-5 polishes it and adds multi-battle support.

- [ ] AutoBattleResolver: seeded RNG for deterministic/reproducible results
- [ ] AutoBattleResolver: use full EnemyAI (both sides) instead of simplified `decideHeadless`
- [ ] Commander delegation UI + strength estimation (1% casualty formula for preview)
- [ ] Multiple battles per turn (sequential for 3-way: 1st vs def → winner vs 2nd)
- [ ] Battle report (casualties, death, injury). ActionLog saved for future replay.
- [ ] Tests: seeded auto-battle reproducibility, multi-battle resolution

---

## 💰 Priority 4: Phase S-6 — Economy + Territory Upgrades

> **Spec**: `docs/engine_specs/23_faction_economy_diplomacy.md` §Economy

- [ ] Resource system (gold, food, troops) — `FactionState.resources`
- [ ] Territory production rates + population growth (linear + cap)
- [ ] EconomySystem: `collectResources()`, `payMaintenance()` per turn
- [ ] Upgrade system (walls, barracks, market, watchtower, hospital, granary)
- [ ] Army maintenance costs (food + gold per general)
- [ ] Troop recovery at territory (10%/turn base, 20% with Barracks)
- [ ] Capital relocation (1st free, then 500g + 3 turn cooldown)
- [ ] IWorldRenderer: territory upgrade panel, resource HUD
- [ ] Tests: resource collection, maintenance, upgrade effects, recovery

---

## 🌫️ Priority 5: Phase S-7 — Fog of War + Scouting

> **Spec**: `docs/engine_specs/22_world_map_system.md` §FoW

- [ ] FoW state per faction: hidden/explored/visible per node
- [ ] FoWSystem: `updateVision()` per turn
- [ ] Vision sources (territory 7/5 hops, army 3, scout 8, watchtower +2)
- [ ] Scout mode: GeneralState.status = 'scouting', 3 turns immobile, invisible, extended vision
- [ ] PhaserWorldRenderer: FoW overlay (darkened/hidden nodes)
- [ ] AI respects FoW (Normal: honest, Hard: explored, Nightmare: full vision)
- [ ] Tests: vision calculation, scout mode lifecycle, FoW updates

---

## 🤖 Priority 6: Phase S-8 — Strategic AI (Full)

> **Spec**: `docs/engine_specs/24_strategic_ai_matrix.md`

Replace basic StrategicAI with personality-driven system.

- [ ] Common 8-trait system (aggression, caution, expansion, defense, diplomacy, economy, loyalty, flexibility) × 1-10 scale
- [ ] 6 presets: fortress_guardian, ambush_predator, steady_expander, blitz_conqueror, diplomat_king, opportunist
- [ ] FactionEvaluator: threat/opportunity scoring per territory
- [ ] Multi-front coordination (natural emergence, no explicit coalition)
- [ ] Difficulty modifiers applied to AI decision weights
- [ ] Tests: trait-based decision verification, preset behavior regression

---

## 🤝 Priority 7: Phase S-9 — Diplomacy + Wandering Generals

> **Spec**: `docs/engine_specs/23_faction_economy_diplomacy.md` §Diplomacy

- [ ] Alliance/war/peace/NAP system + favorability tracking
- [ ] Diplomatic actions + AI reactions
- [ ] DiplomacySystem: `proposePeace()`, `declareWar()`, `formAlliance()`
- [ ] Wandering general spawning (Resolution Phase) + random stat generation
- [ ] AI factions hire wandering generals (politics-based priority)
- [ ] Desertion: loyalty < 30 → 30% chance → return to wandering pool
- [ ] Neutral territory conquest (no war declaration needed, optional guardians)
- [ ] Tests: diplomacy state changes, general hiring, desertion

---

## 🔧 Priority 8: SRPGMaker Platform Tooling

> **Rationale**: SRPGMaker is a platform, not just an engine. These tools are essential for game creators and AI-assisted development.

### T-1. Game Project Validation CLI
- [ ] `src/engine/loader/GameProjectValidator.ts` — validates game.json + all referenced files
- [ ] Schema validation for each JSON file type (units, skills, terrains, maps, world, factions)
- [ ] Cross-reference checks (e.g., skill IDs in units exist in skills.json)
- [ ] CLI entry: `npx srpgmaker validate <game-id>`
- [ ] Integrate into CI/pre-commit

### T-2. Game Project Scaffolding
- [ ] `npx srpgmaker create <game-id>` — scaffold new game project from template
- [ ] Copy template files + update game.json manifest
- [ ] Include minimal sample data (1 map, 2 units, 1 skill)

### T-3. Asset Pipeline (Future)
- [ ] Spritesheet import/validation (dimensions, frame count)
- [ ] Audio file validation (format, duration)
- [ ] Tilemap import from external editors (Tiled JSON export)

### T-4. Build + Export Pipeline
- [ ] `vite build --mode game` → production web build (verified working)
- [ ] Capacitor wrapping for iOS/Android
- [ ] Tauri wrapping for Desktop
- [ ] See `docs/export_pipeline.md` for full spec

---

## 🖥️ Priority 9: Phase R-3 — Editor Foundation (JSON-first)

> **Spec**: `docs/editor_roadmap.md` Phase E-1

- [ ] `src/editor/scenes/EditorScene.ts` — editor mode home screen
- [ ] JSON textarea panels for units, skills, terrains, maps, world
- [ ] JSON parse validation + inline error display
- [ ] Hot-reload preview (embedded BattleScene)
- [ ] `MODE=editor` entry point in `main.ts`
- [ ] Strategic data editing (world.json, factions.json, diplomacy.json)

---

## ✨ Priority 10: Phase S-10 — Polish + Strategic Campaign

- [ ] Chronicle of Shadows full strategic campaign (5 factions, 25+ nodes)
- [ ] AI personalities tuned per faction (preset + overrides)
- [ ] Story events (scripted general defections, alliance triggers)
- [ ] Battle map generation from world map (field: edge terrain blend, territory: type-based)
- [ ] Season effects (deferred from MVP), battle replay UI
- [ ] Balance tuning + tutorial integration

---

## 🎮 Priority 11: Chronicle of Shadows — Full Game Content

> **Design doc**: `games/chronicle-of-shadows/docs/game_design_master.md`
> **Target**: 20+ hours playtime, 4 acts, 24+ maps

Personal story → war escalation → continental conflict → climactic finale.

### G-1. Act 1 Content (6 maps + story data)
- [ ] 6 MapData files (stage_01 through stage_06): tutorial progression
- [ ] Dialogue JSON for each chapter (requires dialogue system implementation)
- [ ] Tutorial triggers (progressive mechanic introduction)
- [ ] Balance: 4-character squad, level 1-10
- [ ] Story beats: border patrol → investigation → conspiracy → exile

### G-2. Act 2 Content (strategic layer opens)
- [ ] Expand world.json: 13 → 20 nodes
- [ ] Add 2 new factions (Free City League, Order of the Dawn)
- [ ] 6 story battle maps + 4 strategic-triggered maps
- [ ] Story events (betrayal, alliance, siege)
- [ ] Balance: 6-8 characters, level 10-20

### G-3. Act 3 Content (full strategic campaign)
- [ ] Expand world.json: 20 → 25-30 nodes
- [ ] 5 factions fully operational with economies
- [ ] 10+ dynamic battle maps (strategic layer triggers)
- [ ] AI personality tuning per faction
- [ ] Balance: full roster, level 20-30

### G-4. Act 4 + Multiple Endings
- [ ] 4 climactic battle maps (multi-phase, scripted events)
- [ ] 3 endings based on choices (true/sacrifice/fallen)
- [ ] Character-specific epilogues based on affinity
- [ ] Full balance pass across all 24+ maps

### G-5. Supporting Content
- [ ] 30-40 unique units, 40-50 skills, 30-40 equipment items, 15-20 job classes
- [ ] 200+ dialogue entries
- [ ] 40-50 audio tracks (BGM + SFX)
- [ ] Hidden generals, side quests, optional battles

---

## 🎨 Priority 12: Graphics Upgrade

> **Spec**: `docs/todo/graphics-upgrade.md`

- [ ] HD-2D aesthetic (current: procedural shapes)
- [ ] Spine/DragonBones animation integration
- [ ] PixelLab or AI-generated sprite pipeline
- [ ] Isometric/tile-based visual upgrade
- [ ] VFX particle upgrade (screen-shake, screen-flash)

---

## 🔧 Tech Debt (Ongoing)

- [x] Undo UI connection: Z key → `coordinator.onCancel()` ✅ 2026-02-27
- [x] Test coverage expansion: 69% → 83.44% (492 tests, 40 files) ✅ 2026-03-01
- [ ] **Mobile touch input**: Capacitor-target touch event handling
- [ ] **Spatial Hash Grid**: 2D spatial partitioning for large map performance (100+ units)
- [ ] **Metagame loop implementation**: `docs/engine_specs/08_metagame_loop.md` (design only)
- [ ] **Difficulty/accessibility implementation**: `docs/engine_specs/09_difficulty_accessibility.md` (design only)
- [ ] **WorldCoordinator decomposition**: Turn cycle logic is ~180 lines in one class; consider extracting `TurnCycleController`

---

## 📐 Engine Spec Index

| #   | Document                                    | Status            |
| --- | ------------------------------------------- | ----------------- |
| 01  | `core_battle.md` — Combat core              | ✅ Implemented    |
| 02  | `renderer_architecture.md` — Renderer       | ✅ Implemented    |
| 03  | `advanced_tactics.md` — EffectNode system   | ✅ Implemented    |
| 04  | `state_commands_hooks.md` — State commands   | ✅ Implemented    |
| 05  | `scene_coordinator.md` — Scene coordinator   | ✅ Implemented    |
| 06  | `action_menu_ui.md` — Action Menu UI        | ✅ Implemented    |
| 07  | `audio_framework.md` — Audio                | ✅ Implemented    |
| 08  | `metagame_loop.md` — Metagame loop          | 📝 Design only   |
| 09  | `difficulty_accessibility.md` — Difficulty   | 📝 Design only   |
| 10  | `dialogue_system.md` — Dialogue system       | ✅ Implemented    |
| 11  | `game_project_loader.md` — GameProject       | ✅ Implemented    |
| 12  | `dynamic_stage_conditions.md` — Win/loss     | ✅ Implemented    |
| 13  | `save_load_system.md` — Save/Load            | ✅ Implemented    |
| 14  | `campaign_stage_flow.md` — Campaign flow     | ✅ Implemented    |
| 15  | `levelup_growth.md` — Level-up/growth        | ✅ Implemented    |
| 16  | `equipment_system.md` — Equipment            | ✅ Implemented    |
| 17  | `job_class_system.md` — Job tree             | ✅ Implemented    |
| 18  | `ai_personality.md` — AI personality         | ✅ Implemented    |
| 19  | `vfx_camera_minimap.md` — VFX/Camera/Minimap | ✅ Implemented    |
| 20  | `integration_test_guide.md` — Test guide     | ✅ Implemented    |
| 21  | `strategic_layer_master.md` — Strategic layer | ✅ S-1/S-2/S-3   |
| 22  | `world_map_system.md` — World map            | ✅ S-2 impl       |
| 23  | `faction_economy_diplomacy.md` — Economy     | 📝 S-6/S-9 待    |
| 24  | `strategic_ai_matrix.md` — Strategic AI      | 📝 S-8 待        |
| 25  | `deployment_formation.md` — Deployment       | 📝 S-4 待        |
| 26  | `time_multi_battle.md` — Time/multi-battle   | 📝 S-5 待        |
