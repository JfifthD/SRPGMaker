# Task: Implement Dialogue System

## Context

You are working on **The Chronicle of Shadows** — a TypeScript + Vite + Phaser 3 SRPG.
Project root: `Games/SRPG/TheChronicleOfShadows/`

The dialogue system must support two distinct modes that share the same underlying engine:
- **Scenario Mode**: Full-screen visual novel presentation — character portraits, name plates, typewriter text, branching choices, background art. Used for story scenes, prologue, chapter intros.
- **Battle Dialogue**: In-map overlay that appears before/during combat — quick character lines without pausing battle flow. Used for pre-battle banter, kill quotes, story triggers during maps.

Both modes are driven by the same `DialogueManager` and `DialogueScript` data format.

---

## Architecture Overview

```
src/
  data/types/
    Dialogue.ts               ← All TypeScript types (NEW)
  assets/data/dialogues/
    ch01_prologue.json        ← Scenario script data (NEW, example)
    ch01_battle_start.json    ← Battle dialogue example (NEW)
  systems/dialogue/
    DialogueManager.ts        ← Core orchestrator — plays scripts, manages state (NEW)
    DialogueTrigger.ts        ← Trigger evaluation (map events, battle conditions) (NEW)
  renderer/
    IDialogueRenderer.ts      ← Renderer interface for dialogue visuals (NEW)
    PhaserDialogueRenderer.ts ← Phaser 3 implementation (NEW)
  scenes/
    DialogueScene.ts          ← Full-screen scenario mode scene (NEW)
    BattleScene.ts            ← MODIFY: hook battle dialogue triggers
  utils/
    EventBus.ts               ← MODIFY: add dialogue events to GameEventMap
```

> Note: Dialogue rendering is **separate** from `IRenderer` (which handles battle map rendering).
> `IDialogueRenderer` is its own interface — this keeps concerns clean and allows independent upgrades.

---

## Step 1 — Define `src/data/types/Dialogue.ts`

```typescript
// ── Script Line ────────────────────────────────────────────────────────────

export type PortraitEmotion =
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'determined' | 'wounded' | 'smug' | 'fearful';

export type DialogueLineType =
  | 'line'        // A character speaks
  | 'narration'   // No speaker, centered italic text
  | 'choice'      // Show choice buttons → branches
  | 'wait'        // Wait for tap/click
  | 'pause'       // Auto-pause N milliseconds then continue
  | 'sfx'         // Play a sound effect
  | 'bgm'         // Change background music
  | 'background'  // Change background image
  | 'shake'       // Screen shake
  | 'flash'       // Screen flash
  | 'end';        // Explicit end marker

export interface DialogueLine {
  type: DialogueLineType;

  // For type: 'line'
  speaker?: string;           // character key, e.g. "kael"
  emotion?: PortraitEmotion;  // portrait variant
  side?: 'left' | 'right';    // which side portrait appears on
  text?: string;              // dialogue text (supports \n)

  // For type: 'narration'
  // text field used

  // For type: 'choice'
  choices?: DialogueChoice[];

  // For type: 'pause'
  duration?: number;          // milliseconds

  // For type: 'sfx' | 'bgm'
  key?: string;               // asset key

  // For type: 'background'
  backgroundKey?: string;

  // Voice acting (optional)
  voiceKey?: string;
}

export interface DialogueChoice {
  label: string;
  next: string;               // goto script ID or inline array key
  condition?: string;         // optional: expression to evaluate (e.g. "flag:kael_alive")
}

// ── Script ─────────────────────────────────────────────────────────────────

export interface DialogueScript {
  id: string;                 // unique script ID e.g. "ch01_prologue"
  mode: 'scenario' | 'battle_overlay';
  lines: DialogueLine[];
  branches?: Record<string, DialogueLine[]>; // named branch arrays for choices
}

// ── Trigger ─────────────────────────────────────────────────────────────────

export type TriggerEvent =
  | 'battle_start'
  | 'battle_end'
  | 'unit_defeated'
  | 'turn_start'            // triggers on specific turn number
  | 'map_event'             // triggers when player steps on a tile
  | 'scenario';             // triggered explicitly from game flow

export interface DialogueTrigger {
  scriptId: string;
  event: TriggerEvent;
  once: boolean;            // if true, triggers only the first time

  // Conditions (all optional, all must pass)
  unitId?: string;          // for unit_defeated: which unit
  turn?: number;            // for turn_start: which turn
  tileX?: number;           // for map_event: which tile
  tileY?: number;
  flag?: string;            // arbitrary game flag that must be set
}

// ── Runtime State ────────────────────────────────────────────────────────────

export interface DialogueState {
  active: boolean;
  scriptId: string | null;
  lineIndex: number;
  mode: 'scenario' | 'battle_overlay' | null;
  flags: Set<string>;          // game flags set during dialogue
  triggered: Set<string>;      // scriptIds already triggered (for once:true)
  awaitingChoice: boolean;
}
```

