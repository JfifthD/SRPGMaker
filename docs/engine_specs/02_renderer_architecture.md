# Renderer Architecture & Asset Pipeline Spec

SRPG Maker 엔진은 특정 렌더링 프레임워크(Phaser, Three.js 등)에 종속되지 않고, 철저히 데이터 주도형으로 에셋을 로드하고 지형을 구성하기 위한 **Asset DB / Renderer API 명세**를 제공합니다.

## 1. Asset Schema & Dictionary

모든 시각 요소(스프라이트, 타일셋, 파티클, 포트레이트)는 엔진이 부트될 때 고유한 `Asset ID`를 부여받아 딕셔너리에 동적으로 적재되어야 합니다. 로직은 파일 경로가 아닌 오직 이 `Asset ID`만 참조합니다.

```json
{
  "asset_id": "tile_grass_01",
  "type": "SPRITE",
  "source_url": "assets/tiles/grass_01.png",
  "renderer_hints": {
    "pixel_art": true,
    "scale": 1.0,
    "z_index_offset": 0
  }
}
```

## 2. 2.5D Elevation & Map Rendering API

지형의 높낮이와 원근감을 표현하기 위해 엔진은 3D 공간 연산을 벤치마킹한 `MapData` 스키마를 렌더러에 파싱해줍니다.

- **Elevation 매트릭스:** 타일의 위치 정보는 (X, Y)뿐만 아니라 `elevation` Z축 수치를 갖습니다.
- **Dynamic Depth Sorting:** 렌더러 플러그인은 엔진으로부터 전달받은 타일 좌표를 바탕으로 동적으로 렌더링 순서(Z-Index)를 제어해야 합니다.
  - 권장 공식: `Z-Index = (Entity.Y * 100) + (Entity.X * 2) + Elevation_Offset`

## 3. Worker 기반 비동기 계산 (Performance API)

화면에 그려지지 않는 보이지 않는 연산(예: 100마리의 몬스터 길찾기)은 렌더링 프레임을 블록해서는 안 됩니다.

- **Pathfinding Worker:** 엔진은 기본적으로 `PathfindingWorkerClient`를 통해 Web Worker로 연산을 던지는 API를 제공합니다. 모더(Moder)가 독자적인 괴물 AI를 만들더라도 무거운 루프는 `Engine.worker.runAStar(start, end)` API를 호출하여 백그라운드에서 처리해야 합니다.

## 4. Visual Effects (VFX) Injection

스킬 실행 시 폭발 이펙트 등을 렌더링하려면 `GameStore`의 이벤트 버스(`onSkillUsed`)를 구독하는 파티클 렌더러가 필요합니다.

```typescript
// AI(MCP)가 정의할 수 있는 VFX 트리거 매핑
Engine.vfx.register("skill_fireball", {
  particle_id: "vfx_fire_01",
  duration_ms: 800,
  blend_mode: "ADD",
  behavior: "ARC_PROJECTILE", // 곡사포처럼 날아가는 연출 힌트
});
```

위 힌트를 받은 `IRenderer` 구현체(예: PhaserRenderer)는 실제 해당 프레임워크의 파티클 엔진을 가동하여 피드백을 출력합니다.
