# Engine Spec: Phase R-1 & GameProjectLoader

> Target: Complete decoupling of Engine core from specific game data

## 1. Context & Motivation

Currently, systems like `EnemyAI` static-import data files (e.g., `import skills from '@game/data/skills.json'`). This tightly couples the engine logic to a specific build-time data asset. For SRPGMaker to function as a true platform and engine, the engine code must possess **zero hardcoded knowledge** of the game being played. The `GameProjectLoader` must serve as the single source of truth for all injected data at runtime.

## 2. Architecture: GameProject Injection

```mermaid
graph TD
    A[main.ts] --> B[GameProjectLoader.load(GAME_ID)]
    B --> C[Fetch game.json manifest]
    C --> D[Fetch units.json, skills.json, etc.]
    D --> E[Construct GameProject object]
    E --> F[GameStore.init(GameProject, MapData)]
    F --> G[BattleState]
```

### The `GameProject` Type (src/engine/data/types/GameProject.ts)

```typescript
export interface GameProject {
  manifest: GameManifest;
  data: {
    units: UnitData[];
    skills: Record<string, SkillData>;
    terrains: TerrainData[];
  };
  // Future extensions: global variables, macros, etc.
}
```

## 3. Implementation Steps

### 3.1 GameProjectLoader (src/engine/loader/)

Create an asynchronous loader that fetches the `game.json` manifest via Vite's `import.meta.glob` or dynamic `import()`, parses it, and builds the `GameProject` interface in memory.

### 3.2 Modifying GameStore & BattleState

Change `GameStore.init(mapData: MapData)` to `GameStore.init(project: GameProject, mapData: MapData)`.
`BattleState` must hold a reference to the `GameProject` object so that actions/systems can query it safely:

```typescript
export interface BattleState {
  project: GameProject; // Read-only reference to the static game data
  map: MapData;
  units: Record<string, UnitInstance>;
  // ...
}
```

### 3.3 Decoupling Existing Systems

- **EnemyAI**: Remove `import skills` and `import mapData`. Instead, access `state.project.data.skills`.
- **GameStore.createUnit()**: Must access `state.project.data.units` to lookup stats by `unitDataId`.
- **BootScene**: Call `GameProjectLoader.load()` and store the resulting `GameProject` in the Phaser `registry` for synchronous access later.

## 4. Risks & Mitigations

- **Risk**: Performance hit from deep lookups (`state.project.data.skills[id]`).
- **Mitigation**: These lookups are inherently fast O(1) object property accesses. No deep cloning is performed since the `GameProject` object is treated as immutable metadata.
