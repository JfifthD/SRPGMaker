# Engine Spec: VFX, Camera & Minimap

> Target: Visual polish systems

## 1. Particle VFX System

### 1.1 설계 원칙

Phaser 3의 `ParticleEmitter`를 래핑하는 `VFXManager`를 만들어, 스킬/공격 이펙트를 데이터 기반으로 재생합니다.

```typescript
export interface VFXConfig {
  id: string; // "slash_fire", "heal_sparkle"
  emitterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
  duration: number; // ms
  followTarget?: boolean; // 유닛 따라가기
  screenShake?: { intensity: number; duration: number };
}
```

### 1.2 `VFXManager.ts`

- `play(vfxId, x, y): Promise<void>` — 지정 좌표에 VFX 재생
- `playOnUnit(vfxId, unit): Promise<void>` — 유닛 위치 추적
- `preload(scene)` — 파티클 텍스처 사전 로드

### 1.3 스킬 연동

`SkillData`에 `vfxId?: string` 필드 추가. `BattleCoordinator`가 스킬 실행 시 `VFXManager.play()` 호출.

## 2. Camera System

### 2.1 팬 & 줌

```typescript
export class CameraController {
  // 마우스 드래그 팬
  enableDragPan(scene): void;
  // 마우스 휠 줌 (0.5x ~ 2.0x)
  enableWheelZoom(scene, min?, max?): void;
  // 유닛 포커스 (AI 턴 시)
  panToUnit(unit, duration?): Promise<void>;
  // 맵 경계 제한
  setBounds(mapWidth, mapHeight): void;
}
```

### 2.2 구현 위치

`src/engine/input/CameraController.ts` — `BattleScene.create()`에서 초기화.

## 3. Minimap

### 3.1 설계

별도 Phaser `RenderTexture`에 맵 축소본 + 유닛 마커를 그립니다.

```typescript
export class MinimapDisplay {
  // 우하단 120x120px 크기 미니맵
  constructor(scene, mapWidth, mapHeight);
  // 매 프레임 유닛 위치 동기화
  update(state: BattleState): void;
  // 클릭 시 카메라 이동
  enableClickNavigation(): void;
}
```

### 3.2 유닛 마커

- 아군: 🟦 파란 점
- 적군: 🟥 빨간 점
- 선택 유닛: ⬜ 흰 점 (깜빡임)
- 카메라 뷰포트: 반투명 사각형

### 3.3 구현 위치

`src/ui/MinimapDisplay.ts` — `UIScene`에서 렌더링.
