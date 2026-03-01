# Engine Spec 26 — Time System & Multi-Battle Resolution

> World turn ↔ battle turn mapping, simultaneous battles, auto-battle resolver.

---

## 1. Time Model

```
World Turn 1 ═══════════════════════════════════╗
║                                                ║
║  Player Phase (actions)                        ║
║  ↓                                             ║
║  AI Factions Phase (actions)                   ║
║  ↓                                             ║
║  Resolution Phase                              ║
║  ├─ Army movements resolve                     ║
║  ├─ Collisions detected → BattleContext[]      ║
║  ├─ Resources collected                        ║
║  ├─ Upgrades progress                          ║
║  └─ Wandering generals spawn check             ║
║  ↓                                             ║
║  Battle Phase                                  ║
║  ├─ Battle A: Manual (player commands)         ║
║  ├─ Battle B: Auto (headless)                  ║
║  └─ Battle C: Auto (headless)                  ║
║  ↓                                             ║
║  Results Applied to WorldState                 ║
║  ↓                                             ║
║  Day += 30, Turn += 1                          ║
║  ↓                                             ║
║  Win/Lose check                                ║
║                                                ║
╚════════════════════════════════════════════════╝
```

### 1.1 Core Constants

```typescript
const DAYS_PER_WORLD_TURN = 30;
const MAX_BATTLE_TURNS = 30;
const MAX_DEPLOY_PER_SIDE = 50;
```

### 1.2 State Machine

```typescript
type WorldPhase =
  | 'player_actions'     // Player gives orders
  | 'ai_actions'         // AI factions act
  | 'resolution'         // Movement + collision detection
  | 'battle_selection'   // Player chooses which battles to command
  | 'battle_active'      // SRPG battle in progress
  | 'results'            // Apply all battle outcomes
  | 'advance';           // Tick time, produce resources, check win/lose
```

---

## 2. Battle Context

When armies collide (or army attacks territory), a `BattleContext` is created:

```typescript
interface BattleContext {
  id: string;                       // Unique battle id
  type: 'siege' | 'field';          // Territory attack or route interception
  territoryId: string | null;       // If siege, which territory
  edgeId: string | null;            // If field, which edge

  attacker: BattleParty;
  defender: BattleParty;

  mode: 'manual' | 'auto';         // Player's choice (only for player-involved battles)
  battleMapId: string;              // Resolved map

  // After resolution
  result?: BattleResult;
}

interface BattleParty {
  factionId: string;
  armyId: string;
  generals: GeneralState[];
  totalTroops: number;              // Sum of leadership * 1000
  commanderId: string;              // Highest leadership
}

interface BattleResult {
  winnerId: string;                 // Faction id
  loserId: string;
  turns: number;                    // How many battle turns it took
  attackerCasualties: CasualtyReport;
  defenderCasualties: CasualtyReport;
  territoryCaptured: boolean;
  generalResults: GeneralBattleResult[];   // Per-general HP tracking
}

interface CasualtyReport {
  totalTroopsLost: number;
  generalReports: GeneralCasualtyDetail[];
}

interface GeneralCasualtyDetail {
  generalId: string;
  troopsLost: number;               // HP%-based calculation
  hpPercent: number;                 // Final HP / Max HP (0.0 ~ 1.0)
  wasDefeated: boolean;              // HP reached 0
  died?: boolean;                    // Permanent death (rolled post-battle)
  injury?: { turns: number; severity: 'light' | 'moderate' | 'severe' };
}
```

---

## 3. Multi-Battle Resolution

### 3.1 Battle Ordering

When multiple battles trigger in the same world turn:

```
1. Identify all BattleContext[] from collision resolution
2. Categorize:
   a. Player-involved (player faction is attacker or defender)
   b. AI-only (between two AI factions)
3. AI-only battles: auto-resolve immediately (headless)
4. Player-involved battles: player chooses which to command (max 1 manual per turn)
5. Player can delegate all to auto → no manual battles
```

### 3.2 Battle Selection UI

```
┌──────────────────────────────────────────────┐
│  ⚔️ BATTLES THIS TURN (3 detected)           │
├──────────────────────────────────────────────┤
│                                               │
│  1. Siege of Northern Bastion                 │
│     Aldora (8,000) vs Shadow Legion (12,000)  │
│     [COMMAND]  [DELEGATE]                     │
│                                               │
│  2. Field Battle — Forest Road                │
│     Aldora (5,000) vs Northern Clans (4,000)  │
│     [COMMAND]  [DELEGATE]                     │
│                                               │
│  3. Defense of Port Haven                     │
│     Aldora (6,000) vs Shadow Legion (3,000)   │
│     [COMMAND]  [DELEGATE]                     │
│                                               │
│  [Delegate All — Auto-Resolve]                │
└──────────────────────────────────────────────┘
```

Player clicks "COMMAND" on the most important battle. Others auto-resolve.
All battles resolve within the same world turn.

