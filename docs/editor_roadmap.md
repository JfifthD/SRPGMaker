# Editor Roadmap

> SRPGMaker editor development plan — 3 phases from JSON-first to visual.
> Updated: 2026-02-26

---

## Philosophy

The editor is developed **incrementally** — each phase is fully usable and ships value.
A developer using JSON files in Phase E-1 can always upgrade to the visual editor later;
the underlying game project format remains identical throughout all phases.

---

## Phase E-1: JSON-First Editor (Current — in scope)

**Target user**: Developer / technical designer
**Mode**: `MODE=editor npm run dev`

### Features

- Editor home screen: lists all game projects in `games/`
- Select a project → loads its `game.json`
- JSON textarea panels for: units, skills, terrains, maps
- JSON parse validation on each save (inline error display)
- Hot-reload: changes immediately reflected in embedded battle preview
- Save to `games/<id>/data/*.json` (via browser File System Access API or Electron `fs`)

### File Layout

```
src/editor/
├── scenes/
│   └── EditorScene.ts        ← Phaser scene hosting editor UI panels
└── ui/
    └── JsonEditorPanel.ts    ← Textarea + parse/save logic
```

### Entry Point Behavior

`main.ts` reads `MODE` env var (injected by Vite):
- `MODE=editor` → launch `EditorScene` + embedded `BattleScene`
- `MODE=game` (default) → launch only game scenes (no editor code)

---

## Phase E-2: Form-Based Editor (Mid-term)

**Target user**: Non-developer game designer

### Features

- Unit editor: form fields for each `UnitData` property (id, name, stats, skills dropdown)
- Skill editor: dropdowns for `type`, `target`; number inputs for `mp`, `range`, `mult`
- Terrain editor: form with moveCost, defBonus, passable toggle
- Map editor: JSON-based tile grid (visual map editor in E-3)
- Live preview: form changes instantly reflected in embedded battle preview
- Validation: prevent invalid values (negative HP, unknown skill IDs, etc.)

---

## Phase E-3: Visual Map Editor (Long-term)

**Target user**: Game designer / level designer

### Features

- Tilemap painter: click/drag to paint terrain tiles
- Unit spawn placement: drag unit icons from roster panel onto map
- Event/trigger zone drawing: define victory/defeat zones visually
- Map properties panel: width, height, conditions
- Outputs: standard `data/maps/<map_id>.json`

---

## Technical Constraints

- Editor code lives in `src/editor/` — **NEVER** included in game exports
- `vite build --mode game` excludes all `src/editor/` imports via tree-shaking
- Editor state is ephemeral (no separate store) — saved directly to filesystem
- Phase E-2 and E-3 are long-term goals; Phase E-1 unblocks sample game iteration now
