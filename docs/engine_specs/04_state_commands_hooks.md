# State, Commands & Hooks System Specification

SRPG Maker 엔진의 코어 상태 관리 체계와 커스텀 플러그인(모딩) 확장을 위한 Hook/Middleware 시스템 명세서입니다.

> **목적:** AI(MCP) 및 게임 제작자가 기존 엔진 코어 코드를 수정(Modify)하지 않고, 플러그인과 이벤트를 통해 새로운 룰과 효과를 확장(Extend)할 수 있도록 보장합니다.

---

## 1. BattleState (Immutable Snapshot & Extensibility)

`BattleState`는 기존과 동일하게 불변 객체(Immutable)를 유지하되, **동적 확장을 위한 Custom Metadata 필드**를 추가로 개방합니다.

```typescript
interface BattleState {
  mapData: MapData;
  units: Record<string, UnitInstance>; // instanceId 기반 접근
  turn: number;
  phase: BattlePhase;
  selectedUnitId: string | null;
  activeUnitId: string | null;
  inputMode: InputMode;
  activeSkillId: string | null;
  busy: boolean;
  actionLog: ActionLogEntry[];
  stateHistory: BattleState[]; // Undo buffer (max 50 entries)

  // [NEW] 플러그인 확장을 위한 Custom Store
  customVars: Record<string, any>; // 맵 전역 변수 (e.g., 'weather': 'rain')
}

interface UnitInstance extends UnitData {
  // 기본 런타임 스탯
  instanceId: string;
  x: number;
  y: number;
  hp: number;
  currentMP: number;
  currentAP: number;
  ct: number;
  facing: Direction;
  buffs: BuffInstance[];

  // [NEW] 유닛 단위 커스텀 메타데이터
  traits: string[]; // 특성 태그 (e.g., ['undead', 'flying'])
  customVars: Record<string, any>; // 유닛 전용 변수 (e.g., 'stealth_turns': 2)
}
```

---

## 2. Command Pattern (GameAction Payload)

엔진이 기본 제공하는 내장 액션(Move, Attack, Skill, Wait) 외에도, 메이커 툴로서 누구나 새 액션을 등록할 수 있어야 합니다.

```typescript
interface GameAction {
  // 고유 식별자 (로깅 및 Replay용)
  id: string;
  // Immer를 통한 불변 상태 반환
  execute(state: BattleState, context: HookContext): BattleState;
}
```

- **직렬화 보장:** 저장/불러오기 및 AI의 Replay 시뮬레이션을 위해 Action 객체는 직렬화(JSON 시리얼라이즈) 가능한 Payload 형태로 래핑될 수 있어야 합니다. (e.g., `{"type": "AttackAction", "payload": {"attackerId": "A", "defenderId": "B"}}`)

---

## 3. Hook & Middleware Pipeline (핵심)

데이터 주입(Data-Driven)만으로 한계가 있는 복잡한 로직(예: "데미지를 입기 직전에 쉴드가 있으면 데미지를 흡수하고 쉴드 파괴")은 **Hook 파이프라인**을 통해 해결합니다.

엔진(`GameStore`, `DamageCalc`, `SkillExecutor`)의 주요 라이프사이클에 Hook 포인트가 존재합니다.

### 3-1. Hook Context

```typescript
interface HookContext {
  store: GameStore; // readonly API 및 dispatch 권한
  ruleSet: GameRuleSet; // 현재 적용 중인 메이커 룰셋
  logger: Logger; // 시스템 로그 접근
}
```

### 3-2. 주요 Hook Lifecycle

플러그인 작성자(또는 AI)는 `Engine.hook.on()` 을 통해 특정 시점에 개입할 수 있습니다. `onBeforeXXX` 훅은 상태를 변조하거나 취소(Cancel)할 수 있습니다.

| Hook Point (Event) | 파라미터 타입 (Draft)                    | 설명 및 활용 예시                                              |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| `onBeforeDamage`   | `{ attacker, defender, damage, isCrit }` | 데미지 계산 직후, 적용 직전. 방어막, 데미지 무효화 패시브 처리 |
| `onAfterDamage`    | `{ attacker, defender, finalDmg }`       | 흡혈(Vampire), 피격 시 반격(Counter) 트리거                    |
| `onBeforeMove`     | `{ unit, fromX, fromY, toX, toY }`       | 이동 제약 검사, 덫(Trap) 밟음 판정 (이동 강제 중지 등)         |
| `onAfterMove`      | `{ unit, toX, toY }`                     | 기회공격(ZOC) 발동, 지형 효과(독 장판) 적용                    |
| `onTurnStart`      | `{ unit }`                               | 틱댐(독, 화상) 적용, 버프 턴 감소, 재생(Regen) 능력 발동       |
| `onActionComplete` | `{ unit, actionId }`                     | 스킬 사용 후 재행동(갈라진 틈) 기믹 적용                       |

### 3-3. 플러그인 작성 예시 (Pseudocode)

AI(MCP)가 다음과 같은 플러그인 스크립트를 작성하여 게임 엔진에 주입할 수 있습니다:

```typescript
// 플러그인 예시: "축복받은 갑옷" - 턴당 1회 데미지 50% 반감
Engine.hook.on("onBeforeDamage", (draftState, eventStr, ctx) => {
  const { defender, damage } = eventStr;

  if (defender.traits.includes("blessed_armor")) {
    const used = defender.customVars["armor_used_this_turn"];
    if (!used) {
      eventStr.damage = Math.floor(damage * 0.5); // 데미지 반감
      defender.customVars["armor_used_this_turn"] = true;
      ctx.logger.info(`${defender.id}의 축복받은 갑옷 발동!`);
    }
  }
  return eventStr; // 변조된 이벤트 페이로드 반환
});
```

---

## 4. GameRuleSet.json 매퍼 (Rule Configuration)

하드코딩되었던 AP 경제 및 턴 시스템을 AI가 프롬프트로 바꿀 수 있도록 `GameRuleSet`으로 추상화합니다.

```json
{
  "system_id": "rule_tactics_standard",
  "turn_system": {
    "type": "CT_BASED",
    "ct_max": 100,
    "ct_tick_formula": "(100 - unit.spd) * 0.5"
  },
  "ap_economy": {
    "max_ap": 5,
    "recovery_per_turn": 5,
    "allow_carry_over": true,
    "cost_move_per_tile": 1,
    "cost_attack": 3,
    "cost_skill_default": 3
  },
  "combat": {
    "facing_bonus": {
      "side_dmg_mult": 1.1,
      "back_dmg_mult": 1.3
    },
    "critical_mult": 1.8
  }
}
```

이 RuleSet은 `GameStore.init()` 시 엔진에 주입되며, `DamageCalc`나 `TurnManager`는 하드코딩된 숫자 대신 이 RuleSet의 변수를 읽어 작동합니다.
