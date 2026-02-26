# Core Battle System Specification (Engine Spec)

SRPG Maker 엔진의 **코어 전투 엔진** 구성 방식과, AI(MCP) 및 제작자가 `GameRuleSet.json`을 통해 전투 룰을 주입하고 변형하는 명세입니다. 엔진 레벨에는 더 이상 하드코딩된 규칙이 존재하지 않으며, 철저히 데이터 주도형(Data-Driven)으로 설계되어야 합니다.

## 1. 턴 큐 체제 (Turn Queue System)

엔진은 턴 스케줄링 모드를 추상화하여 제공하며, `GameRuleSet.json`의 `turn_system` 설정에 따라 런타임에 분기됩니다.

### 1-1. Tick/CT (Charge Time) 기반 스케줄링 (기본/권장)

- 개별 유닛의 속도(SPD)에 따라 턴이 돌아오는 방식입니다.
- **RuleSet 제어 파라미터:**
  - `ct_max` (기본 100): 주도권을 획득하는 임계값
  - `ct_tick_formula` (예: `(100 - unit.spd) * 0.5`): 매 틱마다 부여되는 CT 산출용 수식 엔진 파서 연동.

### 1-2. Team/Phase 기반 스케줄링 (전통적 방식)

- Player Phase -> Enemy Phase 로 진영 전체가 턴을 공유하는 고전 방식.
- **RuleSet 제어:** `turn_system.type = "PHASE_BASED"` 로 설정 시, 진영별로 턴을 그룹화하여 처리하는 `PhaseTurnManager` 전략 객체가 주입됩니다.

## 2. AP (Action Point) 및 행동 경제 코어

유닛의 행동(이동, 공격, 스킬) 횟수를 제어하는 범용 자원 시스템입니다. 엔진 레벨에서는 이 자원을 차감하는 로직만 수행하며, 제약 룰은 주입받습니다.
본 엔진은 **히트 앤 런(Hit and Run)** 전술을 기본으로 지원하며, 남은 AP가 허용하는 한 턴 내에 여러 번 이동하거나 행동할 수 있습니다.

### 2-1. AP Configuration (RuleSet)

- `max_ap`: 유닛이 가질 수 있는 최대 AP (유닛 개별 스탯, 예를 들어 `AGI`나 전용 `MaxAP` 스탯에서 오버라이드되며 **성장(Level-up) 곡선**을 가집니다).
- `recovery_per_turn`: 턴 시작 시 일괄 회복되는 기본 AP 양. (기본적으로 시작 시 **Max AP 전체 회복**).
- `allow_split_action`: true일 경우 "이동 후 공격", "공격 후 재이동" 등 세분화된 분할 행동 허용. (히트 앤 런).

### 2-2. 대기(Wait) 및 초기화 메커니즘

- **No Carry-over (이월 불가)**: 턴 종료 시(`Wait` 커맨드 선택 등) 사용하지 않고 남은 잔여 AP는 소멸하며, 다음 턴으로 누적되지 않습니다. 매 턴 산뜻하게 초기화된 전략을 짤 수 있도록 템포를 유지합니다.
- 행동 종료 시점이 "공격 후"가 아닌, "유닛이 명시적으로 턴 종료(Wait)를 선언하거나 AP가 0이 되었을 때"로 정의되어 유연한 AP 활용을 권장합니다.

### 2-3. AP 차감 및 취소(Undo) 보장 — 구현 규칙 (CRITICAL)

AP 차감은 반드시 `MoveAction.execute()` 내부에서 수행되어야 합니다. `GameStore.dispatch(action)`는 실행 전 state를 `stateHistory`에 push하므로, 액션 내부에서 차감해야 완전한 undo가 보장됩니다.

```
올바른 흐름:
  State A {AP=5} → dispatch(MoveAction(cost=1)) → execute 내부에서 AP차감
  stateHistory에 State A {AP=5} push → State B {AP=4, moved=true}
  cancel → undoUnitMoves → State A 복원 → AP=5 완전 회복 ✅

잘못된 흐름 (금지):
  State A → dispatchAsync(AP차감) → State B {AP=4} [history 미기록]
  → dispatch(MoveAction) → stateHistory에 State B {AP=4} push
  cancel → State B 복원 → AP=4 (원본 손실) ❌
```

- `BattleCoordinator`에서 `dispatchAsync`로 AP를 선차감하는 패턴은 금지.
- `MoveAction` 생성자에 `cost: number`를 전달하여 BFS 비용을 액션 내부로 캡슐화.
- `dispatchAsync`는 `inputMode` 전환 등 undo-불필요 메타데이터 변경에만 사용.

## 3. 유닛 방향성 (Facing) 및 위치 전술

방향 판정 로직과 그로 인한 데미지 증폭 역시 엔진 내부가 아닌 RuleSet에서 수치를 공급받아 스케일링됩니다.

- **방향 메타데이터 (`facing`):** 기본 동/서/남/북(E/W/S/N) 4방향 기본. RuleSet의 `enable_diagonal_facing` 플래그를 통해 8방향 체제로의 동적 확장도 고려.
- **배율 설정 (Multiplier Injection):** `GameRuleSet.json` 내부의 `combat.facing_bonus` 파라미터를 통해 측면(`side_dmg_mult`), 후방(`back_dmg_mult`) 타격 시의 대미지 증가 계수 및 치명타 보정값(`crit_bonus`)을 주입받아 `DamageCalc` 모듈이 곱연산을 수행하도록 합니다.
