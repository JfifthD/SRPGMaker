# Task: Implement IRenderer Graphics Abstraction Layer

## Context

You are working on **The Chronicle of Shadows** — a TypeScript + Vite + Phaser 3 SRPG.
Project root: `Games/SRPG/TheChronicleOfShadows/`

The project follows these core architectural principles:
- **Command Pattern**: All state mutations via `GameAction.execute(state): BattleState` (immer)
- **Typed EventBus**: All cross-system communication via `EventBus<GameEventMap>`
- **Data-Driven**: Game data in JSON under `src/assets/data/`
- **FSM**: `TurnManager` enforces strict `BattlePhase` transitions

### Current Problem

`src/scenes/BattleScene.ts` currently mixes **three responsibilities**:
1. **Rendering** — Phaser Graphics, UnitSprite management, tile highlights, damage numbers
2. **Input** — Phaser pointer events, keyboard shortcuts
3. **Coordination** — calling `store.dispatch()`, driving phase transitions, AI execution

This coupling makes graphics upgrades (higher-quality 2D, 3D engine swap) require touching game logic. The goal of this task is to isolate all rendering behind a clean interface.

---

## Goal

Refactor `BattleScene.ts` into three separate concerns:

```
src/
  renderer/
    IRenderer.ts          ← interface definition (NEW)
    PhaserRenderer.ts     ← Phaser 3 implementation (NEW, extracted from BattleScene)
  input/
    InputHandler.ts       ← pointer/keyboard input (NEW, extracted from BattleScene)
  coordinator/
    BattleCoordinator.ts  ← pure coordination logic (NEW, extracted from BattleScene)
scenes/
    BattleScene.ts        ← slimmed down: wires the above three together, owns Phaser lifecycle
```

---

## Step 1 — Define `src/renderer/IRenderer.ts`

Create the interface. All methods that touch Phaser **must** live behind this interface.

```typescript
import type { Pos } from '@/data/types/Map';
import type { BattleState } from '@/state/BattleState';
import type { UnitInstance } from '@/data/types/Unit';

export type HighlightMode = 'move' | 'attack' | 'skill' | 'aoe';

export interface IRenderer {
  // ── Map & Terrain ─────────────────────────────
  /** Full map redraw (terrain tiles, grid lines). Called once on init and on state change. */
  renderMap(state: BattleState): void;

  // ── Unit Visuals ───────────────────────────────
  /** Sync all unit sprite positions/states to current BattleState. */
  syncUnits(state: BattleState): void;

  /** Remove a unit's sprite (on defeat). */
  destroyUnit(unitId: string): void;

  // ── Tile Highlights ────────────────────────────
  /** Highlight a set of tiles in a given mode (color-coded). */
  highlightTiles(tiles: Pos[], mode: HighlightMode): void;

  /** Clear all tile highlights. */
  clearHighlights(): void;

  // ── Animations (all return Promise so coordinator can await) ──
  /** Animate a unit moving along a path. Path excludes the start tile. */
  animateMove(unitId: string, path: Pos[]): Promise<void>;

  /** Flash the attacker + shake the defender. */
  animateAttack(attackerId: string, defenderId: string): Promise<void>;

  /** Skill cast VFX (projectile, AoE burst, heal glow, etc.). */
  animateSkillCast(
    casterId: string,
    skillId: string,
    targets: Pos[],
  ): Promise<void>;

  // ── Floating Numbers ───────────────────────────
  showDamageNumber(pos: Pos, dmg: number, crit: boolean): void;
  showHealNumber(pos: Pos, amount: number): void;
  showMissText(pos: Pos): void;

  // ── Camera ─────────────────────────────────────
  /** Pan/zoom camera to center on a tile. */
  focusTile(pos: Pos): void;

  // ── Lifecycle ──────────────────────────────────
  /** Called every Phaser update tick (for animations that need per-frame updates). */
  update(time: number, delta: number): void;

  /** Clean up all Phaser objects (called when scene shuts down). */
  destroy(): void;
}
```

---

## Step 2 — Create `src/renderer/PhaserRenderer.ts`

Extract **all** Phaser-specific rendering from `BattleScene` into this class.

