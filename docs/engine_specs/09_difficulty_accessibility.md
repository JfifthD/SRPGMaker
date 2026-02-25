# Difficulty & Accessibility Modifier API

SRPG Maker 엔진은 숙련도가 다른 다양한 유저층을 수용하기 위해, 스탯 하드코딩을 뜯어고치지 않고도 게임 전체의 난이도를 유연하게 조절할 수 있는 **전역 난이도 수정자(Global Modifier)** 인터페이스를 제공합니다.

## 1. Difficulty Modifiers (난이도 곱연산 스키마)

메이커 사용자는 게임 시작 시 유저가 선택할 수 있는 `난이도 프리셋` 배열을 JSON으로 정의하여 엔진에 주입합니다. 엔진 내부의 각종 계산식(DamageCalc, Entity Spawner 등)은 계산의 마지막 단계에서 이 Modifier 값을 참조하여 최종 결과값을 보정합니다.

```json
{
  "difficulty_presets": [
    {
      "id": "casual",
      "display_name": "초심자",
      "modifiers": {
        "enemy_atk_mult": 0.8,
        "enemy_hp_mult": 0.8,
        "exp_gain_mult": 1.5,
        "permadeath": false,
        "ai_behavior_profile": "defensive" // AI의 선택 가중치 변동
      }
    },
    {
      "id": "hard",
      "display_name": "매니아",
      "modifiers": {
        "enemy_atk_mult": 1.2,
        "enemy_hp_mult": 1.1,
        "exp_gain_mult": 1.0,
        "permadeath": true,
        "ai_behavior_profile": "aggressive"
      }
    }
  ]
}
```

## 2. 접근성(Accessibility) 플러그인 훅

UI/UX 차원의 시각 보조 및 편의성 기능들은 `BattleScene` 및 `UIScene` 외부에서 주입되는 파라미터로 제어됩니다. 이 옵션들은 언제든 `SettingsStore`를 통해 실시간 토글이 가능해야 합니다.

### 2-1. 시각 및 가독성 (Render Hints)

- 엔진 내 텍스트 출력 컴포넌트는 전역 `Accessibility.fontSizeMult` 값에 따라 폰트 사이즈를 동적으로 스케일링해야 합니다.
- 타일 하이라이트 레이어 렌더링 시, `Accessibility.colorBlindMode` 가 활성화 되어있다면 단순 색상(Red/Blue) 렌더링에 빗금 패턴 재질(Texture) 코드를 추가 교차 렌더링하도록 `IRenderer.highlightTiles()` 구현체에 강제합니다.

### 2-2. QoL 제어 (전송 배속 및 언두)

엔진 코어 단의 속도와 편의성 제어 변수들입니다.

- **Speed Multiplier:** 모든 렌더러 애니메이션(Promise 딜레이) 시간과 내부 틱 간격에 적용되는 `TimeScale` 상수 값을 제공합니다. (예: 1.5x, 2.0x 배속)
- **Undo Buffer 제약:** `GameStore`에 이미 구현된 `stateHistory` 버퍼(Max 50)를 참조하되, RuleSet의 난이도 설정(`allow_undo: false` 또는 `max_undo_charges: 3`) 파라미터에 따라 UI상의 뒤로가기 버튼 활성화를 제어하는 책임을 UI 레이어에 부여합니다.
