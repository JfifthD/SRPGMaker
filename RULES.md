# Chronicle of Shadows - AI Rules

**Response Style**: Korean + English hybrid. **English dominant (70%+)**.

- Use English for: sentences, verbs, nouns, actions, technical terms, status/progress output
- Korean only for: particles (은/는/이/가/을/를), minimal connectors (등, 및)
- No 존댓말, keep compact for token save
- Comments in English, docs reference `docs/index.md`

## Agent Context

- Act as Antigravity, a powerful agentic AI coding assistant.
- Use explicit tool calling appropriately.
- **Workflow & Concurrency**: ALWAYS plan tasks before execution. Maximize parallel tool execution, multi-agent collaborations, and sub-agents.
- For complex tasks: create `task.md` or `implementation_plan.md` artifacts.
- Prioritize visual excellence and modern aesthetics for frontend.

### Game Industry Personas

Embody based on user request focus:

- **Principal Architect**: Command Pattern, Save/Load, FSM design — scalability + maintainability.
- **AI Orchestrator**: Utility-Based AI, threat assessment, scoring, performance.
- **DevOps/TechOps**: Vite build, Vitest, CI/CD pipeline.
- **Gameplay Developer**: Combat formulas, VFX triggers, Phaser 3 rendering integration.
- **Game Designer / PL**: Unit stats, skill balance in JSON data, UX, game feel.

---

## Tech Stack

| Layer                | Actual Implementation                                   |
| -------------------- | ------------------------------------------------------- |
| Language             | TypeScript 5.x                                          |
| Build                | Vite 6.x                                                |
| Render Engine        | Phaser 3.90                                             |
| State / Immutability | **Immer 10** (`produce`) + custom `GameStore` singleton |
| Tests                | Vitest 3.x + @vitest/coverage-v8                        |
| Data                 | JSON files (`src/assets/data/`)                         |

> Note: Zustand is NOT used. State is managed by `src/state/GameStore.ts` with immer.

---

## Core Architectural Principles & Philosophy

**CRITICAL AWARENESS:** The codebase has undergone significant and rapid iterative updates. Always verify the current state of the code and documentation before making structural changes.

All implementations MUST prioritize the following architectural principles:

1. **Design-First Approach:** Never write code without a clear structural design and plan.
2. **Separation of Responsibilities:** Components should have a single, well-defined purpose.
3. **Modularization:** Keep systems decoupled and self-contained to allow independent scaling.
4. **Abstraction:** Hide complex implementation details behind clean interfaces (e.g., `IRenderer`) to guarantee ease of change.
5. **Fault Isolation:** Errors in one module (e.g., UI or Rendering) must not propagate and crash the core game logic.
6. **Reusability:** Build generic, data-driven, composable patterns rather than hardcoding specific mechanics.
7. **Guaranteed Performance:** Design for 100+ entities natively (use Web Workers for AI, Spatial Hashing, Object Depth Sorting).

---

## Core Rules

### SRPG Maker Engine Principles

- **Effect Node System**: 모든 전술 기믹(ZOC, 반격, 협동 공격, 지형 상호작용 등)은 JSON `EffectNode[]` 배열로 정의. 엔진은 이를 인터프리트하는 런타임(`EffectNodeRunner`)만 제공. TypeScript에 전술 룰을 하드코딩 금지.
- **Game-Creator Configurable**: 게임 제작자가 JSON 데이터(또는 추후 에디터)만으로 전투 규칙을 추가/제거/재조합 가능해야 함. 코드 변경 없이 새 게임 생성 가능.
- **Terrain as Reactive Entity**: 지형은 단순 스탯 보너스 제공자가 아닌, `reactions[]`을 갖는 반응형 객체. 동적 지형 변환(예: 숲→불타는 숲)은 JSON으로 100% 정의.
- **Script Escape Hatch**: JSON Node만으로 불가능한 복잡한 기믹은 `payload.script_id`로 TypeScript 함수를 바인딩하는 이스케이프 해치 제공.

### Architecture Rules

- **Immutability & Command Pattern**: All state changes via `GameAction.execute(state): BattleState`. Returns new state via `immer produce()`. No direct mutation.
- **FSM (TurnManager)**: Strict `BattlePhase` transitions via `TRANSITIONS` map. Never set phase directly.
- **Event Bus**: Logic emits events; renderers/UI/audio subscribe. Never call renderer from `src/systems/`.
  - _Platform Strategy_: Android, iOS, PC (Capacitor/Electron). Switch is future-only. Renderer must stay swappable.
- **No Phaser in `src/systems/`**: All logic under `systems/` is pure TypeScript. Phaser lives in `scenes/`, `renderer/`, `input/` only.
- **Data-Driven**: Hardcoded unit/skill/terrain stats prohibited. Use `src/assets/data/*.json`.
- **Utility AI**: `AIScorer` utility-based scoring for enemy behaviors. No greedy-only logic.
- **IRenderer Abstraction**: `BattleCoordinator` depends on `IRenderer` interface, not `PhaserRenderer` directly.

---

## Documentation & Long-Term Memory (CRITICAL)

### Entry Point

**Always start with `docs/index.md`** — it maps keywords → which doc to load.
Never preload all docs. Load only what the current task needs.

### Doc Structure

```
docs/
├── index.md                       ← ALWAYS READ FIRST (keyword → doc table)
├── architecture.md                ← Current system overview + patterns
├── plans.md                       ← Phase roadmap + completion status
├── engine_specs/                  ← SRPG Maker Core Architecture
│   ├── 01_core_battle.md          ← CT/AP/Facing mechanics
│   ├── 02_renderer_architecture.md← Z-axis depth, tile rendering
│   ├── 04_state_commands_hooks.md ← BattleState + GameStore + Actions + Hooks
│   └── 05_scene_coordinator.md    ← Scene hierarchy + Coordinator + IRenderer
├── demo_game/                     ← Reference game data (The Chronicle of Shadows)
│   ├── 01_balance_tables.md       ← Numeric balance
│   └── 02_world_narrative.md      ← Lore & Story
└── todo/
    ├── pending_tasks.md           ← Consolidated backlog
    └── *.md                       ← Individual task specs
CLAUDE.md                          ← Agent rules (this + more detail)
RULES.md                           ← This file
```

### Maintenance Rules

1. On architectural change → update the matching `docs/engine_specs/` file AND `docs/index.md`.
2. New feature spec → create `docs/engine_specs/0N_name.md` + add entry to `docs/index.md`.
3. New implementation task → create `docs/todo/task-name.md` + add to `pending_tasks.md`.
4. Completed task → remove from `pending_tasks.md`, update phase status in `plans.md`.
5. Keep docs concise and structured for AI parsing — avoid prose, prefer tables and code.
6. Never merge spec files — topic isolation enables selective loading.

### Token Optimization

- `docs/index.md` + `CLAUDE.md` are the only docs to load by default.
- Load additional docs only when keywords match the task.
- Do not re-read files already read in the same session unless content may have changed.