Key rules:
- `PhaserRenderer` receives `Phaser.Scene` in its constructor (dependency injection).
- It **must not** call `store.dispatch()` — rendering only.
- It **must not** import from `src/state/GameStore.ts` directly.
- It **must** implement every method of `IRenderer`.
- Move `UnitSprite` management here (the `unitSprites: Map<string, UnitSprite>` map).
- Move tile highlight graphics here.
- Move damage/heal floating number display here.

```typescript
import Phaser from 'phaser';
import type { IRenderer, HighlightMode } from './IRenderer';
import type { BattleState } from '@/state/BattleState';
import type { Pos } from '@/data/types/Map';
import { UnitSprite } from '@/sprites/UnitSprite'; // adjust import path if needed
import { TILE_SIZE } from '@/config';

export class PhaserRenderer implements IRenderer {
  private scene: Phaser.Scene;
  private unitSprites: Map<string, UnitSprite> = new Map();
  private highlightLayer: Phaser.GameObjects.Graphics;
  // ... other Phaser Graphics objects

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.highlightLayer = scene.add.graphics();
  }

  renderMap(state: BattleState): void { /* ... */ }
  syncUnits(state: BattleState): void { /* ... */ }
  destroyUnit(unitId: string): void { /* ... */ }
  highlightTiles(tiles: Pos[], mode: HighlightMode): void { /* ... */ }
  clearHighlights(): void { this.highlightLayer.clear(); }
  animateMove(unitId: string, path: Pos[]): Promise<void> { /* Phaser tween */ return Promise.resolve(); }
  animateAttack(attackerId: string, defenderId: string): Promise<void> { /* ... */ return Promise.resolve(); }
  animateSkillCast(casterId: string, skillId: string, targets: Pos[]): Promise<void> { /* ... */ return Promise.resolve(); }
  showDamageNumber(pos: Pos, dmg: number, crit: boolean): void { /* floating text */ }
  showHealNumber(pos: Pos, amount: number): void { /* floating text */ }
  showMissText(pos: Pos): void { /* floating text */ }
  focusTile(pos: Pos): void { /* camera pan */ }
  update(time: number, delta: number): void { /* per-frame sprite updates */ }
  destroy(): void { this.unitSprites.forEach(s => s.destroy()); this.highlightLayer.destroy(); }
}
```

---

## Step 3 — Create `src/input/InputHandler.ts`

Extract all pointer and keyboard event handling from `BattleScene`.

```typescript
import Phaser from 'phaser';
import type { BattleCoordinator } from '@/coordinator/BattleCoordinator';
import { TILE_SIZE } from '@/config';

export class InputHandler {
  private scene: Phaser.Scene;
  private coordinator: BattleCoordinator;

  constructor(scene: Phaser.Scene, coordinator: BattleCoordinator) {
    this.scene = scene;
    this.coordinator = coordinator;
    this.registerPointer();
    this.registerKeyboard();
  }

  private registerPointer(): void {
    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor(ptr.worldX / TILE_SIZE);
      const ty = Math.floor(ptr.worldY / TILE_SIZE);
      this.coordinator.onTileClick(tx, ty);
    });

    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor(ptr.worldX / TILE_SIZE);
      const ty = Math.floor(ptr.worldY / TILE_SIZE);
      this.coordinator.onTileHover(tx, ty);
    });
  }

  private registerKeyboard(): void {
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      this.coordinator.onCancel();
    });
    this.scene.input.keyboard?.on('keydown-Z', () => {
      this.coordinator.onUndo();
    });
  }

  destroy(): void {
    this.scene.input.removeAllListeners();
  }
}
```

---

## Step 4 — Create `src/coordinator/BattleCoordinator.ts`

This replaces the logic currently inside `BattleScene`. It **must not** import from Phaser directly.