---

## Step 2 — Define `src/renderer/IDialogueRenderer.ts`

```typescript
import type { DialogueLine, PortraitEmotion } from '@/data/types/Dialogue';

export interface IDialogueRenderer {
  // ── Lifecycle ────────────────────────────────────────────
  show(): void;
  hide(): void;

  // ── Line Display ─────────────────────────────────────────
  /** Display a line — typewriter effect, portrait, name plate */
  displayLine(line: DialogueLine): Promise<void>;

  /** Skip typewriter animation, show full text immediately */
  skipTypewriter(): void;

  /** Set background image (scenario mode only) */
  setBackground(key: string | null): void;

  // ── Portrait ─────────────────────────────────────────────
  /** Show/update a character portrait */
  showPortrait(
    characterKey: string,
    emotion: PortraitEmotion,
    side: 'left' | 'right',
    active: boolean,          // dimmed if not the current speaker
  ): void;

  /** Remove a portrait */
  hidePortrait(side: 'left' | 'right'): void;

  // ── Choices ──────────────────────────────────────────────
  /** Render choice buttons, returns index of chosen option */
  showChoices(labels: string[]): Promise<number>;

  // ── Effects ──────────────────────────────────────────────
  shake(intensity?: number): void;
  flash(color?: number, duration?: number): void;

  // ── Cleanup ──────────────────────────────────────────────
  destroy(): void;
}
```

---

## Step 3 — Implement `src/systems/dialogue/DialogueManager.ts`

The manager is the **pure logic** orchestrator. It does **not** import Phaser.

```typescript
import type { IDialogueRenderer } from '@/renderer/IDialogueRenderer';
import type { DialogueScript, DialogueLine, DialogueState } from '@/data/types/Dialogue';
import { EventBus } from '@/utils/EventBus';

export class DialogueManager {
  private renderer: IDialogueRenderer;
  private scripts: Map<string, DialogueScript> = new Map();
  private state: DialogueState = {
    active: false, scriptId: null, lineIndex: 0,
    mode: null, flags: new Set(), triggered: new Set(),
    awaitingChoice: false,
  };

  constructor(renderer: IDialogueRenderer) {
    this.renderer = renderer;
  }

  registerScript(script: DialogueScript): void {
    this.scripts.set(script.id, script);
  }

  async play(scriptId: string): Promise<void> {
    const script = this.scripts.get(scriptId);
    if (!script) throw new Error(`DialogueScript not found: ${scriptId}`);

    this.state.active = true;
    this.state.scriptId = scriptId;
    this.state.lineIndex = 0;
    this.state.mode = script.mode;

    EventBus.emit('dialogueStart', { scriptId, mode: script.mode });
    this.renderer.show();

    await this.playLines(script.lines);

    this.state.active = false;
    this.state.triggered.add(scriptId);
    this.renderer.hide();
    EventBus.emit('dialogueEnd', { scriptId });
  }

  private async playLines(lines: DialogueLine[]): Promise<void> {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      this.state.lineIndex = i;
      await this.processLine(line, lines);
    }
  }

  private async processLine(line: DialogueLine, allLines: DialogueLine[]): Promise<void> {
    switch (line.type) {
      case 'line':
      case 'narration':
        await this.renderer.displayLine(line);
        break;

      case 'choice': {
        if (!line.choices) break;
        const labels = line.choices.map(c => c.label);
        const chosen = await this.renderer.showChoices(labels);
        const branch = line.choices[chosen];
        // Play branch lines if defined inline
        // (Script-level branches handled by DialogueManager via script.branches)
        break;
      }

      case 'pause':
        await new Promise(r => setTimeout(r, line.duration ?? 500));
        break;

      case 'sfx':
        if (line.key) EventBus.emit('sfxPlay', { key: line.key });
        break;

      case 'bgm':
        if (line.key) EventBus.emit('bgmChange', { key: line.key });
        break;

      case 'background':
        if (line.backgroundKey) this.renderer.setBackground(line.backgroundKey);
        break;

      case 'shake':
        this.renderer.shake();
        break;

      case 'flash':
        this.renderer.flash();
        break;

      case 'end':
        // Will terminate the loop naturally on next iteration
        break;
    }
  }

  /** Call this on player tap/click to advance or skip typewriter */
  onAdvance(): void {
    if (!this.state.active) return;
    // DialogueRenderer handles internal skip/advance state
  }

  isActive(): boolean {
    return this.state.active;
  }

  hasTriggered(scriptId: string): boolean {
    return this.state.triggered.has(scriptId);
  }
}
```

