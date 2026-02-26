# Engine Spec: Equipment System

> Target: Stat-modifying gear with utility effects

## 1. Game Design Context

장비는 단순 스탯 보강을 넘어, 이동력 증가, 속성 면역, 반격 강화 등 전략적 유틸리티를 제공합니다. FFT의 "Equip Change" + Fire Emblem의 무기 삼각관계를 현대적으로 재해석합니다.

## 2. Equipment Slot 구조

```typescript
export type EquipSlot = "weapon" | "armor" | "accessory";

export interface EquipmentData {
  id: string;
  name: string;
  desc: string;
  slot: EquipSlot;
  /** 스탯 보정 (additive) */
  statBonus: Partial<
    Record<"atk" | "def" | "spd" | "skl" | "hp" | "mp", number>
  >;
  /** 이동력 보정 */
  movBonus?: number;
  /** 사거리 보정 (원거리 무기) */
  rangeBonus?: number;
  /** 속성 태그 (무기 속성, 방어구 내성) */
  tags?: string[];
  /** 장비 장착 시 부여되는 패시브 EffectNode */
  passiveEffects?: import("./EffectNode").EffectNode[];
  /** 장착 가능 직업 제한 */
  classRestriction?: string[];
  /** 가격 (상점 시스템) */
  price?: number;
}
```

## 3. UnitInstance 확장

```typescript
export interface UnitInstance {
  // ... 기존 필드
  equipment: {
    weapon: string | null; // EquipmentData.id
    armor: string | null;
    accessory: string | null;
  };
}
```

## 4. 전투 스탯 계산 파이프라인

```
finalAtk = baseAtk + weaponBonus.atk + armorBonus.atk + accessoryBonus.atk + buffTotal
finalDef = baseDef + weaponBonus.def + armorBonus.def + accessoryBonus.def + buffTotal
atkRange = baseRange + weaponRangeBonus
movRange = baseMov + armorMovBonus + accessoryMovBonus
```

## 5. 구현 모듈

### 5.1 `EquipmentSystem.ts`

- `equip(unit, equipId): UnitInstance` — 장비 장착 (기존 해제 포함)
- `unequip(unit, slot): UnitInstance` — 장비 해제
- `getEffectiveStats(unit, equipMap): ComputedStats` — 장비 포함 최종 스탯
- `canEquip(unit, equipData): boolean` — 직업 제한 확인

### 5.2 데이터 파일

`assets/data/equipment.json` — 전체 장비 정의.

## 6. 데이터 예시

```json
{
  "iron_sword": {
    "name": "철검",
    "desc": "기본적인 검",
    "slot": "weapon",
    "statBonus": { "atk": 5 },
    "tags": ["blade", "phys"],
    "price": 300
  },
  "swift_boots": {
    "name": "신속의 장화",
    "desc": "이동력 +1",
    "slot": "accessory",
    "statBonus": {},
    "movBonus": 1,
    "price": 800
  },
  "flame_ring": {
    "name": "화염의 반지",
    "desc": "화속성 공격 시 대미지 +20%",
    "slot": "accessory",
    "statBonus": {},
    "tags": ["fire_boost"],
    "passiveEffects": [
      {
        "type": "DamageBoost",
        "trigger": "OnActiveUse",
        "conditions": ["HasTag(Fire)"],
        "payload": { "mult": 1.2 }
      }
    ],
    "price": 1500
  }
}
```
