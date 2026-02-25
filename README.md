# Chronicle of Shadows

TypeScript + Vite + Phaser 3 기반 SRPG 프로젝트.

## 빠른 시작

```bash
# 1. 의존성 설치 (Node.js 18+ 필요)
npm install

# 2. 개발 서버 실행 → http://localhost:3000
npm run dev

# 3. 프로덕션 빌드
npm run build

# 4. 테스트 실행
npm test
```

## 프로젝트 개요

본 프로젝트는 단일 파일로 구성된 프로토타입에서 출발하여, 프로덕션 레벨의 확장 가능한 구조로 이식하는 것을 목표로 합니다.
핵심 기술 스택은 **TypeScript, Vite, Phaser 3**를 사용하며, 향상된 유지보수성과 게임 기능 확장을 위해 아래와 같은 아키텍처 패턴을 따릅니다.

- **불변 상태 및 Command 패턴**: Undo, Replay, Save/Load 지원
- **FSM (유한 상태 머신)**: 엄격한 전투 턴 전이 제어
- **Event Bus 커뮤니케이션**: 로직과 렌더링/오디오의 결합 해제
- **Data-driven 구성**: 하드코딩된 로직 지양, 유닛/스킬/맵의 JSON 분리

## 문서 가이드 (디버깅 / 구조 파악)

세부 설계 철학과 아키텍처 가이드는 `docs/` 폴더 내에 분리하여 관리하고 있습니다. 프로젝트 아키텍처나 구조 파악이 필요할 경우 아래 문서를 반드시 확인하세요.

👉 **[문서 인덱스 (Doc Index) 보기](docs/index.md)**
👉 [Core Architecture 가이드](docs/architecture.md)

## 에이전트 개발 규칙 (AI Rules)

본 프로젝트는 AI 에이전트(Antigravity 등)와의 협업을 최적화하기 위해 `RULES.md`와 `docs/index.md` 기반의 컨텍스트 로딩 시스템을 사용합니다. AI는 이 인덱스를 참조하여 필요한 문서만 로드함으로써 토큰을 최적화하고 장기 기억을 유지합니다. 개발 중 주요 구조 변경 사항이 생기면 항상 `docs/` 문서를 현행화하여 AI의 장기 기억을 보존합니다.
