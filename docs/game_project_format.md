# Game Project Format

> Canonical spec for the `game.json` manifest and game project directory structure.
> Updated: 2026-03-01

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
    │   ├── audio.json         ← Audio config (BGM/SFX entries, event map, BGM flow)
    │   ├── world.json         ← World map graph (nodes + edges) [OPTIONAL]
    │   ├── factions.json      ← Faction definitions + generals [OPTIONAL]
    │   ├── diplomacy.json     ← Initial diplomatic relations [OPTIONAL]
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
    audio?: string;        // "data/audio.json"
    world?: string;        // "data/world.json"
    factions?: string;     // "data/factions.json"
    diplomacy?: string;    // "data/diplomacy.json"
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

### `audio.json`

Audio configuration with three sections:

```json
{
  "entries": {
    "<asset_id>": {
      "id": "<asset_id>",
      "category": "bgm" | "sfx",
      "file": "<relative path from audioDir>",
      "defaultVolume": 0.0-1.0,
      "loop": true | false,
      "tags": ["tense", "epic"]
    }
  },
  "eventMap": {
    "onUnitDamaged": "<sfx_asset_id>",
    "onCriticalHit": "<sfx_asset_id>"
  },
  "bgmFlow": {
    "title": "<bgm_asset_id>",
    "battle": "<bgm_asset_id>",
    "victory": "<bgm_asset_id>",
    "defeat": "<bgm_asset_id>",
    "camp": "<bgm_asset_id>"
  }
}
```

See `docs/engine_specs/07_audio_framework.md` for the full event map key list.

### `world.json` (Optional — Strategic Layer)

Graph-based world map for the grand strategy layer:

```json
{
  "mapWidth": 800, "mapHeight": 600,
  "nodes": [
    {
      "id": "aldoria_capital", "name": "Aldoria Capital", "type": "city",
      "x": 200, "y": 400, "terrain": "plains",
      "visionRadius": 7, "defenseBonus": 30, "maxUpgradeSlots": 4,
      "battleMapId": "stage_capital"
    }
  ],
  "edges": [
    {
      "id": "e1", "from": "aldoria_capital", "to": "eastern_fort",
      "bidirectional": true, "moveCost": 1, "terrain": "plains", "passable": true
    }
  ]
}
```

Node types: `city`, `fortress`, `village`, `port`, `pass`, `camp`.
Terrain types: `plains`, `forest`, `mountain`, `desert`, `coastal`, `swamp`, `snow`.
See `src/engine/strategic/data/types/World.ts` for full interfaces.

### `factions.json` (Optional — Strategic Layer)

Contains `factions` array and `generals` array:

```json
{
  "factions": [
    {
      "id": "aldora", "name": "Kingdom of Aldora", "color": 16711680,
      "leader": "kael", "capital": "aldoria_capital",
      "isPlayer": true,
      "aiProfile": { "preset": "steady_expander" },
      "startTerritories": ["aldoria_capital", "eastern_fort"],
      "startGenerals": ["kael", "lyra"],
      "startResources": { "gold": 5000, "food": 3000, "troops": 10000 }
    }
  ],
  "generals": [
    {
      "id": "kael", "name": "Kael", "unitDataId": "warrior",
      "leadership": 14, "intellect": 7, "politics": 5, "charm": 8
    }
  ]
}
```

AI presets: `fortress_guardian`, `ambush_predator`, `steady_expander`, `blitz_conqueror`, `diplomat_king`, `opportunist`.
See `src/engine/strategic/data/types/Faction.ts` and `General.ts` for full interfaces.

### `diplomacy.json` (Optional — Strategic Layer)

Initial diplomatic relations between factions:

```json
{
  "relations": {
    "aldora": {
      "shadow_legion": { "status": "war", "favorability": -80, "treatyTurnsLeft": 0 }
    },
    "shadow_legion": {
      "aldora": { "status": "war", "favorability": -80, "treatyTurnsLeft": 0 }
    }
  }
}
```

Status values: `war`, `hostile`, `neutral`, `friendly`, `allied`.
Favorability range: -100 to +100. Unspecified pairs default to `neutral` / 0.
See `src/engine/strategic/data/types/Diplomacy.ts` for full interface.

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
