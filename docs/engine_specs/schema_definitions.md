# Engine JSON Schema Definitions (AI & Modding API)

SRPG Maker 엔진은 AI(MCP)나 휴먼 크리에이터가 게임 콘텐츠를 제작할 때 준수해야 하는 **엄격한 JSON 스키마 규격**을 정의합니다. 엔진 코어는 이 스키마 포맷 단위로 에셋과 데이터를 파싱합니다.

이 문서는 가장 핵심이 되는 데이터 타입들의 인터페이스(TypeScript 규격)를 정의합니다.

## 1. UnitData Schema (유닛/캐릭터 정의)

`UnitData`는 전장에 배치될 수 있는 단일 개체의 정적 기초 데이터입니다.

```typescript
interface UnitData {
  // [Identity & Visuals]
  id: string; // 전역 고유 식별자 (e.g., "hero_kyle")
  name: string; // UI 전시 이름
  unitClass: string; // 직업/클래스 ID (Stats override에 사용됨)
  spriteKey: string; // Asset DB의 스프라이트 ID
  portraitKey?: string; // 대화/상세창용 초상화 ID

  // [Core Stats]
  maxHP: number;
  maxMP: number; // 스킬 사용 자원
  spd: number; // 속도 (CT 틱당 획득량 결정 인자)
  moveRange: number; // 이동력 (타일 칸 수 단위)
  jumpHeight: number; // 등반력 (오를 수 있는 최대 Elevation 차이)

  // [Combat Capabilities]
  skills: string[]; // 보유한 Skill ID 배열
  passives: EffectNode[]; // 런타임에 즉시 개입하는 효과 노드 리스트 (ZOC 등)
  tags: string[]; // 특성 태그 (AI 타겟팅이나 추가 데미지 판정에 활용)
}
```

## 2. SkillData Schema (스킬 및 행동 정의)

스킬은 데미지를 주입하거나 상태 이상, 버프를 거는 핵심 도구입니다. 이 구조체를 통해 단순 타격기부터 부활, 맵 변위 마법까지 정의할 수 있습니다.

```typescript
interface SkillData {
  id: string;
  name: string;
  description: string;
  iconKey: string;

  // [Cost & Range]
  cost: {
    mp?: number;
    ap?: number;
    hp_percent?: number; // "현재 체력의 10% 소모" 등의 기믹
  };
  range: {
    type: "CROSS" | "DIAMOND" | "SQUARE" | "GLOBAL" | "SELF";
    min: number; // 최소 사거리 (보통 1, 궁수면 2)
    max: number; // 최대 사거리
    elevation_tolerance: number; // 스킬이 닿는 상하 높낮이 한계
  };
  areaOfEffect: {
    // 범위기(광역기) 설정
    type: "SINGLE" | "CROSS" | "DIAMOND" | "SQUARE";
    radius: number; // 0이면 단일 타겟, 1 이상이면 광역
  };

  // [Effects] - 실제 로직
  effects: EffectNode[]; // 배열 순서대로 인터프리터가 효과를 집행함

  // [Visuals]
  vfx: {
    cast_anim?: string; // 영창 모션 ID
    projectile?: string; // 투사체 VFX ID
    hit_anim?: string; // 적중 VFX ID
  };
}
```

## 3. MapData Schema (전장 데이터)

타일 렌더링, 길찾기(BFS/A\*), 스폰 포인트가 모두 담긴 맵의 총체입니다.

```typescript
interface MapData {
  id: string;
  name: string;

  // [Dimensions & Grid]
  width: number; // X축 최대 크기
  height: number; // Y축 최대 크기

  // [Terrain Geometry]
  // 길이는 width * height 이어야 하며, 1차원 배열로 평탄화하여 관리
  terrain_layer: string[]; // 각 타일의 기본 속성 (e.g., "grass", "water", "wall")
  elevation_layer: number[]; // 각 타일의 높낮이 Z값 (0, 1, 2...)

  // [Entities & Layout]
  spawn_points: {
    player: { x: number; y: number; facing: "N" | "S" | "E" | "W" }[];
    enemy: {
      x: number;
      y: number;
      unit_id: string;
      ai_profile: string;
      facing: "N" | "S" | "E" | "W";
    }[];
  };

  objects: {
    id: string; // 식별자 (Script Fallback 조작용)
    x: number;
    y: number;
    type: "CHEST" | "LEVER" | "DOOR" | "DESTRUCTIBLE";
    params: any;
  }[];

  // [Runtime Rules]
  environment_ruleset_id?: string; // 이 맵에만 적용되는 특수 룰셋 (예: 용암 지대 지속피해 룰)
}
```

## 4. GameRuleSet Schema

이전 `01_core_battle.md` 에서 정의했던, 게임 전체의 전투 공식을 지배하는 최상위 설정 객체입니다. AI는 프로젝트 초기화 시 이 JSON 하나만 세팅함으로써 전혀 다른 게임성(FFT 스타일 vs 파이어엠블렘 스타일)을 만들어낼 수 있습니다.

_(상세 스키마는 01_core_battle.md 및 시스템 아키텍처 문서 참조)_
