# Pending Task Backlog

구현되지 않은 기능들의 백로그. 완료된 항목은 해당 `engine_specs/` 문서 혹은 `demo_game/` 문서로 이동하거나 삭제.
세부 구현 계획이 있는 항목은 별도 `docs/todo/*.md` 파일로 분리.

> **[CRITICAL RULE: 설계 우선 원칙]**
> **어떠한 개발적, 아키텍처적, 기술적 기능 구현이든, 코드를 작성하기 전에 반드시 해당 시스템에 대한 기획/설계 문서를 먼저 작성하거나 업데이트한 후 그 기준에 맞춰 진행해야 합니다.** (Design-First Approach)

---

## ✅ 완료된 과제 (Completed)

- [x] **Phase R-1: GameProjectLoader 및 엔진 의존성 분리** → `docs/engine_specs/11_game_project_loader.md` ✅
- [x] **Phase 4: 다변화된 승패 조건 (GameRule 플로우 확장)** → `docs/engine_specs/12_dynamic_stage_conditions.md` ✅
- [x] **다중 스테이지 및 StageSelectScene (Campaign Flow)** → `docs/engine_specs/14_campaign_stage_flow.md` ✅
- [x] **전투 진행 상태 저장/불러오기 (Save/Load)** → `docs/engine_specs/13_save_load_system.md` ✅
- [x] **링 메뉴(Ring Menu) 마감 및 UI/UX 폴리싱** ✅

## ⚔️ Phase 4.5: AP 시스템 오버홀 (Hit and Run & Dynamic Hovering) ✅

새로 확립된 기획에 따른 AP 스케일링, 히트 앤 런, 다이나믹 호버링 구현.

- [x] **Dynamic Hovering (다이나믹 호버링)**: 이동 가능 타일(파란색)에 마우스를 올리면 잔여 AP를 계산하여 해당 위치 기준의 공격 범위(빨간색/주황색 등)를 실시간 렌더링 (`BattleCoordinator` & `RangeRenderer` 연동).
- [x] **AP 성장 곡선 및 Full Replenishment**: 유닛 데이터(`UnitData`)에 `maxAP` 성장 수치 반영. 턴 시작 시 AP를 무조건 가득 채우되(`currentAP = maxAP`), 남은 AP 이월(Carry-over) 로직 제거.
- [x] **Hit and Run 기반 턴 플로우**: 1회 공격 후 턴이 강제 종료되지 않고, AP가 남아있다면 다시 이동 로직(MoveState)으로 돌아갈 수 있도록 `BattleCoordinator` 상태 머신 업데이트.
- [x] **링 메뉴 UI 업데이트**: 잔여 AP에 따라 스킬 사용 가능 여부 판별 (AP 부족 시 아이콘/텍스트 Gray-out 처리 및 선택 불가 처리).

### Phase 4.5 버그픽스 & UX 개선 ✅ (2026-02-27)

- [x] **AP 취소 시 미복원 버그 수정**: `MoveAction.execute()` 내부로 AP 차감 이전. `dispatchAsync` 선차감이 `stateHistory`를 우회하던 근본 원인 제거. → `MoveAction(cost)` 파라미터 추가. (`01_core_battle.md §2-3` 참조)
- [x] **방향 선택 UI 잔류 버그 수정**: `onCancel()` 최상단에 `renderer.hideFacingSelection()` 추가. Facing 화살표는 state 롤백으로 소거 불가한 순수 Phaser Graphics 오브젝트.
- [x] **3-Zone Static Reachability Overlay**: 유닛 선택 즉시 Zone A(청록/이동+공격가능) · Zone B(흐린파랑/이동만) · Zone C(어두운빨강/공격도달영역) 3구역 정적 렌더링. 호버는 Zone A 타일에서 정밀 공격 범위 하이라이트로 보조. → `06_action_menu_ui.md §4` 참조.
- [x] **호버 `inputMode` 조건 수정**: `'idle'` → `'move'`로 수정 (setSelectedUnit이 항상 'move'로 세팅하므로 기존 조건은 never-reached였음). AP 비용 텍스트(`showAPPreview`) 연결 완료.