### 3.3 Battle Order Execution

```
For each battle in priority order:
  1. If mode == 'manual':
     → DeploymentScene → BattleScene → ResultScene
     → Player plays SRPG combat (max 30 turns)
     → Result written to BattleContext.result
  2. If mode == 'auto':
     → AutoBattleResolver.resolve(context)
     → Instant result
  3. Apply result to WorldState:
     - Winner takes territory (if siege)
     - Losers retreat to nearest friendly territory
     - Casualties applied (troops, general injuries)
     - Morale effects
```

---

## 4. Auto-Battle Resolver

### 4.1 Architecture

Reuses existing engine systems:

```typescript
class AutoBattleResolver {
  resolve(context: BattleContext, gameProject: GameProject): BattleResult {
    // 1. Build BattleState from context
    const mapData = this.loadBattleMap(context.battleMapId);
    const units = this.deployUnits(context, mapData);
    const state = this.buildInitialState(mapData, units, gameProject);

    // 2. Create headless game store
    const store = new GameStore();  // Separate instance, not the global one
    store.init(mapData, gameProject, state);

    // 3. Run battle with EnemyAI controlling both sides
    let turnCount = 0;
    while (turnCount < MAX_BATTLE_TURNS) {
      // Both sides use EnemyAI
      const actions = EnemyAI.decideTurn(store.getState(), currentTeam);
      for (const action of actions) {
        store.dispatch(action);
      }
      store.nextTurn();
      turnCount++;

      // Check termination
      const outcome = checkBattleOutcome(store.getState());
      if (outcome) return this.buildResult(context, outcome, turnCount);
    }

    // 30 turns exhausted: attacker retreat (siege fails) or draw (field)
    return this.buildTimeoutResult(context, turnCount);
  }
}
```

### 4.2 Key Properties

- **No rendering**: Uses `NullRenderer` (existing)
- **Deterministic**: Same inputs = same result (seeded RNG)
- **Fast**: No animation delays. 30 turns resolves in <100ms
- **Replayable**: Store action history. Player can request replay later.
- **Separate GameStore instance**: Does NOT touch the global `store` singleton

### 4.3 Strength Estimation (Quick Preview)

Before auto-resolving, show player an estimated win probability:

```
winProbability = attackerStrength / (attackerStrength + defenderStrength)

where strength = sum of:
  - Each general: (atk + def + spd + skl) * level
  - Commander buff: * (1 + leadership * 1 / 100)    // 1% per point (max 20%)
  - Territory defense: defender gets * (1 + defenseBonus / 100)
  - Troop count factor: * sqrt(totalTroops / 1000)
```

This is a heuristic for UI display only — actual auto-battle uses the full combat simulation.

---

## 5. Battle Turn ↔ World Time Mapping

### 5.1 Visual Timeline

During resolution phase, show a 30-day timeline:

```
Day 1  ──── Day 5 ────── Day 15 ──────── Day 25 ── Day 30
  │           │              │                │        │
  ↓           ↓              ↓                ↓        ↓
Armies     Battle A      Battle B         Battle C   Resources
 move       starts        starts          ends       collected
```

Each battle occupies some portion of the 30-day period:
- Battle with 10 turns ≈ 10 days
- Battle with 30 turns ≈ 30 days (full month)
- Battles can overlap in time if on different fronts

### 5.2 Time Display

```typescript
interface WorldTimeDisplay {
  turn: number;         // World turn number
  day: number;          // turn * 30
  season: 'spring' | 'summer' | 'autumn' | 'winter';  // day % 360 / 90
  year: number;         // day / 360
}
```

Seasons can affect:
- Movement cost (winter = +50% move cost on mountain/snow edges)
- Production (winter = -30% food)
- Battle effects (snow terrain debuff)

[DISCUSS] Whether to implement seasonal effects in MVP or defer.

---

## 6. Post-Battle Effects

### 6.1 Winner

- **Siege victory**: Attacker captures territory. Owner changes.
- **Field victory**: Loser retreats. Winner holds position.
- **Territory defense**: Defender holds. Attacker retreats.

### 6.2 Troop Casualties (HP%-Based)

Troop losses are derived from actual SRPG battle results — each general's unit HP at battle end determines how many troops they lost.

```typescript
interface GeneralBattleResult {
  generalId: string;
  maxHp: number;
  finalHp: number;           // 0 = unit was defeated
  wasDefeated: boolean;      // HP reached 0 at some point
}

function calculateTroopCasualties(
  generalResults: GeneralBattleResult[],
  party: BattleParty,
): CasualtyReport {
  let totalTroopsLost = 0;
  const generalReports: GeneralCasualtyDetail[] = [];

  for (const gr of generalResults) {
    const general = party.generals.find(g => g.id === gr.generalId)!;
    const troopsPerGeneral = general.leadership * 1000;
    const hpPercent = gr.finalHp / gr.maxHp;                    // 0.0 ~ 1.0
    const troopsLost = Math.floor(troopsPerGeneral * (1 - hpPercent));

    totalTroopsLost += troopsLost;
    generalReports.push({
      generalId: gr.generalId,
      troopsLost,
      hpPercent,
      wasDefeated: gr.wasDefeated,
    });
  }

  return { totalTroopsLost, generalReports };
}
```

