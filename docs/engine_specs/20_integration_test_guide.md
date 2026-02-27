# Engine Spec 20 — Integration & Balance Test Guide

> **Status**: ✅ Implemented (2026-02-27)
> **Coverage target**: ≥ 80% statements (current: 83.44%)
> **Test count**: 320 (54 integration + 266 unit)

---

## 1. Overview: Two Tiers of Testing

| Tier | Location | What it tests | How it runs |
|------|----------|---------------|-------------|
| **Unit tests** | `tests/<system>/` | Individual system functions in isolation | Direct function call |
| **Integration tests** | `tests/integration/` | Full `store.dispatch(action)` pipelines, no browser/Phaser | Headless Node.js via Vitest |

Integration tests are the primary tool for **balance verification** and **regression detection** across the full combat pipeline. They drive the engine exactly as the game does — via `GameStore.dispatch(action)` — and read back `store.getState()` to assert on numbers.

**Key characteristic**: No Phaser, no browser, no mouse events. Pure TypeScript in Node.js. Fast (~160 ms for all 54 integration tests).

---

## 2. Architecture

```
test file
  │
  ├─ buildStore(allySpawns, enemySpawns)   ← helpers.ts factory
  │     └─ GameStore.init(MapData, GameProject)
  │           └─ createUnit() × N
  │
  ├─ store.dispatch(new MoveAction(...))   ← same path as real game
  ├─ store.dispatch(new AttackAction(...))
  ├─ store.dispatch(new SkillAction(...))
  │
  └─ store.getState()                      ← assert HP, EXP, phase, etc.
```

**No mocking of game logic** — DamageCalc, BuffSystem, TurnManager, EffectNodeRunner all run with real code. The only mock is `SaveManager` (uses IndexedDB, unavailable in Node):

```typescript
vi.mock('@/engine/systems/save/SaveManager', () => ({
  SaveManager: { save: vi.fn(), load: vi.fn() },
}));
```

---

## 3. Test Infrastructure Files

### `tests/integration/helpers.ts`

Core factory functions. Import these in every integration test.

```typescript
// Build a minimal UnitData
makeUnitData(id, team, overrides?)

// Build a GameStore with pre-placed units
// Returns: { store, allyIds, enemyIds }
buildStore(allySpawns, enemySpawns, options?)

// Build a raw MapData (used internally by buildStore)
makeTestMap(allySpawns, enemySpawns, width?, height?, winType?, terrainGrid?)

// Build a minimal GameProject (used internally by buildStore)
makeTestProject(units)

// Drive turns until predicate is true
advanceTurnUntil(store, predicate, maxIterations?)
```

**ID conventions** (critical for test assertions):
- Ally instanceId = `data.id` (e.g., `'attacker'`)
- Enemy instanceId = `${data.id}_${index}` (e.g., `'defender_0'`)

### `src/engine/renderer/NullRenderer.ts`

`IRenderer` no-op stub. All methods are silent. Async methods resolve immediately. Used whenever a `BattleCoordinator` instance is needed in tests (it requires an `IRenderer`). Integration tests that only use `GameStore.dispatch()` directly do not need this.

---

## 4. Test Files and What They Cover

| File | Scope | Key Assertions |
|------|-------|----------------|
| `AttackPipeline.test.ts` | Attack/Move/Wait dispatch chain | HP delta, EXP grant, level-up on kill, `undoUnitMoves()` restore, WaitAction AP drain |
| `TurnFlow.test.ts` | CT-based turn queue, phase FSM | Fastest unit acts first, AP reset on turn start, player→enemy→player cycle, `turnStarted` event |
| `BalanceScenario.test.ts` | Deterministic damage numbers | Exact damage values, equipment bonuses, terrain defense reduction, `DamageCalc.preview()` matches dispatch |
| `WinCondition.test.ts` | Stage end conditions | Kill-all → VICTORY, all-allies-dead → DEFEAT, post-VICTORY no-op |
| `SkillFacingAction.test.ts` | Skill type pipeline | Heal cap, MP cost guard, buff/debuff stat change, kill → `unitDefeated` event, `FacingAction` direction |
| `ZocPipeline.test.ts` | MoveAction path + ZOC | Path traversal with no ZOC, ZOC halt at adjacent tile, `wasInZoc` branch, `lae` log event |
| `ReactionSystem.test.ts` (in `tests/combat/`) | Counter-attack + chain-assist | 800 ms timer dispatch, dead-defender guard, no-activeUnit guard, chain-depth limit |

---

## 5. Balance Verification Workflow

### 5-1. Deterministic Damage

Random variance and crits must be eliminated for exact balance assertions.

```typescript
import { MathUtils } from '@/engine/utils/MathUtils';

beforeEach(() => {
  // rand() → 0.5: variance = 0.88 + 0.5 × 0.24 = 1.0 (exact base damage)
  // 0.5 > typical critChance (~0.135) → no crit
  vi.spyOn(MathUtils, 'rand').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### 5-2. Damage Formula Reference

```
dmg = max(1, round(atk - def × 0.6) × variance × affMult)
    where variance = 0.88 + rand() × 0.24
    and   affMult  = AffinityTable.getMultiplier(attackerAffinity, defenderAffinity)
