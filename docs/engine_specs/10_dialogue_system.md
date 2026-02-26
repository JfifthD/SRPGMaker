# Dialogue System Architecture

The dialogue system handles both in-battle banter (overlays) and full-screen story scenes (Visual Novel style). It is designed to be fully data-driven via JSON scripts, decoupling the pure logic from the Phaser 3 presentation layer.

## Core Principles

1. **Renderer Agnostic:** The core `DialogueManager` depends only on the `IDialogueRenderer` interface. None of the logic in `src/engine/systems/dialogue/` imports Phaser.
2. **Data-Driven:** All conversations, character portraits, choices, and branching logic are defined in `src/assets/data/dialogues/*.json`.
3. **Trigger-Based:** Dialogues can be fired implicitly via `DialogueTriggerSystem` reacting to `EventBus` events (like `battle_start`), or explicitly launched via `DialogueScene`.

## File Structure

```
src/engine/data/types/Dialogue.ts               # Core Type Definitions
src/engine/systems/dialogue/DialogueManager.ts  # Playback orchestrator
src/engine/systems/dialogue/DialogueTriggerSystem.ts # Event listener
src/engine/renderer/IDialogueRenderer.ts        # Interface

src/engine/renderer/PhaserDialogueRenderer.ts   # Phaser implementation
src/scenes/DialogueScene.ts                     # Full-screen VN mode scene
src/assets/data/dialogues/*.json                # Script data
```

## Modes

- `scenario`: Full-screen Visual Novel presentation with background images, larger portraits, and taller text boxes. Uses `DialogueScene` which pauses `BattleScene`.
- `battle_overlay`: Minimal UI that renders on top of the map. Does not pause `BattleScene`. Perfect for mid-combat banter or kill quotes.

## Typewriter Effect & Two-Tap Advance

To replicate classic tactics games (Fire Emblem, Tactics Ogre), the system implements a strict two-tap interaction model:

1. Text types out character by character (`TYPEWRITER_MS_PER_CHAR`).
2. **First Tap:** Instantly skips the typewriter animation and shows the full line.
3. **Second Tap:** Advances to the next line in the script.

## Integration in BattleScene

`DialogueTriggerSystem` is instantiated inside `BattleScene`. It listens for game events dynamically. By default, any loaded script with `mode: 'battle_overlay'` automatically registers a `once: true` trigger for the `battle_start` event, ensuring pre-battle banter plays immediately when the map loads and before the first turn begins.

## Script Format Example

```json
{
  "id": "ch01_battle_start",
  "mode": "battle_overlay",
  "lines": [
    {
      "type": "line",
      "speaker": "kael",
      "emotion": "determined",
      "side": "left",
      "text": "We push through. For Aldora."
    },
    { "type": "end" }
  ]
}
```
