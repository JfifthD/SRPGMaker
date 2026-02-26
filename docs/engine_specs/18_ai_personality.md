# Engine Spec: AI Personality System

> Target: Differentiated enemy behaviors per unit type

## 1. Game Design Context

현재 적 AI는 `aggressive` 단일 모드입니다. 실제 SRPG에서는 적마다 다른 행동 패턴(불사조 보스는 끝까지 고수, 마법사는 후방 대기, 치유사는 아군 팔로우)이 전략적 깊이를 만듭니다.

## 2. AI 성격 유형

```typescript
export type AIPersonality =
  | "aggressive" // 가장 가까운 적을 최우선 공격
  | "defensive" // 특정 타일/유닛 근처에서 대기, 사거리 진입 시만 공격
  | "support" // 아군 HP가 낮은 유닛에게 힐/버프 우선
  | "hit_and_run" // 공격 후 최대한 먼 타일로 이동
  | "boss" // 고정 위치, 범위 내 가장 위협적인 적 공격
  | "patrol"; // 지정 경로를 순회, 감지 범위 내 적에게만 반응

export interface AIConfig {
  personality: AIPersonality;
  /** 감지 반경 — 이 범위 안에 적이 있을 때만 행동 */
  detectRange?: number;
  /** 방어 거점 타일 (defensive/boss) */
  guardTile?: { x: number; y: number };
  /** patrol 경로 (patrol) */
  patrolPath?: { x: number; y: number }[];
  /** 우선 공격 대상 조건 */
  targetPriority?: "nearest" | "weakest" | "strongest" | "healer_first";
}
```

## 3. AIScorer 가중치 분기

각 성격별로 `AIScorer`의 가중치를 다르게 적용합니다:

| 성격        | 이동 가중치     | 공격 가중치    | 스킬 가중치 | 후퇴 가중치   |
| ----------- | --------------- | -------------- | ----------- | ------------- |
| aggressive  | 적 방향 +3      | 킬 확률 ×2     | 대미지 ×1.5 | 0 (후퇴 없음) |
| defensive   | 거점 유지 +5    | 사거리 내 ×1   | 방어버프 ×2 | 거점 복귀 +3  |
| support     | 아군 방향 +4    | 0.3            | 힐 ×3       | 아군 근처 +2  |
| hit_and_run | 공격 후 도주 +4 | 안전 타일 ×1.5 | 원거리 ×2   | 거리 ×2       |
| boss        | 0 (고정)        | 위협도 ×2      | 광역 ×2     | 0             |
| patrol      | 경로 따라감 +5  | 감지 범위 ×1   | 0.5         | 경로 복귀 +3  |

## 4. 구현 계획

### 4.1 `EnemyAI.ts` 수정

기존 `aiType: 'aggressive'` 분기를 `AIConfig` 기반으로 확장:

```typescript
// UnitInstance 확장
export interface UnitInstance {
  // ... 기존
  aiType: AIPersonality;
  aiConfig?: AIConfig;
}
```

### 4.2 `AIScorer.ts` 가중치 매핑

`getScorerWeights(personality): WeightMap` 함수 추가.

## 5. MapData 연동

```json
{
  "enemies": [
    {
      "dataId": "dark_mage",
      "x": 8,
      "y": 2,
      "aiType": "defensive",
      "aiConfig": { "guardTile": { "x": 8, "y": 2 }, "detectRange": 5 }
    },
    {
      "dataId": "healer",
      "x": 6,
      "y": 1,
      "aiType": "support",
      "aiConfig": { "targetPriority": "weakest" }
    }
  ]
}
```
