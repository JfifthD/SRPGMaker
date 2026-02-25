# Task: Graphics Upgrade — Triangle Strategy Level

## Target & Vision

**Reference**: Triangle Strategy (2022, Square Enix / Team Asano)
- High-fidelity pixel character sprites with frame-by-frame battle animations
- Rich character portrait art (bust-up) with multiple emotional expressions
- Detailed isometric-style tile environments with depth layering
- HD-2D aesthetic: pixel sprites + depth/lighting effects (bloom, DoF, film grain)

**Engine Reality Check**:

| Layer | Current Stack | Sprite Quality | HD-2D Env Effects |
|---|---|---|---|
| Phaser 3 (now) | 2D only | ✅ achievable | ❌ not possible |
| Phaser 3 + Three.js hybrid | 2D logic + 3D bg | ✅ achievable | ⚠️ partial |
| Full Three.js via ThreeRenderer | 3D engine | ✅ achievable | ✅ full HD-2D |

Because `IRenderer` abstraction is already planned (`docs/todo/implement-irenderer.md`), the 3D upgrade path is possible without touching game logic. **This task focuses on getting all sprite/animation assets production-ready first**, regardless of engine.

---

## Tool Pipeline (MCP-connected)

All primary tools below have confirmed MCP server support — meaning Antigravity can operate them directly.

```
Scenario.gg ──► PixelLab MCP ──► Aseprite MCP ──► Spine MCP ──► Phaser 3
(style seed)    (pixel art gen)   (edit/atlas)    (animation rig) (runtime)
```