---

## 🚀 Phase 5: RPG Progression (성장 시스템) — 1순위

의존성 순서: 레벨업 → 장비 → 직업 (이전 시스템이 다음의 기반)

### 5-1. 유닛 레벨업 + 성장률 ✅

→ **설계**: `docs/engine_specs/15_levelup_growth.md`

- [x] `LevelUpSystem.ts` 구현 — EXP 계산, 성장률 기반 스탯 증가, 최소 보장 로직
- [x] `UnitInstance`에 `exp` 필드 추가
- [x] `ResultScene` 연동 — 전투 후 EXP 분배 + 레벨업 패널 표시 (`distributeStageEXP` → store dispatch → levelup panel) ✅ 2026-02-27
- [x] 유닛 데이터에 `growthRates`/`baseStats` 확인 완료
- [x] 테스트: `tests/progression/LevelUpSystem.test.ts` (16 tests)

### 5-2. 장비 기믹 시스템 ✅

→ **설계**: `docs/engine_specs/16_equipment_system.md`

- [x] `EquipmentData` 타입 + `equipment.json` (10개 아이템)
- [x] `EquipmentSystem.ts` — 장착/해제/최종 스탯 계산/패시브 수집
- [x] `UnitInstance.equipment` 슬롯 추가
- [x] `DamageCalc`에 장비 스탯 보정 연동 — `AttackAction` + `SkillAction` + `BattleCoordinator` preview ✅ 2026-02-27
- [x] `BFS movRange`에 장비 이동력 보정 반영 — `PathfindingWorkerClient` movBudget + `AStarWorker` override ✅ 2026-02-27
- [x] 테스트: `tests/equipment/EquipmentSystem.test.ts` (11 tests)

### 5-3. 클래스 트리 및 전직 (Job System) ✅

→ **설계**: `docs/engine_specs/17_job_class_system.md`

- [x] `JobData` 타입 + `jobs.json` (9개 직업, 2 티어)
- [x] `JobSystem.ts` — 전직/스킬 계승/성장률 보정/아이템 소모
- [x] 전직 UI — `ResultScene` 레벨업 패널 이후 promotable 유닛 순차 표시 (PROMOTE/SKIP) ✅ 2026-02-27
- [x] 성장률 보정 (`getModifiedGrowth`)
- [x] 테스트: `tests/progression/JobSystem.test.ts` (15 tests)

---

## 🤖 Phase 6: AI 확장 — 2순위 ✅

### 6-1. 적 타입별 AI 성격 ✅

→ **설계**: `docs/engine_specs/18_ai_personality.md`

- [x] `AIPersonality` 타입 (aggressive/defensive/support/hit_and_run/boss/patrol) 확장
- [x] `AIConfig` 인터페이스 구현 — 감지 범위, 거점, 순찰 경로
- [x] `AIScorer.ts` 가중치 매핑 — 성격별 이동/공격/스킬/후퇴 가중치
- [x] `EnemyAI.ts` 분기 처리 — `personality` 기반 행동 선택
- [x] 맵 데이터에 `aiConfig` 필드 적용 (`units_enemies.json`에서 base config 설정 완료)
- [x] 테스트: `tests/ai/AIPersonality.test.ts` (10 tests)

---

## 🎨 Phase 7: Visual Polish — 3순위 ✅

→ **설계**: `docs/engine_specs/19_vfx_camera_minimap.md`

### 7-1. 파티클 VFX ✅

- [x] `VFXManager.ts` — Phaser ParticleEmitter 래핑
- [x] `VFXConfig` 데이터 구조 + `vfx.json`
- [x] `SkillData.vfxId` 필드 추가, `BattleCoordinator` 연동
- [x] 기본 이펙트: 베기, 화염, 힐 스파클, 버프 오라