This approach means:
- General at 100% HP → 0 troop loss
- General at 50% HP → 50% of their troops lost
- General at 0% HP (defeated) → 100% of their troops lost
- **Auto-battle** uses the same formula — the headless simulation tracks HP per unit

### 6.3 General Death & Injury

After troop casualties, each general is evaluated for death/injury. See **Spec 25 §5.5** for full rules.

Summary:
- **Defeated generals (HP=0)**: roll for permanent death (3% winner, 8% loser). Excludable by game creator for story characters. Survivors get severe injury (7-10 turns).
- **Damaged generals (<50% HP)**: roll for injury (15% winner, 35% loser). Duration = `ceil((1 - hpPercent) * 10)` world turns.
- **Healthy generals (≥50% HP)**: no consequences.

### 6.4 Retreat

Defeated army retreats to nearest friendly territory (shortest graph path).
If no friendly territory reachable → generals become wandering (available for hire by any faction, including the player).

### 6.5 Troop Recovery

Generals stationed at owned territories recover lost troops over time:

```typescript
function recoverTroops(general: GeneralState, territory: TerritoryState): number {
  const maxTroops = general.leadership * 1000;
  const currentTroops = general.currentTroops;  // tracked post-battle
  const baseRate = 0.10;  // 10% per world turn
  const barracksBonus = territory.upgrades.some(u => u.id === 'barracks') ? 0.10 : 0;
  const recoveryRate = baseRate + barracksBonus;  // 10% or 20%
  const recovered = Math.floor(maxTroops * recoveryRate);
  return Math.min(currentTroops + recovered, maxTroops);
}
```

- **Base rate**: 10% of max troops per world turn
- **With Barracks**: 20% per turn
- **Only while stationed**: generals in moving armies do not recover
- **Hospital upgrade**: additionally heals injury duration -1 turn/turn (see Spec 23 §2.3)

---

## 7. Battle Replay

Player can watch auto-resolved battles after the fact:

```typescript
interface BattleReplay {
  battleId: string;
  actionLog: GameAction[];     // Complete action history from auto-battle
  mapData: MapData;
  initialState: BattleState;
}
```

Replay loads `BattleScene` with the recorded `actionLog`, plays back actions with animation. This is essentially a replay viewer — no input needed.

[DISCUSS] MVP or post-MVP feature?

---

## 8. Edge Cases

### 8.1 Simultaneous Attacks

Two armies from different factions attack the same territory:
- Both battles resolve. Defender fights twice (with depleted troops after first).
- Or: two-way battle? Three-way battle? [DISCUSS]
- **Recommended for MVP**: Sequential. First attacker resolved, then second attacker faces winner.

### 8.2 Counter-Attack

After defending, can the defender immediately counter-attack?
- **Recommended**: No counter-attack in same turn. Next turn, defender can send army to attack.

### 8.3 Multiple Armies on Same Edge

Two armies moving on the same edge in opposite directions:
- They meet in the middle → field battle.
- Both moving same direction → faster one overtakes, no battle.

### 8.4 30-Turn Timeout

Battle reaches 30 turns without decisive victory:
- **Siege**: Attacker fails. Defender holds. Attacker retreats.
- **Field**: Draw. Both sides retreat to origin territories.
- Casualties still apply based on damage dealt during battle.

---

## 9. State Flow Summary

```
WorldState.pendingBattles
  ↓ (player selects mode)
WorldState.activeBattles
  ↓ (resolve each)
BattleResult[]
  ↓ (apply to world)
WorldState updated:
  - territories.owner changed
  - armies.location changed (retreat)
  - generals.status = 'injured'
  - factions.resources -= casualties
  ↓
WorldState.pendingBattles = []
WorldState.activeBattles = []
  ↓
Advance to next turn
```

---

## 10. Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| T1 | Season effects | MVP excluded. `season` field retained in WorldTimeDisplay for UI, but no gameplay effects. Deferred to post-S-10. |
| T2 | Battle replay | Post-MVP. ActionLog is saved during auto-battle, but replay UI deferred to S-10. |
| T3 | Three-way battles | Sequential 1v1. First attacker vs defender → winner vs second attacker. Attack order by army arrival time. |
| T4 | Retreat direction | Automatic: nearest friendly territory via shortest graph path. Player choice deferred to S-10. |
| T5 | Troop replenishment | Territory garrison: 10%/turn. With Barracks: 20%/turn. See §6.5. |
| T6 | Army merge/split | Both allowed on same node. Merge = combine generals into one army. Split = move generals to new army. Subject to maxArmies (= owned territory count) constraint. |
