# Metagame & Flow Configuration Spec

SRPG Maker 엔진은 "스테이지 클리어 후 무슨 일이 벌어지는가?"에 대한 제반 흐름(Metagame Loop)을 하드코딩된 코드가 아니라, 상태 머신 다이얼로그(Scene Graph)로 정의하여 제공합니다.

기존의 `Result -> WorldMap -> Camp -> Prep` 순서는 하나의 사전 설정(Preset)일 뿐이며, 메이커 툴 사용자는 이 플로우를 자유롭게 재구성할 수 있어야 합니다.

## 1. Scene Traversal Graph (장면 전환 스키마)

모든 플레이 흐름은 `FlowGraph.json` 파일에 의해 통제됩니다. AI(MCP)나 모더는 씬의 연결 상태를 정의함으로써 선형 게임, 분기형 게임, 로그라이크식 배회 게임 등을 쉽게 제작할 수 있습니다.

```json
{
  "scenes": {
    "scene_battle_01": {
      "type": "Battle",
      "map_id": "map_tutorial",
      "on_victory": { "next": "scene_result_01", "emit": ["unlock_shop"] },
      "on_defeat": { "next": "scene_gameover" }
    },
    "scene_result_01": {
      "type": "ResultEvaluation",
      "bonus_rules": ["turn_count", "no_death"],
      "on_complete": { "next": "scene_camp_main" }
    },
    "scene_camp_main": {
      "type": "Hub",
      "available_facilities": ["Shop", "Talk", "Barracks"],
      "next_destinations": ["scene_battle_02", "scene_sidequest_01"]
    }
  },
  "initial_scene": "scene_battle_01"
}
```

## 2. Evaluation Rules (결과 결산 플러그인)

전투 승리 후 랭크(S, A, B)나 추가 보상을 산정하는 방식 역시 커스텀 RuleSet으로 분리됩니다.
위 스키마의 `bonus_rules`에 등록된 식별자는 다음과 같은 로직으로 해석됩니다.

- `turn_count`: `BattleState.turn` 값이 `TargetTurn` 이하일 경우 배율 보상 지급.
- `no_death`: 전투 종료 시점 `BattleState`의 아군 사상자가 0명일 경우 특수 테이블 보상 지급.

## 3. Persistent State (거점 및 영속 상태 관리)

전투가 아닌 메타게임(장비 장착, 상점 물품 구매) 구간에서 변하는 데이터는 `CampaignState`라는 별도의 전역 불변 객체로 관리되어야 합니다.

```typescript
interface CampaignState {
  inventory: InventoryItem[]; // 파티가 획득한 아이템 공유 인벤토리
  roster: UnitData[]; // 플레이어 파티에 합류한 전체 고유 캐릭터 목록
  unlocked_classes: string[]; // 해금된 전직 트리 노드
  campaign_vars: Record<string, any>; // 분기점, NPC 대화 횟수 등의 메타 변수
}
```

- 메타게임의 모든 행동(아이템 구매, 장비 장착) 역시 `CampaignAction` 커맨드 객체를 통해 `CampaignStore` 로 디스패치되어 불변성을 유지해야 하며, 이 스토어 객체가 통째로 Save/Load의 단위가 됩니다.