### 7-2. 카메라 팬 & 줌 ✅

- [x] `CameraController.ts` — 드래그 팬, 휠 줌 (0.5x~2.0x)
- [x] AI 턴 시 자동 유닛 포커스 팬
- [x] 맵 경계 제한 (스크롤 범위 클램프)

### 7-3. 미니맵 ✅

- [x] `MinimapDisplay.ts` — RenderTexture 기반 축소맵
- [x] 아군/적군 마커 (색상 구분 + 선택 유닛 깜빡임)
- [x] 클릭 시 카메라 이동 연동

---

## 📝 Phase 8: 콘텐츠 & 기획 — 4순위

- [ ] **수치 밸런스 테이블**: `docs/demo_game/01_balance_tables.md` — HP/ATK 커브, AP/CT 공식, EXP 테이블
- [ ] **세계관 및 시놉시스**: `docs/demo_game/02_world_narrative.md` — 챕터별 플롯, 캐릭터 시트
- [ ] **오디오 에셋 매핑**: `docs/engine_specs/07_audio_framework.md` 리소스 계획
- [ ] **튜토리얼 기획**: `docs/demo_game/03_tutorial_onboarding.md` — 단계별 안내 흐름

---

## 🔧 Tech Debt — 병행 진행

- [x] **Undo UI 연결**: Z key → `coordinator.onCancel()` 바인딩 완료 ✅ 2026-02-27
- [x] **테스트 커버리지 확대**: 69.67% → **83.44%** (320 tests). Integration test infra 구축 완료 ✅ 2026-02-27
- [ ] **모바일 터치 인풋**: Capacitor 타겟 터치 이벤트 처리
- [ ] **Spatial Hash Grid**: 대형 맵 성능을 위한 2D 공간 분할 인덱스

---

## 📐 Engine Spec Index (설계 문서 목록)

| #   | 문서                                        | 상태         |
| --- | ------------------------------------------- | ------------ |
| 01  | `core_battle.md` — 전투 코어                | ✅ 구현됨    |
| 02  | `renderer_architecture.md` — 렌더러         | ✅ 구현됨    |
| 03  | `advanced_tactics.md` — EffectNode 시스템   | ✅ 구현됨    |
| 04  | `state_commands_hooks.md` — 상태 커맨드     | ✅ 구현됨    |
| 05  | `scene_coordinator.md` — 씬 코디네이터      | ✅ 구현됨    |
| 06  | `action_menu_ui.md` — 액션 메뉴 UI          | ✅ 구현됨    |
| 07  | `audio_framework.md` — 오디오               | 📝 설계만    |
| 08  | `metagame_loop.md` — 메타게임 루프          | 📝 설계만    |
| 09  | `difficulty_accessibility.md` — 난이도      | 📝 설계만    |
| 10  | `dialogue_system.md` — 대화 시스템          | ✅ 구현됨    |
| 11  | `game_project_loader.md` — GameProject      | ✅ 구현됨    |
| 12  | `dynamic_stage_conditions.md` — 승패 조건   | ✅ 구현됨    |
| 13  | `save_load_system.md` — 세이브/로드         | ✅ 구현됨    |
| 14  | `campaign_stage_flow.md` — 캠페인 흐름      | ✅ 구현됨    |
| 15  | `levelup_growth.md` — 레벨업/성장           | ✅ 구현됨    |
| 16  | `equipment_system.md` — 장비 시스템         | ✅ 구현됨    |
| 17  | `job_class_system.md` — 직업 트리           | ✅ 구현됨    |
| 18  | `ai_personality.md` — AI 성격               | ✅ 구현됨    |
| 19  | `vfx_camera_minimap.md` — VFX/카메라/미니맵 | ✅ 구현됨    |
