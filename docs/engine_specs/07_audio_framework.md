# Audio Framework (Engine Spec 07) — ✅ Implemented

Data-driven audio system for SRPGMaker. Game creators configure all audio via `audio.json` — no code changes needed.

---

## 1. Architecture Overview

```
audio.json (data)  ──→  AudioConfig types  ──→  AudioCoordinator (logic)
                                                      │
                                                      ├─→ EventBus (subscribe)
                                                      └─→ IAudioManager (interface)
                                                              │
                                              ┌───────────────┼───────────────┐
                                     PhaserAudioManager   NullAudioManager
                                        (runtime)          (headless test)
```

## 2. IAudioManager Interface

`src/engine/renderer/IAudioManager.ts`

```typescript
interface IAudioManager {
  playBGM(assetId: string, options?: { loop?: boolean; fadeMs?: number; volume?: number }): void;
  stopBGM(fadeMs?: number): void;
  playSFX(assetId: string, options?: { volume?: number }): void;
  setMasterVolume(vol: number): void;
  duckBGM(targetVol: number, durationMs: number): void;
  unduckBGM(durationMs: number): void;
  getCurrentBGM(): string | null;
  destroy(): void;
}
```

Implementations:
- **PhaserAudioManager** (`src/engine/renderer/PhaserAudioManager.ts`) — Phaser `scene.sound` wrapper with crossfade, ducking via tweens.
- **NullAudioManager** (`src/engine/renderer/NullAudioManager.ts`) — No-op stub for headless tests.

## 3. Audio Data Types

`src/engine/data/types/Audio.ts`

| Type | Description |
|------|-------------|
| `AudioEntry` | Single audio asset: `{ id, category, file, defaultVolume?, loop?, tags? }` |
| `AudioEventMap` | Maps EventBus events to SFX asset IDs |
| `BGMFlowMap` | Scene-level BGM assignments: `{ title?, battle?, victory?, defeat?, camp? }` |
| `AudioConfig` | Top-level schema: `{ entries, eventMap, bgmFlow }` |

## 4. audio.json Schema (Game Creator Config)

`games/<game-id>/data/audio.json`

```json
{
  "entries": {
    "bgm_battle_01": { "id": "bgm_battle_01", "category": "bgm", "file": "bgm/battle_01.mp3", "defaultVolume": 0.8, "loop": true },
    "sfx_hit_phys":  { "id": "sfx_hit_phys",  "category": "sfx", "file": "sfx/hit_phys.mp3",  "defaultVolume": 0.7 }
  },
  "eventMap": {
    "onUnitDamaged": "sfx_hit_phys",
    "onCriticalHit": "sfx_crit",
    "onUnitHealed":  "sfx_heal"
  },
  "bgmFlow": {
    "title":   "bgm_title",
    "battle":  "bgm_battle_01",
    "victory": "bgm_victory",
    "defeat":  "bgm_defeat"
  }
}
```

### EventMap Keys

| Key | Trigger Event |
|-----|---------------|
| `onUnitMoved` | Unit movement completed |
| `onUnitDamaged` | Non-critical damage |
| `onCriticalHit` | Critical hit |
| `onUnitHealed` | HP restored |
| `onUnitDefeated` | Unit HP reaches 0 |
| `onBuffApplied` | Stat buff applied |
| `onDebuffApplied` | Stat debuff applied |
| `onSkillCast` | Skill activation |
| `onTurnStart` | Player phase start |
| `onEnemyPhase` | Enemy phase start |
| `onVictory` | Stage cleared |
| `onDefeat` | Party wiped |
| `onMenuOpen` | Ring menu opened |

## 5. AudioCoordinator

`src/engine/coordinator/AudioCoordinator.ts`

- Subscribes to EventBus events → routes to IAudioManager via AudioConfig eventMap.
- No Phaser imports — follows BattleCoordinator pattern.
- Per-scene lifecycle: created in scene `create()`, destroyed on `shutdown`.
- Handles dialogue ducking: `dialogueStart` → duckBGM, `dialogueEnd` → unduckBGM.
- Pass-through for dialogue events: `sfxPlay` and `bgmChange` from DialogueManager.

## 6. Per-Map BGM Override

`MapData.bgmId?: string` — set in a map's JSON to override the default battle BGM.

```json
{ "id": "stage_boss", "bgmId": "bgm_battle_boss_01", ... }
```

BattleScene resolves: `mapData.bgmId ?? audioConfig.bgmFlow.battle`.

## 7. Scene Integration

| Scene | Audio Behavior |
|-------|---------------|
| **BootScene** | Preloads all audio entries from `audio.json` |
| **TitleScene** | Plays `bgmFlow.title` |
| **BattleScene** | Creates AudioCoordinator, plays `mapData.bgmId ?? bgmFlow.battle` |
| **ResultScene** | Plays `bgmFlow.victory` or `bgmFlow.defeat` |

## 8. VFXManager Decoupling

VFXManager no longer calls `this.scene.sound.play()` directly. Instead emits `EventBus.emit('sfxPlay', { key })` which AudioCoordinator picks up.

## 9. File Paths

| File | Role |
|------|------|
| `src/engine/data/types/Audio.ts` | Type definitions |
| `src/engine/renderer/IAudioManager.ts` | Interface |
| `src/engine/renderer/NullAudioManager.ts` | Headless stub |
| `src/engine/renderer/PhaserAudioManager.ts` | Phaser implementation |
| `src/engine/coordinator/AudioCoordinator.ts` | Event→audio routing |
| `games/chronicle-of-shadows/data/audio.json` | Sample game audio config |
| `tests/audio/AudioCoordinator.test.ts` | 23 tests |

## 10. Future (Not Yet Implemented)

- **Spatial Audio**: distance-based volume attenuation + pan from camera center.
- **Loop Points**: BGM loop start/end offsets for seamless looping.
- **Audio Pools**: Pre-allocated SFX instances for rapid repeated sounds.