```

With `rand() = 0.5`: `variance = 1.0`, so `dmg = max(1, round(atk - def × 0.6) × affMult)`.

### 5-3. FRONT Hit Setup

To eliminate side/back attack bonus in balance tests, ensure the attacker hits from the FRONT:

```typescript
// Attacker at (0, 1) → Defender at (0, 0) facing 'S' (default from createUnit)
// attackDir = 'N', defenderFacing = 'S', oppStr['N'] = 'S' → FRONT angle, no bonus
const { store, allyIds, enemyIds } = buildStore(
  [{ data: attacker, x: 0, y: 1 }],  // one tile south of defender
  [{ data: defender, x: 0, y: 0 }],  // faces S by default
);
```

### 5-4. Writing a New Balance Test

```typescript
it('Soldier Lv1 (atk=10) vs Knight (def=8) on plains = 5 dmg', () => {
  const { store, allyIds, enemyIds } = buildStore(
    [{ data: makeUnitData('sol', 'ally', { baseStats: { ...defaults, atk: 10 } }), x: 0, y: 1 }],
    [{ data: makeUnitData('knt', 'enemy', { baseStats: { ...defaults, def: 8 } }), x: 0, y: 0 }],
  );
  const [casterId, targetId] = [allyIds[0]!, enemyIds[0]!];

  // atk=10, def=8, dmg = round(10 - 8 × 0.6) = round(5.2) = 5
  const expected = Math.round(10 - 8 * 0.6);

  store.dispatch(new AttackAction(casterId, targetId));

  const hpAfter = store.getState().units[targetId]!.hp;
  expect(hpAfter).toBe(defaults.hp - expected);
});
```

### 5-5. Equipment Bonus Test Pattern

```typescript
it('iron_sword (+2 atk) increases damage by 2', () => {
  const { store, allyIds, enemyIds } = buildStore(...);

  // Equip iron_sword (defined in equipment.json: +2 atk)
  store.dispatchAsync(null, draft => {
    draft.units[allyIds[0]!]!.equipment.weapon = 'iron_sword';
  });

  const withSword = attackAndGetDmg(store, allyIds[0]!, enemyIds[0]!);
  const withoutSword = expectedBaseDmg; // pre-calculated

  expect(withSword - withoutSword).toBe(2);
});
```

### 5-6. Terrain Defense Test Pattern

```typescript
it('forest terrain (defBonus=1) reduces incoming damage', () => {
  const forestGrid = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => (x === 0 && y === 0 ? 'forest' : 'plain')),
  );
  const { store, ... } = buildStore(allies, enemies, { terrainGrid: forestGrid });
  // defender at (0,0) is in forest → def effectively +1
  ...
});
```

---

## 6. Running Tests

```bash
# All tests (unit + integration)
npx vitest run

# With coverage report
npx vitest run --coverage

# Watch mode during active development
npx vitest --reporter=verbose

# Only integration tests
npx vitest run tests/integration/

# Specific file
npx vitest run tests/integration/BalanceScenario.test.ts
```

Coverage scope (vitest.config.ts):
```
src/engine/systems/**        ← all game logic systems
src/engine/state/actions/**  ← AttackAction, MoveAction, SkillAction, etc.
```

---

## 7. When to Add Integration Tests

| Trigger | What to add |
|---------|-------------|
| New `GameAction` class | At least one dispatch-and-assert test in `AttackPipeline.test.ts` or a dedicated file |
| New combat formula change | A deterministic test in `BalanceScenario.test.ts` verifying the exact number |
| New equipment item | Equipment bonus test in `BalanceScenario.test.ts` |
| New win/loss condition type | A test in `WinCondition.test.ts` |
| New skill type | Tests in `SkillFacingAction.test.ts` |
| New passive effect node | Tests in `ZocPipeline.test.ts` or a new pipeline file |
| Balance stat change | Update expected values in `BalanceScenario.test.ts` — failing tests = balance regression caught |

---

## 8. Known Limitations

| Limitation | Reason | Workaround |
|------------|--------|------------|
| `AStarWorker` / `PathfindingWorkerClient` uncovered (0%) | Web Worker APIs not available in Node.js | Expected 0% — excluded from coverage target |
| `SaveManager` requires mock | IndexedDB not available in Node.js | `vi.mock('@/engine/systems/save/SaveManager', ...)` in every integration test file |
| `setTimeout`-based reactions (ReactionSystem) | Need `vi.useFakeTimers()` + `vi.advanceTimersByTime()` | See `tests/combat/ReactionSystem.test.ts` |
| BattleCoordinator-based E2E (onTileClick → full pipeline) | Async busy-flag + Phaser dependency | Deferred — use `store.dispatch()` directly instead |
| Browser/Playwright E2E | Explicitly out of scope | Not planned; API-driven integration tests are preferred |

---

## 9. File Locations Summary

```
tests/
├── integration/                ← Headless API-driven battle simulation
│   ├── helpers.ts              ← buildStore(), makeUnitData(), factories
│   ├── AttackPipeline.test.ts  ← Core combat dispatch chain
│   ├── TurnFlow.test.ts        ← CT queue + phase FSM
│   ├── BalanceScenario.test.ts ← Deterministic damage verification ★
│   ├── WinCondition.test.ts    ← Victory/defeat conditions
│   ├── SkillFacingAction.test.ts ← Skill type coverage
│   └── ZocPipeline.test.ts     ← ZOC path interruption
├── combat/
│   └── ReactionSystem.test.ts  ← Counter-attack / chain-assist
├── ai/                         ← AIScorer, EnemyAI, ThreatMap unit tests
├── movement/                   ← BFS, DangerZone unit tests
├── progression/                ← LevelUp, JobSystem unit tests
└── ...

src/engine/renderer/
└── NullRenderer.ts             ← IRenderer no-op for headless tests
```