---

## Step 4 — Implement `src/systems/dialogue/DialogueTrigger.ts`

```typescript
import type { DialogueTrigger, TriggerEvent } from '@/data/types/Dialogue';
import type { DialogueManager } from './DialogueManager';
import type { BattleState } from '@/state/BattleState';

export class DialogueTriggerSystem {
  private triggers: DialogueTrigger[] = [];
  private manager: DialogueManager;

  constructor(manager: DialogueManager) {
    this.manager = manager;
  }

  register(trigger: DialogueTrigger): void {
    this.triggers.push(trigger);
  }

  async evaluate(event: TriggerEvent, ctx: {
    state?: BattleState;
    unitId?: string;
    turn?: number;
    tileX?: number;
    tileY?: number;
  }): Promise<void> {
    for (const trigger of this.triggers) {
      if (trigger.event !== event) continue;
      if (trigger.once && this.manager.hasTriggered(trigger.scriptId)) continue;

      // Context matching
      if (trigger.unitId && ctx.unitId !== trigger.unitId) continue;
      if (trigger.turn  !== undefined && ctx.turn !== trigger.turn) continue;
      if (trigger.tileX !== undefined && ctx.tileX !== trigger.tileX) continue;
      if (trigger.tileY !== undefined && ctx.tileY !== trigger.tileY) continue;

      await this.manager.play(trigger.scriptId);
    }
  }
}
```

---

## Step 5 — Create `src/scenes/DialogueScene.ts`

Full-screen scenario scene. Pauses `BattleScene` while active.

```typescript
import Phaser from 'phaser';
import { PhaserDialogueRenderer } from '@/renderer/PhaserDialogueRenderer';
import { DialogueManager } from '@/systems/dialogue/DialogueManager';

export class DialogueScene extends Phaser.Scene {
  private dlgRenderer!: PhaserDialogueRenderer;
  private manager!: DialogueManager;

  constructor() { super({ key: 'DialogueScene' }); }

  create(): void {
    const scriptId: string = this.registry.get('dialogueScriptId');
    this.dlgRenderer = new PhaserDialogueRenderer(this, 'scenario');
    this.manager = new DialogueManager(this.dlgRenderer);

    // Load script passed via registry
    const script = this.registry.get('dialogueScript');
    if (script) this.manager.registerScript(script);

    // On tap/click: advance dialogue
    this.input.on('pointerdown', () => this.manager.onAdvance());
    this.input.keyboard?.on('keydown-SPACE', () => this.manager.onAdvance());
    this.input.keyboard?.on('keydown-ENTER', () => this.manager.onAdvance());

    this.manager.play(scriptId).then(() => {
      this.scene.stop();
      this.scene.resume('BattleScene');
    });
  }
}
```

---

## Step 6 — Implement `src/renderer/PhaserDialogueRenderer.ts`

