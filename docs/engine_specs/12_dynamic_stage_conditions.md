# Engine Spec: GameRule & Dynamic Win/Loss Conditions

> Target: Advanced stage flow beyond "Defeat All Enemies"

## 1. Game Design Perspective (Why we need this?)

A tactical RPG lives and dies by its mission variety. If every map is "kill them all", the tactical depth is wasted. We must support missions like:

- **Assassination**: Kill only the boss, ignoring the infinite spawning grunts.
- **Survival**: Survive for 10 turns.
- **Escape / Reach**: A specific unit (or any unit) must reach a highlighted tile zone.
- **Escort**: Ensure a specific NPC reaches a designated point without dying.
- **Defense**: Prevent any enemy from entering a designated zone for N turns.

## 2. Architecture: `StageConditionSystem`

Instead of hardcoding logic into `TurnManager` or `BattleCoordinator`, we will introduce a `StageConditionSystem` that evaluates the `BattleState` at the end of every `TurnEnded` action.

### 2.1 JSON Definition (in MapData)

```json
{
  "id": "stage_02",
  "winConditions": [
    { "type": "defeat_target", "targetUnitId": "boss_kael" },
    { "type": "reach_tile", "targetUnitId": "any_ally", "x": 10, "y": 15 }
  ],
  "lossConditions": [
    { "type": "all_allies_defeated" },
    { "type": "turn_limit", "maxTurns": 20 }
  ]
}
```

_Note: Conditions in an array are treated as OR (achieve any to trigger). For AND logic, we will introduce a `condition_group` type later if needed._

### 2.2 `WinCondition` Interface

```typescript
export type ConditionType =
  | "defeat_all_enemies"
  | "all_allies_defeated"
  | "defeat_target"
  | "protect_target"
  | "reach_tile"
  | "turn_limit_survived" // Win if max turns reached
  | "turn_limit_failed"; // Lose if max turns reached

export interface StageCondition {
  type: ConditionType;
  targetUnitId?: string;
  x?: number;
  y?: number;
  maxTurns?: number;
}
```

### 2.3 Evaluation Hook

In `GameStore` or `TurnManager`, whenever a turn ends (or a unit is defeated):

```typescript
const result = StageConditionSystem.evaluate(state);
if (result === "VICTORY") {
  EventBus.emit("victory", {});
} else if (result === "DEFEAT") {
  EventBus.emit("defeat", {});
}
```

## 3. Implementation Steps

1. Add `winConditions` and `lossConditions` fields to `MapData` type.
2. Create `src/engine/systems/stage/StageConditionSystem.ts`.
3. Implement evaluator functions for the 7 base condition types.
4. Hook the evaluator into the `TurnManager` state transitions (specifically checking for state changes before moving back to `PLAYER_IDLE` or `ENEMY_PHASE`).
5. Update `BattleCoordinator` to listen for `'victory'` and `'defeat'` events to trigger the respective UI scenes (`ResultScene`).
