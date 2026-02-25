# UI Action Menu & Payload Framework (API Spec)

SRPG Maker 엔진에서 전투 중 활성 유닛의 "액션 메뉴(Ring Menu, List Menu 등)"를 생성하고 통제하는 방식에 대한 명세입니다.

엔진은 고정된 형태의 UI 하드코딩 버튼(Move, Attack, Magic)을 렌더링하지 않습니다. 대신, `GameStore`에서 현재 유닛이 **수행 가능한 행동의 JSON Payload 배열**만을 추출하여 UI 계층(React, Vue, Phaser DOM 등)으로 전달합니다.

---

## 1. Data-Driven Menu Generation (데이터 주도형 메뉴 생성)

유닛(UnitInstance)이 선택되었을 때, `BattleCoordinator`는 내장된 기본 컴포넌트와 유닛이 가진 플러그인(`EffectNode`)을 모두 스캔하여 `ActionMenuItem[]` 배열을 생성합니다.

```typescript
interface ActionMenuItem {
  command_id: string; // 고유 명령 ID (예: 'basic_attack', 'cast_fireball', 'talk')
  display_name: string; // UI에 출력될 텍스트 또는 아이콘 키 (i18n 용)
  icon_key: string; // Asset DB에 매핑되는 아이콘 스프라이트 명
  category: "PRIMARY" | "SKILL" | "ITEM" | "SYSTEM";
  cost: {
    // UI에서 흐리게 처리(Disable)하거나 미리 보여줄 비용 정보
    ap: number;
    mp: number;
    hp?: number;
  };
  is_enabled: boolean; // 현재 상태에서 실행 가능한지 여부 (자원 부족 시 false)
  payload_schema: any; // 이 명령을 실행하기 위해 UI가 유저에게 추가로 받아야 할 입력값 스키마
}
```

### 1-1. Payload Schema 기반의 동적 UI 전이

만약 어떤 모더(Moder)가 "아이템 훔치기(Steal)" 라는 새로운 커맨드를 플러그인으로 추가했다면, UI 코드를 고치지 않아도 됩니다.

1. `BattleCoordinator` 상의 메뉴 제네레이터가 유닛의 특성을 읽어 `ActionMenuItem` (command_id: 'steal')을 생성합니다.
2. 유저가 '훔치기' 버튼을 클릭하면, UI는 `payload_schema`에 명시된 대로 **"타겟 지정(Targeting)"** 페이즈로 전환되어 적 대상을 고르도록 유도합니다.
3. 대상이 클릭되면, UI는 `{ action: 'steal', targetId: 'enemy_1' }` 형태의 객체를 조립하여 다시 `Coordinator.dispatch()` 로 던집니다.

---

## 2. 기본 내장 커맨드 (Core Commands)

엔진이 기본적으로 제공하는 최소한의 커맨드 세트입니다. (이들 역시 필요시 RuleSet을 통해 비활성화할 수 있습니다)

| Command ID     | Display | Category | Payload 요구사항 (HCI 전이)                                               |
| -------------- | ------- | -------- | ------------------------------------------------------------------------- |
| `cmd_move`     | 이동    | PRIMARY  | `TileCoordinate {x, y}` (보통 메뉴 없이 이동 범위를 직접 클릭하여 대체됨) |
| `cmd_attack`   | 공격    | PRIMARY  | `TargetUnitId` (무기 사거리 내의 단일 타겟)                               |
| `cmd_skill`    | 스킬    | SKILL    | 스킬 목록 서브메뉴 팝업 -> 선택 후 `TargetUnitId` 배열                    |
| `cmd_wait`     | 대기    | SYSTEM   | 없음. 즉시 턴 종료 및 잔여 AP 이월(Carry-over) 처리.                      |
| `cmd_end_turn` | 턴 종료 | SYSTEM   | `FacingDirection` (유닛이 쳐다볼 최종 방향 N/E/S/W) 선택 UI 팝업.         |

---

## 3. Custom Action Plugin API

로직 모듈이나 AI(MCP)가 특정 스테이지에 한정된 '고유 액션'을 주입하는 방법입니다.

예를 들어, "챕터 1 보스전" 맵에서만 맵 구석의 레버를 당길 수 있는 `pull_lever` 커맨드를 추가하고 싶다면, 스테이지 초기화 시 훅(Hook)을 통해 커스텀 액션을 주입합니다.

```typescript
// AI가 작성하여 주입할 수 있는 커스텀 액션 플러그인 스크립트 예시
Engine.actionMenu.registerCustomAction("pull_lever", {
  displayName: "레버 당기기",
  checkCondition: (state, unit) => {
    // 레버 오브젝트 반경 1타일 이내에 있는지 확인
    const lever = StateQuery.getMapObject(state, "lever_01");
    return MathUtils.manhattan(unit.x, unit.y, lever.x, lever.y) <= 1;
  },
  onExecute: (state, unit, _payload) => {
    // 레버 객체의 상태를 true로 변경하고, 성문을 여는 이벤트 발생
    state.customVars["gate_opened"] = true;
    Engine.logger.info(`${unit.id}가 레버를 당겨 성문이 열렸습니다!`);
    return state; // immer에 의해 불변 반환됨
  },
});
```

UI 레이어는 위 코드를 전혀 알지 못하며, 오직 조건(`checkCondition`)이 충족될 때 화면 하단에 **[레버 당기기]** 버튼을 렌더링하고, 클릭 시 ID를 되돌려주는 역할만 맡습니다.
