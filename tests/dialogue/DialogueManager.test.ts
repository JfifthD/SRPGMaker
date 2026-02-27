// ─────────────────────────────────────────────
//  DialogueManager Unit Tests
//  Tests the pure logic layer: script playback,
//  branching, pause lines, event emission, and
//  the hasTriggered guard.
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DialogueManager } from '@/engine/systems/dialogue/DialogueManager';
import type { IDialogueRenderer } from '@/engine/renderer/IDialogueRenderer';
import type { DialogueScript, DialogueLine } from '@/engine/data/types/Dialogue';
import { EventBus } from '@/engine/utils/EventBus';

// ── Minimal IDialogueRenderer stub ──────────────────────────────────────────

function makeRenderer(): IDialogueRenderer {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    displayLine: vi.fn().mockResolvedValue(undefined),
    skipTypewriter: vi.fn(),
    advance: vi.fn(),
    setBackground: vi.fn(),
    showPortrait: vi.fn(),
    hidePortrait: vi.fn(),
    showChoices: vi.fn().mockResolvedValue(0), // always choose first option
    shake: vi.fn(),
    flash: vi.fn(),
    destroy: vi.fn(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLine(type: DialogueLine['type'], extra: Partial<DialogueLine> = {}): DialogueLine {
  return { type, ...extra };
}

function makeScript(id: string, lines: DialogueLine[], branches?: DialogueScript['branches']): DialogueScript {
  const script: DialogueScript = { id, mode: 'battle_overlay', lines };
  if (branches !== undefined) script.branches = branches;
  return script;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DialogueManager', () => {
  let renderer: IDialogueRenderer;
  let manager: DialogueManager;

  beforeEach(() => {
    EventBus.clear();
    renderer = makeRenderer();
    manager = new DialogueManager(renderer);
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  describe('play()', () => {
    it('shows the renderer and emits dialogueStart at the beginning', async () => {
      const events: any[] = [];
      EventBus.on('dialogueStart', e => events.push(e));

      const script = makeScript('test', [makeLine('end')]);
      manager.registerScript(script);

      await manager.play('test');

      expect(renderer.show).toHaveBeenCalledOnce();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ scriptId: 'test', mode: 'battle_overlay' });
    });

    it('hides the renderer and emits dialogueEnd at the end', async () => {
      const events: any[] = [];
      EventBus.on('dialogueEnd', e => events.push(e));

      const script = makeScript('test', [makeLine('end')]);
      manager.registerScript(script);

      await manager.play('test');

      expect(renderer.hide).toHaveBeenCalledOnce();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ scriptId: 'test' });
    });

    it('warns and returns gracefully if script ID is not found', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await manager.play('missing_script');
      expect(renderer.show).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ── Line Processing ────────────────────────────────────────────────────────

  describe('line types', () => {
    it('calls displayLine for "line" type', async () => {
      const script = makeScript('s', [
        makeLine('line', { speaker: 'kael', text: 'Hello', emotion: 'neutral', side: 'left' }),
        makeLine('end'),
      ]);
      manager.registerScript(script);
      await manager.play('s');

      expect(renderer.displayLine).toHaveBeenCalledOnce();
      expect((renderer.displayLine as any).mock.calls[0][0].speaker).toBe('kael');
    });

    it('calls displayLine for "narration" type', async () => {
      const script = makeScript('s', [
        makeLine('narration', { text: 'Three years passed.' }),
        makeLine('end'),
      ]);
      manager.registerScript(script);
      await manager.play('s');

      expect(renderer.displayLine).toHaveBeenCalledOnce();
    });

    it('emits sfxPlay event for "sfx" type lines', async () => {
      const events: any[] = [];
      EventBus.on('sfxPlay', e => events.push(e));

      const script = makeScript('s', [makeLine('sfx', { key: 'sword_clash' }), makeLine('end')]);
      manager.registerScript(script);
      await manager.play('s');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ key: 'sword_clash' });
    });

    it('emits bgmChange event for "bgm" type lines', async () => {
      const events: any[] = [];
      EventBus.on('bgmChange', e => events.push(e));

      const script = makeScript('s', [makeLine('bgm', { key: 'bgm_battle' }), makeLine('end')]);
      manager.registerScript(script);
      await manager.play('s');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ key: 'bgm_battle' });
    });

    it('calls setBackground for "background" type', async () => {
      const script = makeScript('s', [
        makeLine('background', { backgroundKey: 'bg_castle' }),
        makeLine('end'),
      ]);
      manager.registerScript(script);
      await manager.play('s');

      expect(renderer.setBackground).toHaveBeenCalledWith('bg_castle');
    });

    it('calls shake() for "shake" type', async () => {
      const script = makeScript('s', [makeLine('shake'), makeLine('end')]);
      manager.registerScript(script);
      await manager.play('s');
      expect(renderer.shake).toHaveBeenCalledOnce();
    });

    it('auto-pauses for "pause" type and continues', async () => {
      vi.useFakeTimers();

      const script = makeScript('s', [makeLine('pause', { duration: 200 }), makeLine('end')]);
      manager.registerScript(script);

      const promise = manager.play('s');
      vi.advanceTimersByTime(200);
      await promise;

      expect(renderer.hide).toHaveBeenCalled(); // script completed
      vi.useRealTimers();
    });

    it('terminates on "end" type without executing further lines', async () => {
      const script = makeScript('s', [
        makeLine('end'),
        makeLine('line', { text: 'This should never execute', speaker: 'kael', emotion: 'neutral', side: 'left' }),
      ]);
      manager.registerScript(script);
      await manager.play('s');

      expect(renderer.displayLine).not.toHaveBeenCalled();
    });
  });

  // ── Branching ─────────────────────────────────────────────────────────────

  describe('choice branching', () => {
    it('follows the branch returned by showChoices()', async () => {
      const displayedTexts: string[] = [];
      (renderer.displayLine as any).mockImplementation((line: DialogueLine) => {
        if (line.text) displayedTexts.push(line.text);
        return Promise.resolve();
      });

      // showChoices always returns 0 (first choice) by default
      const script: DialogueScript = {
        id: 'branchy',
        mode: 'battle_overlay',
        lines: [
          {
            type: 'choice',
            choices: [
              { label: 'Option A', next: 'branch_a' },
              { label: 'Option B', next: 'branch_b' },
            ],
          },
        ],
        branches: {
          branch_a: [{ type: 'line', speaker: 'kael', emotion: 'determined', side: 'left', text: 'You chose A.' }, { type: 'end' }],
          branch_b: [{ type: 'line', speaker: 'kael', emotion: 'sad', side: 'left', text: 'You chose B.' }, { type: 'end' }],
        },
      };

      manager.registerScript(script);
      await manager.play('branchy');

      expect(displayedTexts).toContain('You chose A.');
      expect(displayedTexts).not.toContain('You chose B.');
    });
  });

  // ── hasTriggered ──────────────────────────────────────────────────────────

  describe('hasTriggered()', () => {
    it('returns false before the script is played', () => {
      const script = makeScript('once_s', [makeLine('end')]);
      manager.registerScript(script);
      expect(manager.hasTriggered('once_s')).toBe(false);
    });

    it('returns true after the script has been played once', async () => {
      const script = makeScript('once_s', [makeLine('end')]);
      manager.registerScript(script);
      await manager.play('once_s');
      expect(manager.hasTriggered('once_s')).toBe(true);
    });
  });

  // ── Flags ─────────────────────────────────────────────────────────────────

  describe('flags', () => {
    it('setFlag / hasFlag work correctly', () => {
      expect(manager.hasFlag('kael_alive')).toBe(false);
      manager.setFlag('kael_alive');
      expect(manager.hasFlag('kael_alive')).toBe(true);
    });
  });

  // ── isActive ──────────────────────────────────────────────────────────────

  describe('isActive()', () => {
    it('returns false when idle', () => {
      expect(manager.isActive()).toBe(false);
    });
  });
});
