# Pending Task Backlog

구현되지 않은 기능들의 백로그. 완료된 항목은 해당 `engine_specs/` 문서 혹은 `demo_game/` 문서로 이동하거나 삭제.
세부 구현 계획이 있는 항목은 별도 `docs/todo/*.md` 파일로 분리.

> **[CRITICAL RULE: 설계 우선 원칙]**
> **어떠한 개발적, 아키텍처적, 기술적 기능 구현이든, 코드를 작성하기 전에 반드시 해당 시스템에 대한 기획/설계 문서를 먼저 작성하거나 업데이트한 후 그 기준에 맞춰 진행해야 합니다.** (Design-First Approach)

---

## Game Design & Planning (기획/설계 최우선)

- [ ] **수치 밸런스 테이블 작성**: `docs/demo_game/01_balance_tables.md` 기준표 채우기 (HP/ATK 커브, AP/CT 공식 등).
- [ ] **세계관 및 시놉시스 구체화**: `docs/demo_game/02_world_narrative.md` 챕터별 구체적 플롯 및 캐릭터 대화 시트 작성.
- [ ] **오디오 에셋 매핑 및 설계**: `docs/engine_specs/07_audio_framework.md` 구체적인 리소스 수급 계획안 확정.
- [ ] **메타게임 / 튜토리얼 기획**: `docs/engine_specs/08_metagame_loop.md`, `docs/demo_game/03_tutorial_onboarding.md` 게임 흐름 기획 완성.

---

## UI / HUD

- [x] **턴 타임라인 베젤 (Action Order UI)**: ✅ 2026-02-26 구현 완료. `UIScripts` 상단 바 아래 CT 표시.
- [x] **Action Menu 링 커맨드 (Phase 5.0)**: ✅ BattleCoordinator에서 넘겨받은 커맨드 Payload 기반 원형 UI(Ring) 렌더링 완료.
- [ ] **AP 소모 시각화**: 타일 경로 마우스오버 시 소모될 AP를 타일에 표시 (깜빡임 처리).
- [ ] **방향 지정 인터페이스**: 턴 종료(`End Turn`) 시 플레이어가 유닛 최종 facing(N/E/S/W)을 결정하는 Radial Menu 추가.
- [ ] **미니맵**: 대형 전장의 카메라 뷰 및 유닛 위치 표시.
- [ ] **위험 구역 표시 (Danger Zone Heatmap)**: 단축키 토글 시 적 전체의 이동+공격 합산 최대 사거리를 붉은색 타일레이어로 렌더링하는 전장 오버레이 시스템.

---

## Graphics / Engine

- [ ] **파티클 VFX**: 공격/스킬 이펙트 파티클 시스템 (Phaser ParticleManager). → `docs/todo/graphics-upgrade.md` 참조
- [ ] **카메라 팬/줌**: 마우스 휠 줌, 드래그 팬.
- [ ] **스프라이트 교체**: 현재 절차적 도형 → 실제 스프라이트. → `docs/todo/graphics-upgrade.md`
- [ ] **아이소메트릭 카메라**: Orthogonal → 쿼터뷰 전환, Screen↔ISO 레이캐스트 (`MathUtils`).
- [ ] **Frustum Culling**: 화면 외 유닛 애니메이션 연산 일시 중지.
- [ ] **고저차 대미지 기믹**: 높은 지형 원거리 유닛 → 사거리 연장 + 대미지 배율 (`DamageCalc.ts`).
- [ ] **지형 상호작용 (Interactive Terrain)**: 전투 중 화염으로 숲 태우기, 스위치 조작, 벽돌 부수기 등 동적 맵 기믹 반영 객체 구현.

---

## AI

- [ ] **적 타입별 AI 성격**: 공격형(aggressive) / 수비형(defensive) / 지원형(support) AI 파라미터 분기.

---

## Phase 1: Reactive Combat & Positional Tactics (전투 코어 보강)

- [x] **기회 공격 및 ZOC (Zone of Control)**: 방어형 유닛 인접 타일 진입/이탈 시 AP 삭감 및 즉시 평타 발동 시스템. (MoveAction ZOC 구현 완료)
- [x] **리액션 스킬 (Reaction)**: 턴 외 시간에 피격 시 발동하는 반격(Counter), 회피(Evade), 불굴(Survive) 스킬 로직. (`ReactionSystem.ts` 구현 완료)
- [x] **협동 공격 (Chain-Assist)**: 아군 사거리 중첩 시 통상 공격에 스케일링된 연계 추가타를 가하는 Formation 시스템. (추후 확장을 위한 `ReactionSystem.ts` 에 Hooking 포인트 부여)

---

## Phase 2: Environment & Spatial Awareness (전장/환경 인식)

- [x] **Effect Node Runtime** (Phase 2-0): `EffectNodeRunner.ts` — JSON 기반 전술 기믹 인터프리터 엔진. (`EffectNode.ts` 타입 정의 포함)
- [x] **TerrainData 확장**: `reactions[]`, `tags[]` 필드 추가. `UnitData`에 `passiveEffects[]` 추가.
- [x] **지형 상호작용 (Interactive Terrain)**: `TerrainInteractionSystem.ts` — 스킬 태그 기반 지형 변환 (예: Fire → burning_forest). 로직 완료.
- [x] **위험 구역 계산 (Danger Zone Calc)**: `DangerZoneCalc.ts` — 적 전체의 이동+공격 합산 범위 계산. 로직 완료.
- [ ] **위험 구역 렌더링**: 단축키 `D` 토글 시 붉은색 타일 오버레이 렌더링 (PhaserRenderer + InputHandler 연동 구현 필요).

---

## Phase 3: RPG Progression & Customization (성장 및 세팅)

- [ ] **클래스 트리 및 성급 (Job System)**: 하위 직업에서 상위 직업 파생 및 타 클래스 스킬 슬롯 장착(Multi-classing) 아키텍처 연동.
- [ ] **장비 기믹 시스템 (Equipment)**: 단순 스탯을 넘어 이동력, 높이 극복, 속성 지면 무효화 등을 제공하는 유틸리티 착용품 적용.
- [ ] **유닛 레벨업 + 성장률**: 전투 후 경험치, 레벨업 스탯 계산 (`growthRates`).

---

## Phase 4: Stage & Flow Control (스테이지 및 룰 제어)

- [ ] **다변화된 승/패 조건**: 적 전멸 외 "특정 지점 도달", "턴 버티기", "NPC 호위", "보스 암살" 등 GameRule 플로우 확장.
- [ ] **다중 스테이지**: StageSelectScene + 스테이지 2+ 맵 데이터.
- [ ] **대화/컷씬 시스템**: → `docs/todo/implement-dialogue-system.md`
- [ ] **세이브/로드**: IndexedDB 직렬화 (BattleState JSON → 저장/복원).
- [ ] **모바일 터치 인풋**: Capacitor target을 위한 터치 이벤트 처리.

---

## Tech Debt / Infrastructure

- [ ] **IRenderer 완전 분리**: BattleCoordinator가 IRenderer 인터페이스만 의존하도록. → `docs/todo/implement-irenderer.md`
- [ ] **Spatial Hash Grid**: 배열 검색을 2D 공간 분할표로 교체 (대형 맵 성능).
- [ ] **테스트 커버리지 확대**: 현재 69.67% (`src/systems/**`). AStarWorker/PathfindingWorkerClient는 Node 환경 한계로 0% 유지.
- [ ] **undo UI**: GameStore의 `stateHistory` 버퍼(50 entries)를 실제 Undo 버튼으로 연결.
