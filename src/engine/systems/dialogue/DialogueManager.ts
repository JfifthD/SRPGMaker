// ─────────────────────────────────────────────
//  DialogueManager
//  Pure logic orchestrator for dialogue playback.
//  NO Phaser import — Phaser lives in IDialogueRenderer impl.
//
//  Responsibilities:
//  - Register + store DialogueScripts
//  - Play scripts line by line, handling all line types
//  - Emit EventBus events (dialogueStart, dialogueEnd, sfxPlay, bgmChange)
//  - Branch resolution on 'choice' lines
//  - Track which scripts have already been triggered (for once:true)
// ─────────────────────────────────────────────

import type { IDialogueRenderer } from '@/engine/renderer/IDialogueRenderer';
import type {
  DialogueScript,
  DialogueLine,
  DialogueState,
} from '@/engine/data/types/Dialogue';
import { EventBus } from '@/engine/utils/EventBus';

export class DialogueManager {
  private renderer: IDialogueRenderer;
  private scripts: Map<string, DialogueScript> = new Map();
  private state: DialogueState = {
    active: false,
    scriptId: null,
    lineIndex: 0,
    mode: null,
    flags: new Set(),
    triggered: new Set(),
    awaitingChoice: false,
  };

  constructor(renderer: IDialogueRenderer) {
    this.renderer = renderer;
  }

  // ── Script Registration ────────────────────────────────────

  registerScript(script: DialogueScript): void {
    this.scripts.set(script.id, script);
  }

  registerScripts(scripts: DialogueScript[]): void {
    for (const s of scripts) this.registerScript(s);
  }

  // ── Playback ──────────────────────────────────────────────

  async play(scriptId: string): Promise<void> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      console.warn(`[DialogueManager] Script not found: ${scriptId}`);
      return;
    }

    this.state.active = true;
    this.state.scriptId = scriptId;
    this.state.lineIndex = 0;
    this.state.mode = script.mode;
    this.state.awaitingChoice = false;

    EventBus.emit('dialogueStart', { scriptId, mode: script.mode });
    this.renderer.show();

    await this.playLines(script.lines, script);

    this.state.active = false;
    this.state.triggered.add(scriptId);
    this.renderer.hide();
    EventBus.emit('dialogueEnd', { scriptId });
  }

  private async playLines(lines: DialogueLine[], script: DialogueScript): Promise<void> {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      this.state.lineIndex = i;

      const branchKey = await this.processLine(line);

      // 'choice' lines return the branch key to follow
      if (branchKey && script.branches?.[branchKey]) {
        await this.playLines(script.branches[branchKey]!, script);
        return; // Branch handles the rest of playback
      }

      // 'end' type terminates the loop immediately
      if (line.type === 'end') return;
    }
  }

  /**
   * Process a single line. Returns a branch key for 'choice' lines,
   * or undefined for all other types.
   */
  private async processLine(line: DialogueLine): Promise<string | undefined> {
    switch (line.type) {
      case 'line':
      case 'narration':
        await this.renderer.displayLine(line);
        return undefined;

      case 'choice': {
        if (!line.choices || line.choices.length === 0) return undefined;
        this.state.awaitingChoice = true;
        const labels = line.choices.map(c => c.label);
        const chosen = await this.renderer.showChoices(labels);
        this.state.awaitingChoice = false;
        return line.choices[chosen]?.next;
      }

      case 'wait':
        // 'wait' is resolved by the next advance() call from the scene
        // In practice, displayLine handles the "wait for advance" pattern,
        // so this is a no-op line type for the manager.
        return undefined;

      case 'pause':
        await new Promise<void>(r => setTimeout(r, line.duration ?? 500));
        return undefined;

      case 'sfx':
        if (line.key) EventBus.emit('sfxPlay', { key: line.key });
        return undefined;

      case 'bgm':
        if (line.key) EventBus.emit('bgmChange', { key: line.key });
        return undefined;

      case 'background':
        if (line.backgroundKey) this.renderer.setBackground(line.backgroundKey);
        return undefined;

      case 'shake':
        this.renderer.shake();
        return undefined;

      case 'flash':
        this.renderer.flash();
        return undefined;

      case 'end':
        return undefined; // Handled by playLines loop check

      default:
        return undefined;
    }
  }

  // ── Player Input ──────────────────────────────────────────

  /**
   * Called on player tap/click/keypress.
   * Delegates to renderer's advance() — it handles the two-tap pattern:
   *   1st tap → skip typewriter
   *   2nd tap → go to next line
   */
  onAdvance(): void {
    if (!this.state.active || this.state.awaitingChoice) return;
    this.renderer.advance();
  }

  // ── State Queries ─────────────────────────────────────────

  isActive(): boolean {
    return this.state.active;
  }

  hasTriggered(scriptId: string): boolean {
    return this.state.triggered.has(scriptId);
  }

  getMode(): 'scenario' | 'battle_overlay' | null {
    return this.state.mode;
  }

  /** Set a game flag (used by choice conditions in future). */
  setFlag(flag: string): void {
    this.state.flags.add(flag);
  }

  hasFlag(flag: string): boolean {
    return this.state.flags.has(flag);
  }
}
