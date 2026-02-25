# Game Project Format

> Canonical spec for the `game.json` manifest and game project directory structure.
> Updated: 2026-02-26

---

## Overview

A **game project** is a self-contained directory that SRPGMaker loads at runtime.
The sample game `games/chronicle-of-shadows/` is the reference implementation —
developing it simultaneously tests and validates this format.

---

## Directory Structure

```
games/
└── <game-id>/
    ├── game.json              ← Manifest (REQUIRED)
    ├── data/
    │   ├── units.json         ← All units (allies + enemies; "team" field distinguishes)
    │   ├── skills.json        ← Skill definitions
    │   ├── terrains.json      ← Terrain definitions
    │   └── maps/
    │       ├── stage_01.json  ← MapData for first map
    │       └── stage_02.json  ← ...
    ├── assets/
    │   ├── images/            ← Sprites, tilesets, portraits
    │   └── audio/             ← SFX, BGM
    └── docs/                  ← Game-specific design docs (NOT engine docs)
        ├── balance_tables.md
        ├── world_narrative.md
        └── tutorial_onboarding.md
```

---

## `game.json` Manifest Schema

```typescript
interface GameManifest {
  id: string;              // "chronicle-of-shadows"
  name: string;            // "The Chronicle of Shadows"
  version: string;         // "0.1.0"
  engineVersion: string;   // ">=0.1.0" (semver constraint)
  entryMap: string;        // "stage_01" (first map to load)
  data: {
    units: string;         // "data/units.json"
    skills: string;        // "data/skills.json"
    terrains: string;      // "data/terrains.json"
    mapsDir: string;       // "data/maps/"
  };
  assets?: {
    imagesDir?: string;    // "assets/images/"
    audioDir?: string;     // "assets/audio/"
  };
  meta?: {
    author?: string;
    description?: string;
    thumbnail?: string;    // "assets/images/thumbnail.png"
  };
}
```

---

## Data File Formats

### `units.json`

Single array containing ALL units. The `team` field distinguishes allies from enemies:

```json
[
  { "id": "warrior", "team": "ally",  "name": "Kael", ... },
  { "id": "e_grunt", "team": "enemy", "name": "Grunt", ... }
]
```

See `src/engine/data/types/Unit.ts` for the full `UnitData` interface.

Previous engines used split files (`units_allies.json`, `units_enemies.json`).
The merged single-file format is canonical going forward.

### `skills.json`

Record (object) keyed by skill ID:

```json
{
  "w_slash": { "id": "w_slash", "name": "HEAVY SLASH", "type": "phys", ... },
  "m_fire":  { "id": "m_fire",  "name": "FIREBALL",    "type": "magic", ... }
}
```

### `terrains.json`

Array of terrain definitions:

```json
[
  { "key": "plain",  "name": "Plain",  "moveCost": 1, "passable": true, ... },
  { "key": "forest", "name": "Forest", "moveCost": 2, "passable": true, ... }
]
```

### `maps/<map_id>.json`

MapData object:

```json
{
  "id": "stage_01",
  "name": "Broken Frontier",
  "width": 18,
  "height": 16,
  "terrain": [["plain", "forest", ...], ...],
  "allySpawns":  [{ "unitDataId": "warrior", "x": 1, "y": 7 }],
  "enemySpawns": [{ "unitDataId": "e_grunt", "x": 15, "y": 2 }],
  "victoryCondition": { "type": "defeat_all" },
  "defeatCondition":  { "type": "all_allies_dead" }
}
```

---

## Selecting a Game Project

The active game project is selected via the `GAME_ID` environment variable:

```bash
GAME_ID=chronicle-of-shadows npm run dev
```

Default (if unset): `chronicle-of-shadows`

The `@game` Vite alias resolves to `games/<GAME_ID>/`, so:
- `import manifest from '@game/game.json'` → loads `games/chronicle-of-shadows/game.json`
- `import units from '@game/data/units.json'` → loads `games/chronicle-of-shadows/data/units.json`

---

## Creating a New Game Project

1. Copy `games/chronicle-of-shadows/` as a template
2. Edit `game.json` — set `id`, `name`, `version`
3. Replace data files with your own content
4. Set `GAME_ID=<your-id>` when running dev

The format the sample game uses = the format ALL user games must follow.
There is no separate "engine format" vs "user format".

---

## Key Principle

**The sample game is the format.**
Every feature added to the engine must be validated through the sample game project.
If a mechanic can't be expressed in the game project JSON format, the format must be extended.