```typescript
import Phaser from 'phaser';
import type { IDialogueRenderer } from './IDialogueRenderer';
import type { DialogueLine, PortraitEmotion } from '@/data/types/Dialogue';

const TYPEWRITER_SPEED_MS = 30; // ms per character

export class PhaserDialogueRenderer implements IDialogueRenderer {
  private scene: Phaser.Scene;
  private mode: 'scenario' | 'battle_overlay';

  // DOM or Phaser GameObjects for the UI
  private container!: Phaser.GameObjects.Container;
  private textBox!: Phaser.GameObjects.Rectangle;
  private nameTag!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private portraitLeft!: Phaser.GameObjects.Image;
  private portraitRight!: Phaser.GameObjects.Image;
  private background!: Phaser.GameObjects.Image | null;
  private advanceArrow!: Phaser.GameObjects.Triangle;

  // Typewriter state
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private typewriterDone = false;
  private typewriterResolve: (() => void) | null = null;

  constructor(scene: Phaser.Scene, mode: 'scenario' | 'battle_overlay') {
    this.scene = scene;
    this.mode = mode;
    this.buildUI();
  }

  private buildUI(): void {
    // Text box at bottom — scenario mode is taller, battle_overlay is minimal
    const boxH = this.mode === 'scenario' ? 200 : 120;
    const { width, height } = this.scene.scale;

    this.textBox = this.scene.add.rectangle(
      width / 2, height - boxH / 2, width - 40, boxH,
      0x000000, 0.82,
    ).setScrollFactor(0).setDepth(100);

    this.nameTag = this.scene.add.text(30, height - boxH - 10, '', {
      fontFamily: 'serif', fontSize: '18px', color: '#ffe4b5',
    }).setScrollFactor(0).setDepth(101);

    this.bodyText = this.scene.add.text(30, height - boxH + 16, '', {
      fontFamily: 'serif', fontSize: '16px', color: '#ffffff',
      wordWrap: { width: width - 80 },
    }).setScrollFactor(0).setDepth(101);

    this.advanceArrow = this.scene.add.triangle(
      width - 30, height - 20, 0, 0, 16, 0, 8, 12, 0xffd700,
    ).setScrollFactor(0).setDepth(102).setVisible(false);

    this.container = this.scene.add.container(0, 0, [
      this.textBox, this.nameTag, this.bodyText, this.advanceArrow,
    ]).setVisible(false);
  }

  show(): void { this.container.setVisible(true); }
  hide(): void { this.container.setVisible(false); this.clearPortraits(); }

  async displayLine(line: DialogueLine): Promise<void> {
    const text = line.text ?? '';
    const speaker = line.speaker ?? '';

    this.nameTag.setText(speaker ? speaker.toUpperCase() : '');
    this.bodyText.setText('');
    this.advanceArrow.setVisible(false);
    this.typewriterDone = false;

    // Update portrait
    if (speaker && line.side && line.emotion) {
      this.showPortrait(speaker, line.emotion, line.side, true);
      const otherSide = line.side === 'left' ? 'right' : 'left';
      const otherPortrait = otherSide === 'left' ? this.portraitLeft : this.portraitRight;
      if (otherPortrait) otherPortrait.setAlpha(0.5);
    }

    // Typewriter effect
    return new Promise<void>(resolve => {
      this.typewriterResolve = resolve;
      let charIndex = 0;
      this.typewriterTimer = this.scene.time.addEvent({
        delay: TYPEWRITER_SPEED_MS,
        repeat: text.length - 1,
        callback: () => {
          charIndex++;
          this.bodyText.setText(text.slice(0, charIndex));
          if (charIndex >= text.length) {
            this.typewriterDone = true;
            this.advanceArrow.setVisible(true);
            // Wait for player advance — resolve happens in onAdvance
          }
        },
      });
      // If typewriter finishes instantly (empty string), resolve right away
      if (text.length === 0) { this.typewriterDone = true; resolve(); }
    });
  }

  skipTypewriter(): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove(false);
      this.typewriterTimer = null;
    }
    // The resolve is called by onAdvance after skip
  }

  // Called by DialogueScene input handler via DialogueManager.onAdvance()
  advance(): void {
    if (!this.typewriterDone) {
      // First tap: skip typewriter
      this.skipTypewriter();
      const fullText = this.bodyText.text; // Show all text immediately
      this.typewriterDone = true;
      this.advanceArrow.setVisible(true);
    } else {
      // Second tap: go to next line
      if (this.typewriterResolve) {
        this.typewriterResolve();
        this.typewriterResolve = null;
      }
    }
  }

  setBackground(key: string | null): void {
    if (this.background) { this.background.destroy(); this.background = null; }
    if (key) {
      this.background = this.scene.add.image(
        this.scene.scale.width / 2, this.scene.scale.height / 2, key,
      ).setScrollFactor(0).setDepth(99);
    }
  }

  showPortrait(
    characterKey: string,
    emotion: PortraitEmotion,
    side: 'left' | 'right',
    active: boolean,
  ): void {
    const textureKey = `portrait_${characterKey}_${emotion}`;
    const x = side === 'left'
      ? 160
      : this.scene.scale.width - 160;
    const y = this.scene.scale.height - 280;

    const existing = side === 'left' ? this.portraitLeft : this.portraitRight;
    if (existing) existing.destroy();

    const img = this.scene.add.image(x, y, textureKey)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(active ? 1 : 0.5);

    if (side === 'left') this.portraitLeft = img;
    else this.portraitRight = img;
  }

  hidePortrait(side: 'left' | 'right'): void {
    if (side === 'left' && this.portraitLeft) { this.portraitLeft.destroy(); }
    if (side === 'right' && this.portraitRight) { this.portraitRight.destroy(); }
  }

  private clearPortraits(): void {
    this.hidePortrait('left'); this.hidePortrait('right');
  }

  async showChoices(labels: string[]): Promise<number> {
    return new Promise(resolve => {
      const { width, height } = this.scene.scale;
      const buttons: Phaser.GameObjects.Text[] = labels.map((label, i) => {
        const btn = this.scene.add.text(
          width / 2, height / 2 - 30 + i * 50, `▶ ${label}`,
          { fontFamily: 'serif', fontSize: '18px', color: '#ffe4b5',
            backgroundColor: '#333', padding: { x: 12, y: 6 } },
        ).setOrigin(0.5).setScrollFactor(0).setDepth(110)
          .setInteractive({ cursor: 'pointer' });

        btn.on('pointerdown', () => {
          buttons.forEach(b => b.destroy());
          resolve(i);
        });
        return btn;
      });
    });
  }

  shake(intensity: number = 8): void {
    this.scene.cameras.main.shake(300, intensity * 0.001);
  }

  flash(color: number = 0xffffff, duration: number = 200): void {
    this.scene.cameras.main.flash(duration, (color >> 16) & 255, (color >> 8) & 255, color & 255);
  }

  destroy(): void {
    this.container.destroy();
    this.background?.destroy();
  }
}
```

