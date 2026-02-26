# Engine Spec: Save / Load (IndexedDB)

> Target: Persistent battle state recovery

## 1. Game Design Perspective

Mobile and web tactical RPGs must be resilient to unexpected closures (browser refresh, app crashes). Additionally, providing mid-battle save points lowers the frustration of complex, 30-minute long maps.

## 2. Technical Strategy: Immediate Persistence

The `BattleState` managed by Immer is entirely composed of plain JavaScript objects (Data-Driven architecture). This means it is natively serialize-able to JSON without any special revivers or class instantiations.

### 2.1 Storage Mechanism

We will use an `IndexedDB` wrapper (e.g., `idb-keyval` or a custom lightweight indexDB wrapper) rather than `localStorage`. `BattleState` can easily exceed the 5MB string limit of local storage, especially with large `stateHistory` arrays.

### 2.2 Trigger (When to save)

We do not want to save on every single tick or animation micro-state. The optimal time to save constitutes the "end of a discrete action":

- After a `TurnEnded` action.
- After a valid `MoveAction` or `SkillAction` is fully processed and `ActionEnded` is dispatched.

Since all state changes flow through `GameStore.dispatch()`, we can create a persistence middleware:

```typescript
// GameStore.ts
export function dispatch(action: GameAction) {
  // ... apply action ...

  if (action.type === "TurnEnded" || action.type === "SkillAction") {
    requestIdleCallback(() => {
      SaveManager.autoSave(store.getState());
    });
  }
}
```

## 3. The Save Data Structure

```typescript
interface AutoSaveSlot {
  timestamp: number;
  gameId: string; // Ensures we don't load a "Chronicle" save in another game
  mapId: string; // To render the correct background
  turnNumber: number;
  battleState: BattleStateSnapshot;
}
```

_Note: `BattleStateSnapshot` excludes ephemeral UI states (like active menus) but includes unit stats, positions, buffs, AP, CT, and `stateHistory`._

## 4. Resuming execution

1. From `TitleScene`, player clicks "Continue".
2. Read the `AutoSaveSlot`.
3. Load the corresponding `GameProject` via `GameProjectLoader` (using the `gameId`).
4. Inject the `BattleState` explicitly into `GameStore.restore(savedState)`.
5. Enter `BattleScene`—the renderer will automatically draw the map and sync units according to the restored state.

## 5. Security & Validation

Saves must not be trusted implicitly.

- If `engineVersion` mismatches, warn the user.
- Provide a simple format version check.
- On Web, users might modify IndexedDB; server-side validation is irrelevant since this is a client-side offline-first engine (unless exporting to a server-authoritative context later).
