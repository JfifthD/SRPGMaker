// ─────────────────────────────────────────────
//  IDialogueRenderer — Dialogue Renderer Interface
//  Mirrors the IRenderer pattern: pure TS interface,
//  no Phaser import. PhaserDialogueRenderer implements this.
//
//  Separate from IRenderer (battle map rendering) —
//  concerns are intentionally isolated.
// ─────────────────────────────────────────────

import type { DialogueLine, PortraitEmotion } from '@/engine/data/types/Dialogue';

export interface IDialogueRenderer {
  // ── Lifecycle ────────────────────────────────────────────────
  /** Make the dialogue UI visible. */
  show(): void;

  /** Hide the dialogue UI and clear portraits. */
  hide(): void;

  // ── Line Display ─────────────────────────────────────────────
  /**
   * Display a single dialogue line with typewriter effect.
   * Resolves when the player advances past this line.
   */
  displayLine(line: DialogueLine): Promise<void>;

  /**
   * Skip the typewriter animation — show full text immediately.
   * Called on first tap/advance while typewriter is still running.
   */
  skipTypewriter(): void;

  /**
   * Called on each player advance (tap / SPACE / ENTER).
   * - If typewriter running: skip to full text.
   * - If typewriter done: resolve the current line and advance.
   */
  advance(): void;

  /** Change the background image (scenario mode only). */
  setBackground(key: string | null): void;

  // ── Portrait ─────────────────────────────────────────────────
  /** Show or update a character portrait on the given side. */
  showPortrait(
    characterKey: string,
    emotion: PortraitEmotion,
    side: 'left' | 'right',
    active: boolean,           // false → dimmed (not current speaker)
  ): void;

  /** Remove a portrait from the given side. */
  hidePortrait(side: 'left' | 'right'): void;

  // ── Choices ──────────────────────────────────────────────────
  /**
   * Render choice buttons. Returns the zero-based index of the player's choice.
   */
  showChoices(labels: string[]): Promise<number>;

  // ── Effects ──────────────────────────────────────────────────
  shake(intensity?: number): void;
  flash(color?: number, duration?: number): void;

  // ── Cleanup ──────────────────────────────────────────────────
  destroy(): void;
}