---

## Step 7 — Update `src/utils/EventBus.ts`

Add dialogue events to `GameEventMap`:

```typescript
// Add to GameEventMap:
dialogueStart:  { scriptId: string; mode: 'scenario' | 'battle_overlay' };
dialogueEnd:    { scriptId: string };
dialogueLine:   { lineIndex: number; speaker?: string };
sfxPlay:        { key: string };
bgmChange:      { key: string };
```

---

## Step 8 — Example Script JSON

### `src/assets/data/dialogues/ch01_prologue.json`

```json
{
  "id": "ch01_prologue",
  "mode": "scenario",
  "lines": [
    { "type": "background", "backgroundKey": "bg_castle_night" },
    { "type": "bgm", "key": "bgm_prologue" },
    { "type": "narration", "text": "The kingdom of Aldora. Three years after the Shadow War." },
    { "type": "pause", "duration": 1000 },
    {
      "type": "line",
      "speaker": "kael",
      "emotion": "determined",
      "side": "left",
      "text": "Serra. We move at dawn. The border scouts haven't reported back."
    },
    {
      "type": "line",
      "speaker": "serra",
      "emotion": "worried",
      "side": "right",
      "text": "This silence... it's not natural. Something is blocking communications."
    },
    {
      "type": "choice",
      "text": "How do you want to proceed?",
      "choices": [
        { "label": "Push forward immediately", "next": "branch_aggressive" },
        { "label": "Wait for more information", "next": "branch_cautious" }
      ]
    }
  ],
  "branches": {
    "branch_aggressive": [
      {
        "type": "line", "speaker": "kael", "emotion": "determined", "side": "left",
        "text": "We can't afford to wait. Every hour we delay, more lives are at risk."
      },
      { "type": "end" }
    ],
    "branch_cautious": [
      {
        "type": "line", "speaker": "kael", "emotion": "neutral", "side": "left",
        "text": "You're right. Rushing in blind would be reckless."
      },
      { "type": "end" }
    ]
  }
}
```

