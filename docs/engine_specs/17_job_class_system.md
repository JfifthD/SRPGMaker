# Engine Spec: Job / Class System

> Target: Multi-class progression and skill inheritance

## 1. Game Design Context

FFT의 직업 트리 + FE의 전직(Class Change)을 결합합니다. 유닛은 기본 직업에서 시작해 조건을 만족하면 상위/파생 직업으로 전직할 수 있으며, 전직 시 이전 직업의 일부 스킬을 유지합니다.

## 2. Class Tree 구조

```typescript
export interface JobData {
  id: string; // e.g. "soldier"
  name: string; // "병사"
  desc: string;
  tier: 1 | 2 | 3; // 기본 / 중급 / 상급

  /** 기본 스탯 보정 (직업 전환 시 기본값에 적용) */
  statMod: Partial<Record<"hp" | "atk" | "def" | "spd" | "skl" | "mp", number>>;

  /** 이 직업에서 습득하는 스킬 목록 (레벨 조건 포함) */
  learnableSkills: { skillId: string; requiredLevel: number }[];

  /** 전직 가능 조건 */
  promotionTargets?: {
    jobId: string; // 전직 대상 직업 ID
    requiredLevel: number; // 최소 레벨
    requiredItems?: string[]; // 필요 아이템 (전직의 증표 등)
  }[];

  /** 사용 가능한 장비 타입 */
  equipTags: string[]; // ["blade", "heavy_armor"]

  /** 커스텀 성장률 보정 (GrowthRates 가산) */
  growthMod?: Partial<
    Record<"hp" | "atk" | "def" | "spd" | "skl" | "mp", number>
  >;
}
```

## 3. 전직 시스템

### 3.1 전직 흐름

```
유닛 "Aeron" (병사 Lv.10)
  → 전직 조건 확인: { jobId: "knight", requiredLevel: 10 }
  → 전직 실행:
      1. 레벨 1로 리셋 (또는 유지 — 설정에 따라)
      2. 스탯에 knight.statMod 적용
      3. 성장률에 knight.growthMod 가산
      4. 병사 스킬 중 "마스터 스킬" 1~2개 유지
      5. knight.learnableSkills 습득 시작
```

### 3.2 스킬 계승 (Carry-Over)

전직 시 이전 직업에서 배운 스킬 중 최대 `MAX_CARRYOVER_SKILLS`(기본 2)개를 선택하여 유지. 전략적 빌드 다양성의 핵심.

## 4. 구현 모듈

### 4.1 `JobSystem.ts`

- `canPromote(unit, targetJobId, jobs, inventory): boolean`
- `promote(unit, targetJobId, carrySkills[]): UnitInstance`
- `getLearnableSkills(unit, jobData): SkillId[]`

### 4.2 데이터 파일

`assets/data/jobs.json` — 직업 트리 정의.

## 5. 데이터 예시

```json
{
  "soldier": {
    "name": "병사",
    "tier": 1,
    "statMod": { "hp": 2, "atk": 1, "def": 1 },
    "learnableSkills": [
      { "skillId": "thrust", "requiredLevel": 1 },
      { "skillId": "guard", "requiredLevel": 5 }
    ],
    "promotionTargets": [
      { "jobId": "knight", "requiredLevel": 10 },
      {
        "jobId": "halberdier",
        "requiredLevel": 10,
        "requiredItems": ["promotion_crest"]
      }
    ],
    "equipTags": ["blade", "spear", "light_armor"]
  }
}
```
