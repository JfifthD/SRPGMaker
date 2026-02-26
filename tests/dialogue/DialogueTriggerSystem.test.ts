// ─────────────────────────────────────────────
//  DialogueTriggerSystem Unit Tests
// ─────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DialogueTriggerSystem } from '@/engine/systems/dialogue/DialogueTriggerSystem';
import { DialogueManager } from '@/engine/systems/dialogue/DialogueManager';
import type { IDialogueRenderer } from '@/engine/renderer/IDialogueRenderer';
import type { DialogueScript } from '@/engine/data/types/Dialogue';
import { EventBus } from '@/engine/utils/EventBus';

// ── Stub renderer ────────────────────────────────────────────────────────────

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
    showChoices: vi.fn().mockResolvedValue(0),
    shake: vi.fn(),
    flash: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeScript(id: string, mode: 'battle_overlay' | 'scenario' = 'battle_overlay'): DialogueScript {
  return { id, mode, lines: [{ type: 'end' }] };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DialogueTriggerSystem', () => {
  let renderer: IDialogueRenderer;
  let manager: DialogueManager;
  let triggers: DialogueTriggerSystem;

  beforeEach(() => {
    EventBus.clear();
    renderer = makeRenderer();
    manager = new DialogueManager(renderer);
    triggers = new DialogueTriggerSystem(manager);
  });

  // ── Basic event matching ───────────────────────────────────────────────────

  it('plays the script when event matches', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'ch01_battle_start', event: 'battle_start', once: false });
    await triggers.evaluate('battle_start');

    expect(playSpy).toHaveBeenCalledWith('ch01_battle_start');
  });

  it('does NOT play when event does not match', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'ch01_battle_start', event: 'battle_start', once: false });
    await triggers.evaluate('battle_end');

    expect(playSpy).not.toHaveBeenCalled();
  });

  // ── once: true ────────────────────────────────────────────────────────────

  it('skips script on second call when once:true and already triggered', async () => {
    manager.registerScript(makeScript('ch01_battle_start'));

    triggers.register({ scriptId: 'ch01_battle_start', event: 'battle_start', once: true });

    // First evaluation — should play
    await triggers.evaluate('battle_start');
    expect(manager.hasTriggered('ch01_battle_start')).toBe(true);

    // Second evaluation — should be skipped
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();
    await triggers.evaluate('battle_start');
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays again when once:false regardless of triggered state', async () => {
    manager.registerScript(makeScript('repeatable'));
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'repeatable', event: 'battle_start', once: false });
    await triggers.evaluate('battle_start');
    await triggers.evaluate('battle_start');

    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  // ── Condition matching ────────────────────────────────────────────────────

  it('skips trigger when unitId does not match', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'on_kael_die', event: 'unit_defeated', once: true, unitId: 'kael' });
    await triggers.evaluate('unit_defeated', { unitId: 'lyra' });

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays trigger when unitId matches', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'on_kael_die', event: 'unit_defeated', once: true, unitId: 'kael' });
    await triggers.evaluate('unit_defeated', { unitId: 'kael' });

    expect(playSpy).toHaveBeenCalledWith('on_kael_die');
  });

  it('skips trigger when turn does not match', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'turn3_event', event: 'turn_start', once: true, turn: 3 });
    await triggers.evaluate('turn_start', { turn: 2 });

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays trigger when turn matches', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'turn3_event', event: 'turn_start', once: true, turn: 3 });
    await triggers.evaluate('turn_start', { turn: 3 });

    expect(playSpy).toHaveBeenCalledWith('turn3_event');
  });

  it('skips trigger when required flag is not set', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.register({ scriptId: 'flagged_scene', event: 'scenario', once: false, flag: 'boss_dead' });
    await triggers.evaluate('scenario');

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays trigger when required flag is set', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();
    manager.setFlag('boss_dead');

    triggers.register({ scriptId: 'flagged_scene', event: 'scenario', once: false, flag: 'boss_dead' });
    await triggers.evaluate('scenario');

    expect(playSpy).toHaveBeenCalledWith('flagged_scene');
  });

  // ── registerAll ───────────────────────────────────────────────────────────

  it('registerAll registers multiple triggers', async () => {
    const playSpy = vi.spyOn(manager, 'play').mockResolvedValue();

    triggers.registerAll([
      { scriptId: 'script_a', event: 'battle_start', once: false },
      { scriptId: 'script_b', event: 'battle_start', once: false },
    ]);
    await triggers.evaluate('battle_start');

    expect(playSpy).toHaveBeenCalledWith('script_a');
    expect(playSpy).toHaveBeenCalledWith('script_b');
  });
});
