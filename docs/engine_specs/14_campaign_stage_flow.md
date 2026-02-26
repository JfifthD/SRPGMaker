# Engine Spec: Multi-Stage Flow

> Target: Connecting stages into a cohesive campaign

## 1. Game Design Context

A single map is just a test environment. A Game requires a sequence of maps tied together by narrative. The flow typically works as follows:

```
[ TitleScreen ] -> (Load Profile) -> [ Stage Select / World Map ]
-> [ Scenario Dialogue (Pre-battle) ]
-> [ Battle Map ]
-> [ Scenario Dialogue (Post-battle) ]
-> (Reward / Level Up Screen)
-> [ Stage Select / World Map ]
```

## 2. Campaign State vs Battle State

Currently, we only have `BattleState`. To track player progression, we need a new global state slice: `CampaignState`.

### 2.1 Campaign State Structure

```typescript
export interface CampaignState {
  currentStageIdx: number; // Highest unlocked stage
  inventory: Record<string, number>; // Global items (potions, gold)
  roster: UnitInstance[]; // The player's permanent army
  flags: Record<string, boolean>; // Story progression flags
}
```

The `BattleState` initializes its ally units by drawing from the `CampaignState.roster` rather than creating fresh units from `UnitData` every map.

## 3. The Flow Architecture

1. **`StageSelectScene` (New)**: Displays a map or a list of unlocked stages based on `CampaignState.currentStageIdx`.
2. **Pre-battle Transition**: When a stage is selected, the engine checks for a `scenario` dialogue script linked to the stage start (e.g., `pre_stage_02`). If it exists, launch `DialogueScene`.
3. **Battle Phase**: Upon dialogue completion, transition to `BattleScene`. `BattleState` is initialized with the player's active roster.
4. **Post-battle Transition**: The `StageConditionSystem` fires `EventBus.emit('victory')`. `ResultScene` is shown, which applies XP and drops to `CampaignState.roster` and `CampaignState.inventory`.
5. Check for post-battle dialogue (e.g., `post_stage_02`). If exists, launch `DialogueScene`.
6. Return to `StageSelectScene`.

## 4. Saving the Campaign

Unlike the mid-battle Auto-Save, `CampaignState` represents permanent progression. It must be explicitly saved to IndexedDB at the `ResultScene` before returning to the World Map.
