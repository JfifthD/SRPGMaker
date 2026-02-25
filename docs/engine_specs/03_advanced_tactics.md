# Tactical Effect Node System (API Spec)

SRPG Maker 엔진은 하드코딩된 패시브/액티브 룰(예: ZOC, 반격, 협동 공격) 대신, AI(MCP)나 기획자가 JSON 배열로 기믹을 무한정 조립할 수 있는 **Effect Node System**을 제공합니다.

기존 `03_advanced_tactics.md`에 정의되었던 모든 '고급 전술'은 이제 엔진 코어 하드코딩이 아닌, 아래의 Node Schema 조합으로 구현(플러그인화)됩니다.

---

## 1. Effect Node 블록 구조

모든 스킬, 패시브, 지형 효과, 장비 기믹은 `EffectNode[]` 배열 형태로 정의됩니다. 엔진의 `SkillExecutor`나 `ReactionSystem`은 이 배열을 순회하며 인터프리트(Interpret) 합니다.

```json
{
  "type": "EffectNodeType",
  "trigger": "TriggerCondition",     // 어떤 상황에 발동하는가?
  "target": "TargetSelector",        // 누구에게 적용할 것인가?
  "conditions": ["ConditionNode"],   // 발동을 제약하는 조건식 배열
  "payload": { ... }                 // 실제 효과의 파라미터
}
```

### 1-1. 지원되는 주요 Trigger 패턴

- `OnActiveUse`: 스킬을 직접 선택해서 액션 트리거 시 발동
- `OnTurnStart` / `OnTurnEnd`: 특정 유닛의 턴 개시/종료 시점 훅
- `OnBeforeDamaged`: 데미지를 입기 직전 (회피, 쉴드, 불굴 판정)
- `OnAfterDamaged`: 데미지를 입은 직후 (반격 판정)
- `OnMoveEnter` / `OnMoveLeave`: 특정 타일에 진입하거나 타일에서 벗어날 때 (ZOC 트리거)

---

## 2. 기존 고급 전술의 Node-based 구현 예시

엔진 사용자는 아래와 같은 JSON 데이터만 주입하면 기존의 고급 전술을 즉시 게임에 추가할 수 있습니다. 코딩이 필요 없습니다.

### 2-1. ZOC (Zone of Control) 및 기회 공격

전투 맵에 다음과 같은 Terrain Effect를 배치하거나, 유닛의 Passive Traits 배열에 주입합니다.

```json
{
  "name": "ZOC_OpportunityAttack",
  "type": "ReactionStrike",
  "trigger": "OnMoveLeave", // 적이 내 인접 타일에서 벗어나려 할 때
  "target": "TriggeringEntity", // 도망가는 적에게
  "conditions": ["IsEnemy", "Distance == 1"],
  "payload": {
    "action": "BasicAttack",
    "interrupt_movement": true // 맞으면 이동을 강제 정지할 것인지 옵션
  }
}
```

### 2-2. 불굴 (Survive / Undying)

HP가 0이 될 상황에서 1을 남기고 버티는 패시브.

```json
{
  "name": "Passive_Undying",
  "type": "OverrideDamage",
  "trigger": "OnBeforeDamaged",
  "target": "Self",
  "conditions": [
    "IncomingDamage >= CurrentHP",
    "CustomVar.undying_used == false"
  ],
  "payload": {
    "set_damage_to": "CurrentHP - 1",
    "mutate_custom_var": { "undying_used": true }
  }
}
```

### 2-3. 협동 공격 (Chain-Attack / Assist)

내 공격 범위 안에 아군이 공격하는 적이 들어왔을 때 자동으로 가짜 공격 액션을 날리는 트리거.

```json
{
  "name": "Passive_ChainAssist",
  "type": "ReactionStrike",
  "trigger": "OnAllyAttacking",
  "target": "EventTarget", // 아군이 공격 중인 대상
  "conditions": ["TargetInWeaponRange", "CurrentAP >= 1"],
  "payload": {
    "action": "BasicAttack",
    "damage_multiplier": 0.5, // 지원 공격이므로 위력 50% 반감
    "ap_cost": 0 // AP 소모 없이 발동
  }
}
```

---

## 3. 동적 지형 (Interactive Terrain) API

데이터 주도형 환경 상호작용은 MapData의 타일 배열 자체를 상태 변화(State Transition) 가능하도록 구축합니다.

- 타일 데이터(`TerrainData`) 안에 `OnStatusEffect` 노드를 추가합니다.
- 예: "숲(Forest)" 타일에 "화상(Burn)" 효과가 들어간 스킬이 적중하면, 타일 속성을 "불타는 숲(Burning_Forest)"으로 치환(Transform) 하라는 RuleSet 주입.

```json
"Terrain_Forest": {
  "defense_bonus": 20,
  "reactions": [
    {
      "trigger": "OnHitByTag",
      "conditions": ["HasTag(Fire)"],
      "payload": {
        "transform_terrain_to": "Terrain_BurningForest"
      }
    }
  ]
}
```

---

## 4. 확장성을 위한 Scripting Fallback

JSON Node 만으로 도저히 표현 불가능한 극도로 복잡한 기믹(예: 맵 전체의 퍼즐 스위치 일괄 작동 등)은, 페이로드에 `"script_id": "boss_gimmick_01"` 형태로 TypeScript 함수를 매핑(Binding)할 수 있는 이스케이프 해치(Escape Hatch)를 엔진이 제공해야 합니다.
