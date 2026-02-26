# Engine Spec: Level-Up & Growth System

> Target: Post-battle experience, level-ups, and stat growth

## 1. Game Design Context

SRPG의 핵심 동기부여는 "전투를 하면 유닛이 성장한다"는 피드백 루프입니다. Fire Emblem/Tactics Ogre 계보의 개별 유닛 성장률(Growth Rate) 시스템을 채택합니다.

## 2. Experience (EXP) 시스템

### 2.1 EXP 획득 조건

| 행동                   | EXP 공식                           | 비고        |
| ---------------------- | ---------------------------------- | ----------- |
| 적 공격 (적중)         | `baseEXP + (enemyLv - myLv) * 3`   | 최소 1      |
| 적 처치                | `killBonus + (enemyLv - myLv) * 5` | 최소 10     |
| 스킬 사용 (힐/버프)    | `baseEXP + skillRank * 2`          | 지원계 보상 |
| 스테이지 클리어 보너스 | `clearBonus * partySize`           | 전체 분배   |

### 2.2 상수 정의

```typescript
export const EXP_CONSTANTS = {
  BASE_ATTACK_EXP: 10,
  KILL_BONUS: 30,
  BASE_SUPPORT_EXP: 15,
  CLEAR_BONUS: 20,
  EXP_PER_LEVEL: 100, // 100 EXP = 1 Level
  MAX_LEVEL: 30,
};
```

## 3. Level-Up & Growth Rate

### 3.1 Growth Rate 구조

각 유닛은 `GrowthRates` 객체를 가지며, 레벨업 시 각 스탯의 성장 확률(%)을 결정합니다.

```typescript
export interface GrowthRates {
  hp: number; // e.g. 70 = 70% 확률로 HP +1
  atk: number;
  def: number;
  spd: number;
  skl: number;
  mp: number;
}
```

### 3.2 레벨업 처리

```
for each stat in GrowthRates:
  if random(0..99) < growthRate[stat]:
    unit[stat] += 1
    if stat === 'hp': unit.maxHp += 1
    if stat === 'mp': unit.maxMp += 1
```

최소 보장: 레벨업 시 최소 1개 스탯은 반드시 상승 (FE 스타일 "축복 레벨업").

### 3.3 UnitData 확장

```typescript
// UnitData에 추가
export interface UnitData {
  // ... 기존 필드
  growthRates: GrowthRates;
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
    skl: number;
    mp: number;
  };
}

// UnitInstance에 추가
export interface UnitInstance {
  // ... 기존 필드
  exp: number; // 현재 누적 EXP
  level: number; // 현재 레벨
}
```

## 4. 구현 모듈

### 4.1 `LevelUpSystem.ts`

순수 TypeScript 모듈. Phaser 의존성 없음.

- `grantEXP(unit, amount): LevelUpResult[]` — EXP 부여 + 레벨업 체크
- `processLevelUp(unit, growthRates): StatGain` — 성장률 기반 스탯 증가
- `calculateBattleEXP(attacker, defender, killed): number` — 전투 EXP 계산

### 4.2 ResultScene 연동

전투 종료 → `ResultScene`에서 생존 유닛에 EXP 분배 → 레벨업 연출 → `CampaignManager.updateRoster()`.

## 5. 데이터 예시

```json
{
  "hero_lancer": {
    "name": "Aeron",
    "baseStats": { "hp": 22, "atk": 8, "def": 6, "spd": 7, "skl": 5, "mp": 4 },
    "growthRates": {
      "hp": 70,
      "atk": 50,
      "def": 40,
      "spd": 55,
      "skl": 45,
      "mp": 30
    }
  }
}
```