### `src/assets/data/dialogues/ch01_battle_start.json`

```json
{
  "id": "ch01_battle_start",
  "mode": "battle_overlay",
  "lines": [
    {
      "type": "line",
      "speaker": "kael",
      "emotion": "angry",
      "side": "left",
      "text": "Shadow soldiers — they're already here!"
    },
    {
      "type": "line",
      "speaker": "lyra",
      "emotion": "determined",
      "side": "right",
      "text": "Spread out! Don't let them corner us!"
    },
    { "type": "end" }
  ]
}
```

---

## Step 9 — BattleScene Integration

In `BattleScene.create()` or `BattleCoordinator`, set up triggers:

```typescript
// After store.init(mapData):
const dlgRenderer = new PhaserDialogueRenderer(this, 'battle_overlay');
const dlgManager = new DialogueManager(dlgRenderer);
const dlgTriggers = new DialogueTriggerSystem(dlgManager);

// Load scripts for this map
const mapDialogues: DialogueScript[] = this.cache.json.get('ch01_dialogues');
mapDialogues.forEach(s => dlgManager.registerScript(s));

// Register triggers
dlgTriggers.register({
  scriptId: 'ch01_battle_start',
  event: 'battle_start',
  once: true,
});

// Fire on battle start
await dlgTriggers.evaluate('battle_start', { state: store.getState() });
```

---

## Required Assets

Each character needs portrait textures in `src/assets/images/portraits/`:

```
portraits/
  kael_neutral.png   kael_determined.png  kael_angry.png  kael_happy.png
  lyra_neutral.png   lyra_determined.png  lyra_happy.png  lyra_smug.png
  zara_neutral.png   zara_happy.png       zara_surprised.png
  serra_neutral.png  serra_worried.png    serra_sad.png   serra_happy.png
```

Loaded in `BootScene.ts`:
```typescript
// Portrait textures — naming convention: portrait_{character}_{emotion}
['kael', 'lyra', 'zara', 'serra'].forEach(char => {
  ['neutral','determined','angry','happy','sad','worried','surprised','smug'].forEach(emotion => {
    const key = `portrait_${char}_${emotion}`;
    this.load.image(key, `assets/images/portraits/${char}_${emotion}.png`);
  });
});
```

---

## File Checklist

| File | Action |
|------|--------|
| `src/data/types/Dialogue.ts` | CREATE |
| `src/renderer/IDialogueRenderer.ts` | CREATE |
| `src/renderer/PhaserDialogueRenderer.ts` | CREATE |
| `src/systems/dialogue/DialogueManager.ts` | CREATE |
| `src/systems/dialogue/DialogueTrigger.ts` | CREATE |
| `src/scenes/DialogueScene.ts` | CREATE |
| `src/utils/EventBus.ts` | MODIFY (add dialogue events) |
| `src/scenes/BattleScene.ts` | MODIFY (hook dialogue triggers) |
| `src/scenes/BootScene.ts` | MODIFY (preload portrait textures) |
| `src/assets/data/dialogues/ch01_prologue.json` | CREATE (example) |
| `src/assets/data/dialogues/ch01_battle_start.json` | CREATE (example) |

---

## Notes

- **`IDialogueRenderer` is separate from `IRenderer`** — battle rendering and dialogue rendering are independent subsystems. This allows independent upgrades (e.g. switching dialogue to a DOM/React overlay while keeping the battle renderer on Phaser).
- **Game logic stays clean**: `DialogueManager`, `DialogueTriggerSystem`, `BattleCoordinator` — none of them import from Phaser. Phaser only exists in `PhaserDialogueRenderer` and `DialogueScene`.
- **Typewriter UX**: First tap skips animation to show full text; second tap advances to next line. This is the industry-standard two-tap feel from Fire Emblem/Tactics Ogre.
- **Branching**: `choice` lines can branch to inline `branches` arrays or separate script IDs. Choices can have conditions (game flag checks) for locked/hidden options.
- **Asset naming convention**: `portrait_{character}_{emotion}.png` — this convention is baked into `PhaserDialogueRenderer` and should be followed when generating assets.