```typescript
import { store } from '@/state/GameStore';
import { EventBus } from '@/utils/EventBus';
import { BFS } from '@/systems/movement/BFS';
import { EnemyAI } from '@/systems/ai/EnemyAI';
import { StateQuery } from '@/state/BattleState';
import { MoveAction } from '@/state/actions/MoveAction';
import { AttackAction } from '@/state/actions/AttackAction';
import { WaitAction } from '@/state/actions/WaitAction';
import { SkillAction } from '@/state/actions/SkillAction';
import { UndoHistoryAction } from '@/state/actions/UndoHistoryAction';
import type { IRenderer } from '@/renderer/IRenderer';
import type { BattleState } from '@/state/BattleState';
import type { Pos } from '@/data/types/Map';
import { DamageCalc } from '@/systems/combat/DamageCalc';

export class BattleCoordinator {
  private renderer: IRenderer;

  constructor(renderer: IRenderer) {
    this.renderer = renderer;

    // Subscribe to store changes
    store.subscribe((state) => this.onStateChange(state));

    // Subscribe to EventBus for animation events
    EventBus.on('unitMoved',   e => this.renderer.animateMove(e.unit.instanceId, e.path));
    EventBus.on('unitDamaged', e => this.renderer.showDamageNumber({ x: e.unit.x, y: e.unit.y }, e.dmg, e.crit));
    EventBus.on('unitDefeated', e => this.renderer.destroyUnit(e.unit.instanceId));
    EventBus.on('unitHealed',   e => this.renderer.showHealNumber({ x: e.unit.x, y: e.unit.y }, e.amount));
  }

  // ── Input callbacks (called by InputHandler) ──────────────

  onTileClick(tx: number, ty: number): void {
    const state = store.getState();
    switch (state.phase) {
      case 'PLAYER_IDLE':      return this.handleIdleClick(tx, ty, state);
      case 'MOVE_SELECT':      return this.handleMoveClick(tx, ty, state);
      case 'ACTION_SELECT':    return; // handled by UIScene buttons
      case 'SKILL_SELECT':     return this.handleSkillTargetClick(tx, ty, state);
      default: break;
    }
  }

  onTileHover(tx: number, ty: number): void {
    const state = store.getState();
    if (state.phase !== 'MOVE_SELECT' && state.phase !== 'SKILL_SELECT') return;

    // Combat preview on hover
    const actor = state.selectedUnitId ? StateQuery.unit(state, state.selectedUnitId) : null;
    const target = StateQuery.at(state, tx, ty);
    if (actor && target && target.team !== actor.team) {
      const preview = DamageCalc.preview(actor, target, { mult: 1.0, type: actor.affinity },
        StateQuery.terrain(state, actor.x, actor.y),
        StateQuery.terrain(state, tx, ty));
      EventBus.emit('combatPreview', { preview, target });
    } else {
      EventBus.emit('combatPreview', { preview: null });
    }
  }

  onCancel(): void {
    const state = store.getState();
    if (state.phase === 'MOVE_SELECT' || state.phase === 'ACTION_SELECT') {
      this.cancelAction(state);
    }
  }

  onUndo(): void {
    const state = store.getState();
    const unit = state.selectedUnitId ? StateQuery.unit(state, state.selectedUnitId) : null;
    if (unit?.moved && !unit.acted) {
      store.dispatch(new UndoHistoryAction());
    }
  }

  // ── State change handler ──────────────────────────────────

  private onStateChange(state: BattleState): void {
    this.renderer.syncUnits(state);

    if (state.phase === 'ENEMY_PHASE') {
      this.runEnemyPhase(state);
    }
  }

  // ── Private helpers ───────────────────────────────────────

  private handleIdleClick(tx: number, ty: number, state: BattleState): void {
    const unit = StateQuery.at(state, tx, ty);
    if (unit?.team === 'ally' && !unit.moved) {
      store.setSelectedUnit(unit.instanceId);
      const ctx = store.getBFSContext();
      const tiles = BFS.reachable(unit, ctx);
      this.renderer.highlightTiles(tiles, 'move');
    }
  }

  private handleMoveClick(tx: number, ty: number, state: BattleState): void {
    const unit = StateQuery.unit(state, state.selectedUnitId!);
    if (!unit) return;
    const ctx = store.getBFSContext();
    const path = BFS.findPath({ x: unit.x, y: unit.y }, { x: tx, y: ty }, unit, ctx);
    if (path) {
      this.renderer.clearHighlights();
      store.dispatch(new MoveAction(unit.instanceId, tx, ty, path));
    }
  }

  private handleSkillTargetClick(tx: number, ty: number, state: BattleState): void {
    if (!state.selectedUnitId || !state.activeSkillId) return;
    store.dispatch(new SkillAction(state.selectedUnitId, state.activeSkillId, tx, ty));
    this.renderer.clearHighlights();
  }

  private cancelAction(state: BattleState): void {
    const unit = state.selectedUnitId ? StateQuery.unit(state, state.selectedUnitId) : null;
    if (unit?.moved && !unit.acted && state.stateHistory.length > 0) {
      store.dispatch(new UndoHistoryAction());
    }
    this.renderer.clearHighlights();
    store.clearSelection();
  }

  private async runEnemyPhase(state: BattleState): Promise<void> {
    const enemies = StateQuery.liveEnemies(state);
    for (const enemy of enemies) {
      const actions = EnemyAI.decide(enemy, store.getState());
      for (const action of actions) {
        await store.dispatchAsync(action);
        await new Promise(r => setTimeout(r, 300)); // pacing delay
      }
    }
    store.endEnemyTurn();
  }
}
```