| Tool | Role | MCP | Notes |
|---|---|---|---|
| **Scenario.gg** | Style consistency seed, batch generation | ✅ community server | Upload concept art → train custom model → consistent character style across all assets |
| **PixelLab** | Pixel art sprite generation, animation frames | ✅ official | [pixellab.ai/mcp](https://www.pixellab.ai/mcp); text-prompt → pixel sprite; directional/emotion variants |
| **Aseprite** | Manual pixel editing, sprite sheet export, atlas packing | ✅ community | [pixel-mcp](https://github.com/willibrandon/pixel-mcp); final polish, consistency pass |
| **Spine 2D** | Skeletal rigging + animation (walk, attack, idle, hurt) | ✅ official | [docs.getspine.ai/mcppage](https://docs.getspine.ai/mcppage); Phaser 3 has official Spine plugin |
| **Ludo.ai** | Full sprite sheet generation with auto-animation | ✅ official beta | [ludo.ai/api-mcp-integration](https://ludo.ai/api-mcp-integration); keyframe-free animation generation |

> **DragonBones is not used.** Last Phaser 3 plugin update was 7 years ago; no MCP support.
> Spine 2D is the production choice — active development, official Phaser 3 integration, MCP-connected.

---

## Asset Inventory & Naming Conventions

### 1. Battle Map Sprites (Unit Sprites)

Each playable/enemy unit needs a **sprite atlas** for battle map display.

**Animations required per unit:**

| Animation Key | Frames | Loop | Description |
|---|---|---|---|
| `idle` | 4 | ✅ loop | Subtle breathing/sway |
| `walk` | 8 | ✅ loop | 4-directional (N/S/E/W) |
| `attack_melee` | 8 | ❌ once | Strike forward, return |
| `attack_ranged` | 6 | ❌ once | Draw → release |
| `cast` | 10 | ❌ once | Spell casting buildup |
| `hurt` | 4 | ❌ once | Recoil backward |
| `death` | 8 | ❌ once | Fall/fade out |
| `victory` | 6 | ✅ loop | Post-combat pose |

**File naming**: `units/{character_key}/{character_key}_sprite.atlas` (Spine export)
**Fallback PNG atlas**: `units/{character_key}/{character_key}_spritesheet.png` + `.json`

**Characters**:
- Allies: `kael`, `lyra`, `zara`, `serra`
- Enemy archetypes: `soldier`, `archer`, `mage`, `dark_knight`, `summoner`, `boss_01`

**Sprite canvas size**: 48×64px per frame (upscaled ×2 → 96×128 in engine for crispness)

---

### 2. Portrait Art (Dialogue System)

Used by `IDialogueRenderer` / `PhaserDialogueRenderer`. Bust-up art, not pixel style — painterly/detailed in Triangle Strategy fashion.

**Emotions required per character**:

| Emotion | Key |
|---|---|
| Neutral (default) | `neutral` |
| Determined | `determined` |
| Happy / Relieved | `happy` |
| Sad / Worried | `sad` |
| Angry | `angry` |
| Surprised | `surprised` |
| Wounded / Exhausted | `wounded` |
| Smug / Confident | `smug` |
| Fearful | `fearful` |

**File naming**: `portraits/{character_key}_{emotion}.png`
**Canvas size**: 512×640px (portrait aspect), transparent background, centered on face/torso

**Load key format** (used in PhaserDialogueRenderer): `portrait_{character_key}_{emotion}`
```typescript
// BootScene preload:
this.load.image(`portrait_kael_neutral`, `assets/images/portraits/kael_neutral.png`);
```

---

### 3. Map Tileset

Triangle Strategy uses hand-crafted isometric tiles with strong depth. For Phaser 3's top-down grid, target layered tile art with strong shadow/depth.

**Tile size**: 64×64px base, 64×96px for tall objects (trees, buildings)

**Terrain types** (matching `src/assets/data/terrains.json`):

| Key | Tiles needed | Notes |
|---|---|---|
| `plain` | base, corner variants (4), edge variants (8) | Grass, subtle blade variation |
| `forest` | base, dense, edge | Multiple tree layers, depth overlap |
| `mountain` | base, peak, slope (N/S/E/W) | Strong shadow on south face |
| `wall` | base, top, corner | Castle stone texture |
| `water` | base (animated 4f), shore edges | Animated shimmer |
| `village` | floor, building_small, building_large | Interior/exterior tiles |

**File naming**: `tiles/{terrain_key}/{terrain_key}_{variant}.png`
**Atlas**: `assets/images/tiles/tilesheet.png` + Tiled `.json` export

---

### 4. Skill VFX Sprites

Used by `IRenderer.animateSkillCast()` / `PhaserRenderer`.

Each skill needs a VFX sprite sheet. Organized by damage type.

| Damage Type | VFX Keys | Frames |
|---|---|---|
| Physical | `vfx_slash`, `vfx_cleave`, `vfx_shield_bash` | 6–8f |
| Magic | `vfx_fire`, `vfx_frost`, `vfx_blast` | 10–12f |
| Holy | `vfx_heal`, `vfx_smite`, `vfx_bless` | 8f |
| Dark | `vfx_curse`, `vfx_drain` | 8f |
| Nature | `vfx_thorns`, `vfx_roots` | 8f |

**File naming**: `vfx/{vfx_key}_sheet.png` (horizontal strip, frame width = total_width / frame_count)

---

### 5. UI Graphics

| Element | File | Notes |
|---|---|---|
| Dialogue text box | `ui/dialogue_box.png` | 9-slice scalable panel |
| Dialogue name tag | `ui/namebox.png` | 9-slice |
| HP bar | `ui/hpbar_fill.png`, `ui/hpbar_bg.png` | Gradient fill |
| MP bar | `ui/mpbar_fill.png`, `ui/mpbar_bg.png` | |
| Turn order icon frame | `ui/turn_frame.png` | |
| Skill icon frame | `ui/skill_frame.png` | |
| Cursor / tile select | `ui/cursor.png` (animated 4f) | |
| Affinity icons | `ui/affinity_{type}.png` × 5 | Physical/Magic/Holy/Dark/Nature |
| Terrain bonus badge | `ui/terrain_bonus.png` | |

---

## Implementation Phases

### Phase 1 — Placeholder → Real Sprites (Characters)

**Goal**: Replace procedural Canvas circles with actual unit sprites on the battle map.

Steps:
1. Generate base idle sprites for 4 allies via **PixelLab MCP** with consistent style prompt
2. Clean up and normalize in **Aseprite MCP** → export as spritesheet PNG + JSON atlas
3. Load in `BootScene.ts` via `this.load.atlas()`
4. Update `UnitSprite` class to use `this.scene.add.sprite()` with atlas key instead of Graphics circle
5. Wire `idle` animation to play on create, `walk` on `animateMove()`, `hurt` on `animateAttack()`

**Spine integration** (optional for Phase 1, required for Phase 2):
- Export Spine skeleton data (`.skel` + `.atlas`) instead of frame-by-frame PNG
- Load via Spine Phaser 3 plugin: `this.load.spine(key, skeletonFile, atlasFile)`

---

### Phase 2 — Full Animation Set

**Goal**: All animation states working for all units.

Steps:
1. Rig characters in **Spine** (or generate via **Ludo.ai MCP** for rapid prototyping)
2. Define animations: `idle`, `walk_N/S/E/W`, `attack_melee`, `attack_ranged`, `cast`, `hurt`, `death`, `victory`
3. Integrate Spine plugin into Phaser 3 build:
   ```typescript
   // vite.config.ts — add Spine plugin to Phaser build
   // package.json — add @esotericsoftware/spine-phaser dependency
   ```
4. Update `PhaserRenderer.animateMove()` to play `walk` animation during tween, `idle` on complete
5. Update `PhaserRenderer.animateAttack()` to play `attack_melee` / `attack_ranged` based on unit class

---

### Phase 3 — VFX & Polish

**Goal**: Skill animations, floating damage numbers with style, screen effects.

Steps:
1. Generate VFX sprite sheets via **PixelLab MCP** for all skill damage types
2. Load as frame-strip animations in `BootScene.ts`
3. Implement `PhaserRenderer.animateSkillCast()` with particle emitters + VFX sheets
4. Add floating damage numbers: bitmap font, bounce tween, red/yellow/green color coding
5. Camera shake on impact via `this.cameras.main.shake()`
6. Add post-FX pipeline (Phaser 3.60+ WebGL pipeline):
   - Bloom effect on magic skills
   - Vignette on ENEMY_PHASE

---

### Phase 4 — HD-2D Environment (Engine Upgrade Path)

**Goal**: Triangle Strategy-level depth effects — requires `ThreeRenderer` via IRenderer.

This phase is gated on `IRenderer` abstraction being complete first.

Steps:
1. Implement `ThreeRenderer implements IRenderer` in `src/renderer/ThreeRenderer.ts`
2. Replace Phaser 3 map rendering with Three.js scene:
   - Tile geometry as flat quads in 3D space with Y-sorting
   - Pixel sprite characters billboarded in 3D scene
   - Directional lighting (warm sun angle, cool shadow)
3. Post-processing via Three.js `EffectComposer`:
   - `UnrealBloomPass` for glow on magic/fire effects
   - `BokehPass` (depth of field) for cinematic shots
   - Film grain shader (`FilmPass`)
4. `BattleScene.ts` swaps `new PhaserRenderer(this)` for `new ThreeRenderer(canvas)` — zero other changes

---

## File Checklist

| Category | Action |
|---|---|
| `src/assets/images/units/{key}/{key}_spritesheet.png+json` | Generate per unit |
| `src/assets/images/portraits/{key}_{emotion}.png` | Generate per character × 9 emotions |
| `src/assets/images/tiles/tilesheet.png+json` | Generate terrain tiles |
| `src/assets/images/vfx/{key}_sheet.png` | Generate per skill VFX |
| `src/assets/images/ui/*.png` | Generate UI chrome elements |
| `src/sprites/UnitSprite.ts` | MODIFY: switch Graphics → Spine/Atlas sprite |
| `src/scenes/BootScene.ts` | MODIFY: add all asset preloads |
| `src/renderer/PhaserRenderer.ts` | MODIFY: wire animations per IRenderer methods |
| `package.json` | MODIFY: add `@esotericsoftware/spine-phaser` when Phase 2 begins |
| `vite.config.ts` | MODIFY: Spine WASM loader config |

---

## Asset Generation Prompt Templates

Use these as starting points for PixelLab / Scenario.gg prompts. Adjust to match chosen art direction.

**Character sprite (battle map)**:
```
SRPG warrior character sprite, top-down 3/4 view, 48x64 pixel art,
dark fantasy medieval armor, muted color palette, Triangle Strategy style,
idle animation frame, transparent background, crisp pixel edges, no anti-aliasing
```

**Portrait (dialogue bust)**:
```
SRPG character portrait bust, {character_name}, {emotion} expression,
detailed painterly pixel art, dark fantasy, Triangle Strategy / Tactics Ogre style,
512x640px, bust from waist up, transparent background, dramatic side lighting,
highly detailed armor/clothing
```

**VFX (fire skill)**:
```
SRPG skill VFX sprite sheet, fire explosion, 10 frames horizontal strip,
pixel art, transparent background, warm orange-red palette, dramatic burst,
crisp edges, fantasy game style, 64x64 per frame
```

---

## Notes

- **Spine vs frame-by-frame**: Spine skeletal animation drastically reduces the number of image files needed and allows smooth blending between animations. Recommended for Phase 2+. Frame-by-frame PNG atlases are fine for Phase 1 prototyping.
- **Asset consistency**: Train a Scenario.gg custom model on 5–10 concept art references before generating all characters. This ensures visual consistency across allies and enemies without per-image prompt tuning.
- **Portrait style vs sprite style**: Triangle Strategy uses different art styles for portraits (painterly, detailed) vs battle sprites (pixel, small). This is intentional — follow the same split.
- **Phaser 3 Spine plugin**: Requires WebAssembly runtime. Add `spinePlugin: SpinePlugin` to the Phaser game config and configure Vite to handle `.wasm` files.
- **IRenderer dependency**: Phases 1–3 work entirely within `PhaserRenderer`. Phase 4 (HD-2D) requires `IRenderer` to be complete first — do not attempt Phase 4 before `implement-irenderer` task is done.
