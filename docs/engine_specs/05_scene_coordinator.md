# Scene Hierarchy & Coordinator (Headless Simulator Spec)

SRPG Maker 엔진은 전통적인 게임 클라이언트 런타임뿐만 아니라, AI(MCP)나 개발자가 밸런스 검증을 위해 UI 없이 짧은 시간 안에 수만 번의 전투를 돌려볼 수 있는 **Headless Simulator Mode**를 네이티브로 지원합니다.

기존의 `BattleScene`(Phaser 등 특정 엔진 종속 객체)은 단순한 뷰어(Viewer) 껍데기로 남으며, 메인 로직 제어는 순수 TypeScript 클래스인 `BattleCoordinator`와 `IRenderer` 추상화 계층이 전담합니다.

## 1. Headless vs Client Architecture

```text
[ Headless Mode (AI/CLI) ]           [ Client Mode (Web/App) ]
      SimulatorRunner                        BootScene/Menu
            │                                    │
            ▼                                    ▼
    BattleCoordinator                    BattleScene(Phaser)
            │                                    │
    ┌───────┴────────┐                   ┌───────┴────────┐
    ▼                ▼                   ▼                ▼
GameStore       NullRenderer         GameStore      PhaserRenderer
 (State)       (No-op Display)        (State)      (Canvas Render)
```

엔진 로직(`GameStore`, `Systems`, `TurnManager`)은 자신이 어떤 환경에서 배치되어 돌고 있는지 전혀 모릅니다. 단지 상태를 변경하고, `IRenderer` 인터페이스 구현체에게 메시지 형태의 렌더 콜백을 던질 뿐입니다.

## 2. BattleCoordinator (엔진 메인 컨트롤러)

`BattleCoordinator`는 특정 렌더러에 종속되지 않고 엔진의 생명주기(Lifecycle)와 외부 입력/이벤트를 조율하는 최상위 파사드(Facade) 모듈입니다.

### 모드별 동작 분기:

- **AI Simulator 모드:** 휴먼 인터페이스(마우스/키보드) 바인딩 로직을 생략하고, `EnemyAI` (혹은 AutoPlay AI) 구현체에게 양 진영의 조종 권한을 모두 넘겨 루프를 가속 구동합니다.
- **Client Play 모드:** 휴먼 마우스/터치 입력(월드 좌표)을 논리 Grid 타일 좌표(tx, ty)로 변환하여 내부 Store로 `Action` 객체를 Dispatch 합니다.

## 3. IRenderer Interface (Viewer Plugin API)

메이커에서 "2D 픽셀 뷰어", "3D 뷰어", "웹 기반 텍스트 브라우저 뷰어" 등을 자유롭게 갈아끼울 수 있도록 강제하는 명세입니다.

```typescript
interface IRenderer {
  // 초기화 및 동기화
  renderMap(state: BattleState): Promise<void>;
  syncUnits(state: BattleState): void;

  // 시각적 UX 피드백 (하이라이팅)
  highlightTiles(tiles: { x: number; y: number }[], color: string): void;
  clearHighlights(): void;
  showDamagePreview(attacker: UnitInstance, defender: UnitInstance): void;

  // 애니메이션 제어 (비동기 처리 필수)
  playMoveAnimation(unitId: string, path: Pos[]): Promise<void>;
  playAttackAnimation(attackerId: string, defenderId: string): Promise<void>;
  playSkillAnimation(
    casterId: string,
    skillId: string,
    targetIds: string[],
  ): Promise<void>;

  // 프레임 라이프사이클 훅
  update(time: number, delta: number): void;
  destroy(): void;
}
```

- **Promise 연동 아키텍처:** 공격 애니메이션이나 이동 연출이 끝날 때까지 상태 머신이 대기(Busy)할 수 있도록, 렌더링 메소드들은 `Promise`를 반환해야 합니다.
- **NullRenderer의 이점:** Headless 모드 시 주입되는 `NullRenderer`는 위 메소드 호출 시 즉시 0ms 만에 `resolve` 된 Promise를 반환하므로, 프레임 지연 없이 즉각적으로 다음 턴 연산을 수행할 수 있습니다.

## 4. Input & Event Hook 개방

`InputHandler` 구조를 `IInputProvider` 형태로 추상화합니다. 메이커 사용자가 UI 버튼을 새로 만들었을 때, `IInputProvider.emitAction()` 을 호출하는 것만으로 엔진 코어에 즉각 커스텀 명령을 내릴 수 있는 확정된 인터페이스입니다.