> **Note**: `store.getBFSContext()`, `store.setSelectedUnit()`, `store.clearSelection()`, `store.dispatchAsync()`, `store.endEnemyTurn()` — add these helper methods to `GameStore` as needed.

---

## Step 5 — Slim Down `src/scenes/BattleScene.ts`

After the above extractions, `BattleScene` becomes a thin wiring layer:

```typescript
import Phaser from 'phaser';
import { PhaserRenderer } from '@/renderer/PhaserRenderer';
import { BattleCoordinator } from '@/coordinator/BattleCoordinator';
import { InputHandler } from '@/input/InputHandler';
import { store } from '@/state/GameStore';

export class BattleScene extends Phaser.Scene {
  private renderer!: PhaserRenderer;
  private coordinator!: BattleCoordinator;
  private inputHandler!: InputHandler;

  constructor() { super({ key: 'BattleScene' }); }

  create(): void {
    const mapData = this.registry.get('mapData');
    store.init(mapData);

    this.renderer     = new PhaserRenderer(this);
    this.coordinator  = new BattleCoordinator(this.renderer);
    this.inputHandler = new InputHandler(this, this.coordinator);

    this.renderer.renderMap(store.getState());
    this.renderer.syncUnits(store.getState());

    store.startPlayerTurn();
  }

  update(time: number, delta: number): void {
    this.renderer.update(time, delta);
  }

  shutdown(): void {
    this.inputHandler.destroy();
    this.renderer.destroy();
  }
}
```

---

## Step 6 — Verification

After completing the refactor, run the test suite to confirm no regressions:

```bash
npm run test
```

All existing tests must pass:
- `tests/combat/DamageCalc.test.ts` — 6 tests
- `tests/movement/BFS.test.ts` — 7 tests
- `tests/ai/AIScorer.test.ts` — 2 tests

Also manually verify in the browser (`npm run dev`):
- [ ] Units appear on map
- [ ] Clicking an ally highlights movement tiles
- [ ] Clicking a reachable tile plays the move animation
- [ ] Hovering over an enemy shows the combat preview box
- [ ] ESC key cancels selection; Z key undoes a move
- [ ] Enemy turn runs with movement and attack animations
- [ ] Victory/defeat condition triggers scene transition

---

## File Checklist

| File | Action |
|------|--------|
| `src/renderer/IRenderer.ts` | CREATE |
| `src/renderer/PhaserRenderer.ts` | CREATE (extract from BattleScene) |
| `src/input/InputHandler.ts` | CREATE (extract from BattleScene) |
| `src/coordinator/BattleCoordinator.ts` | CREATE (extract from BattleScene) |
| `src/scenes/BattleScene.ts` | REFACTOR (slim down to wiring only) |
| `src/state/GameStore.ts` | MODIFY (add helper methods if needed) |
| `src/utils/EventBus.ts` | MODIFY if new events needed (e.g. `unitHealed`, `unitDefeated`) |

Do **not** modify:
- Any `tests/` files
- Any `src/assets/data/` JSON files
- `src/systems/` files
- `src/state/actions/` files

---

## Notes

- **Do not break the existing test suite.** All pure-logic systems (`DamageCalc`, `BFS`, `AIScorer`) have no Phaser dependency and must remain unchanged.
- **Async animations**: The `Promise<void>` return type on animation methods is intentional. `BattleCoordinator` uses `await` to sequence animations correctly before dispatching the next action.
- **Future extensibility**: Once `IRenderer` is in place, swapping to a Three.js renderer only requires implementing a new `ThreeRenderer implements IRenderer` class — zero changes to `BattleCoordinator`, `InputHandler`, or any game logic.
