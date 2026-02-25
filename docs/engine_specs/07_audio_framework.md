# Audio Framework & Metadata DB (API Spec)

SRPG Maker 엔진 내에서 사운드트랙(BGM)과 효과음(SFX)을 통합 관리하고, 특정 렌더링 프레임워크나 시각적 씬(Scene)에 종속되지 않은 채로 소리를 제어하는 아키텍처 명세입니다.

## 1. IAudioManager 플러그인 인터페이스

엔진의 로직 파트(GameStore, 전투 코디네이터, AI)는 현재 재생 환경이 브라우저인지 기본 OS인지 알 수 없으므로 오직 아래의 표준화된 인터페이스를 통해서만 소리 재생을 퍼블리시합니다.

```typescript
interface IAudioManager {
  // Asset ID 기반으로 오디오를 스트리밍/재생
  playBGM(assetId: string, options?: { loop?: boolean; fadeMs?: number }): void;
  stopBGM(fadeMs?: number): void;

  // 3D/2.5D 공간 정보를 포함한 효과음 재생
  playSFX(
    assetId: string,
    options?: {
      volume?: number;
      pan?: number;
      worldX?: number;
      worldY?: number;
    },
  ): void;

  setMasterVolume(vol: number): void;
  duckBGM(targetVol: number, durationMs: number): void; // 대화 중 임시로 볼륨 낮춤
}
```

## 2. Audio Asset Schema (Data-Driven DB)

하드코딩된 변수명 대신, 게임 내의 모든 소리는 JSON 기반의 Metadata DB로 로드됩니다. AI(MCP)가 신규 맵을 만들 때 BGM을 지정하려면 오직 `Asset ID` 스키마만 참조하면 됩니다.

```json
{
  "asset_id": "bgm_battle_boss_01",
  "category": "BGM",
  "source_url": "assets/audio/bgm_boss_01.mp3",
  "tags": ["tense", "epic"],
  "default_volume": 0.8,
  "loop_points": { "start_sec": 12.5, "end_sec": 145.2 }
}
```

## 3. Event-Driven Audio Triggers

엔진 내부 로직에서 `playSFX()`를 직접 호출하는 것은 금지됩니다(결합도 상승 방지).
대신 `GameStore`에서 발생하는 도메인 이벤트(`EventBus`)를 `AudioCoordinator`가 구독(Listen)하여 알맞은 사운드 에셋을 재생합니다.

### 3-1. 시스템 내장 트리거 (Built-in Audio Hooks)

메이커에서 RuleSet을 통해 아래 이벤트와 Asset ID를 매핑(Mapping)할 수 있습니다.

- `OnTurnStart`: 턴 개시 시 재생 (예: `sfx_turn_start`)
- `OnUnitDamaged`: 무기 타입과 피격 대상의 아머 타입에 따라 매핑된 소리 (예: 검 vs 판금 -> `sfx_hit_armor`)
- `OnCriticalHit`: 크리티컬 전용 타격음 (예: `sfx_crit_strike`)
- `OnVictory` / `OnDefeat`: 승패 결정 시 BGM 강제 전환

### 3-2. Spatial Audio (공간 음향 연출)

- `playSFX` 호출 시 페이로드에 `worldX, worldY`를 담아 보내면, 구현체(Phaser Sound 등)가 현재 카메라의 중심 좌표를 계산하여 거리에 따른 Volume 감쇠와 좌우 Pan 값을 자동 믹싱하는 옵션을 지원합니다.
