# Engine Spec 25 — Deployment & Formation System

> Pre-battle unit selection, formation presets, and commander leadership buffs.

---

## 1. Deployment Flow

```
World Map → Battle Triggered → Deployment Phase → SRPG Battle → Result → World Map
                                    │
                                    ├─ Select generals to deploy (max 50)
                                    ├─ Assign commander (highest leadership recommended)
                                    ├─ Choose formation preset OR manual placement
                                    └─ Confirm → Battle starts
```

---

## 2. Deployment Data

### 2.1 Input: Available Roster

```typescript
interface DeploymentContext {
  // From WorldState
  attackerFaction: string;
  defenderFaction: string;
  attackerGenerals: GeneralState[];   // All generals in the attacking army
  defenderGenerals: GeneralState[];   // Garrison + army defending
  territory: TerritoryState | null;   // null = field battle (on edge)
  terrain: WorldTerrain;              // For map template selection

  // Constraints
  maxDeployPerSide: number;           // Default 50
  battleMapId: string;                // Resolved battle map
  deployZones: DeployZone[];          // From battle map data
}

interface DeployZone {
  team: 'attacker' | 'defender';
  tiles: Array<{ x: number; y: number }>;   // Available spawn positions
}
```

### 2.2 Output: Deployment Config

```typescript
interface DeploymentConfig {
  commanderId: string;               // General with leadership buff
  deployedUnits: DeployedUnit[];     // Who goes where
  formation: FormationType;          // Which preset was used
}

interface DeployedUnit {
  generalId: string;
  unitDataId: string;
  x: number;
  y: number;
}
```

---

## 3. Auto-Pick Algorithm

When player doesn't want to manually select units:

```
AutoPick(availableGenerals, maxDeploy, formation):
  1. Sort generals by combatPower = (leadership * 2 + str + mag + def + spd) / 6
  2. Take top N (up to maxDeploy)
  3. Classify each general by role:
     - Melee:  atkRange == 1 AND job is warrior/knight/berserker
     - Ranged: atkRange > 1 OR job is archer/gunner
     - Mage:   affinity == 'magic'
     - Healer: has healing skill
     - Tank:   def > avg(def) * 1.3 OR job is knight/heavy
  4. Assign commander = general with highest leadership
  5. Apply formation preset (Section 4)
```

---

## 4. Formation Presets

### 4.1 Line Attack (라인 공격형)

Aggressive front-loaded formation.

```
Deploy Zone Layout (example 10-wide):

Row 0 (front):  [Melee] [Melee] [Melee] [Tank] [Melee] [Melee] [Melee] [Tank]
Row 1 (mid):    [       ] [Ranged] [Ranged] [Commander] [Ranged] [Ranged] [       ]
Row 2 (back):   [       ] [       ] [Healer] [Mage]  [Healer] [       ] [       ]
```

Assignment rules:
1. **Front row**: All melee + tanks on flanks
2. **Middle row**: Ranged units + commander (center)
3. **Back row**: Healers + mages

### 4.2 Defense (방어형)

Defensive shell formation.

```
Row 0 (front):  [Tank] [Tank] [Tank] [Tank] [Tank] [Tank]
Row 1 (mid):    [Melee] [       ] [Ranged] [Ranged] [       ] [Melee]
Row 2 (back):   [       ] [Healer] [Commander] [Mage] [Healer] [       ]
```

Assignment rules:
1. **Front row**: All tanks and highest-DEF units
2. **Flanks**: Melee attackers
3. **Center**: Ranged
4. **Back**: Healers + commander

### 4.3 Small Party (소규모 파티형)

Autonomous 4-person squads.

```
Party composition: 1 Melee + 1 Tank/Melee + 1 Ranged + 1 Healer

Layout (3 parties example):
  [Party A]       [Party B]       [Party C]
  M  T            M  T            M  T
  R  H            R  H            R  H
```

Assignment rules:
1. Divide available generals into groups of 4
2. Each group: 1 melee, 1 tank (or 2nd melee), 1 ranged, 1 healer
3. Best generals spread across parties (not all in one)
4. Place parties in grid pattern across deploy zone
5. Remaining generals (if not divisible by 4) fill into existing parties

### 4.4 Manual Placement

- Show all deploy zone tiles highlighted
- Player drags generals onto desired tiles
- No restrictions within deploy zone
- Can mix with auto-placed units (auto-fill remaining)

---

## 5. Commander & Leadership System

### 5.1 Commander Selection

```typescript
// Auto: highest leadership general in army
function selectCommander(generals: GeneralState[]): GeneralState {
  return generals.reduce((best, g) =>
    g.leadership > best.leadership ? g : best
  );
}
```

Player can override and choose any deployed general as commander.

### 5.2 Leadership Stat

- **Max value**: 20
- **Buff formula**: `leadership * 1%` (max 20% at leadership 20)
- This is a strategic-layer stat, separate from combat stats (STR, DEF, etc.)

### 5.3 Leadership Buff in Battle

Applied as a global buff at battle start (before first turn):

```typescript
function applyCommanderBuff(
  state: BattleState,
  commanderLeadership: number,     // 1-20
): BattleState {
  const buffPercent = Math.min(commanderLeadership, 20);  // Cap at 20%
  const buffMult = 1 + buffPercent / 100;                 // 1.01 ~ 1.20

  // Apply to all allied units
  for (const unit of Object.values(state.units)) {
    if (unit.team === 'ally') {
      unit.atk = Math.floor(unit.atk * buffMult);
      unit.def = Math.floor(unit.def * buffMult);
      unit.spd = Math.floor(unit.spd * buffMult);
    }
  }
  return state;
}
```

Note: Buff is baked into unit stats at battle init, not a runtime modifier. Balance-testable: the 1% per point rate is a constant in code, adjustable after playtesting.

### 5.4 Troops Abstraction

```
Troops per general = general.leadership * 1000
Max troops per general = 20 * 1000 = 20,000
Army strength = sum of troops for all generals in army
```

This number is used for:
- Auto-battle strength comparison
- UI display ("8,000 troops vs 12,000 troops")
- Post-battle casualty calculation
- Army maintenance cost

In SRPG battle, troops are NOT individual units. Each general IS a unit on the tactical map. Troops are flavor/abstraction for the strategic layer.

### 5.5 General Death & Injury (Post-Battle)

After each SRPG battle resolves, generals who participated may suffer consequences:

#### Permanent Death

```typescript
interface DeathConfig {
  baseDeathChance: number;    // Default: 0.03 (3%)
  deathChanceIfLost: number;  // Default: 0.08 (8%) — losing side higher risk
  excludeIds: string[];       // Story characters excluded from death (game creator setting)
}
```

- **Small probability**: 3% base (winner side), 8% (loser side)
- **Excludable**: Game creator marks story-critical characters via `excludeIds` — these characters NEVER die permanently
- **Dead = gone forever**: removed from WorldState.generals, no resurrection
- If **protagonist** dies → immediate game over (regardless of exclude list)
- **Calculation**: rolled per general whose unit was defeated (HP=0) during battle. Generals who survived with HP>0 cannot die.

#### Injury

```typescript
interface InjuryConfig {
  baseInjuryChance: number;    // Default: 0.15 (15%)
  injuryChanceIfLost: number;  // Default: 0.35 (35%)
  minTurns: number;            // Default: 1
  maxTurns: number;            // Default: 10
}

interface GeneralInjury {
  turnsRemaining: number;      // 1-10 world turns
  severity: 'light' | 'moderate' | 'severe';
}
```

- **Higher probability than death**: 15% base (winner), 35% (loser)
- **Duration**: 1-10 world turns, proportional to HP lost percentage
  - `injuryTurns = Math.ceil((1 - hpPercent) * maxTurns)` (general at 10% HP → 9 turns injury)
- **Effect**: injured generals cannot be deployed, cannot move, cannot scout
- **Recovery**: automatic, decrements each world turn
- **Severity** (cosmetic, for UI/narrative):
  - light (1-3 turns), moderate (4-6 turns), severe (7-10 turns)

#### Resolution Order

```
For each general who participated in battle:
  1. Was unit defeated (HP=0) in SRPG battle?
     → Roll for permanent death (if not in excludeIds)
     → If survived death roll → automatic injury (severe, 7-10 turns)
  2. Was unit alive but below 50% HP?
     → Roll for injury (chance based on winner/loser side)
     → If injured → turns based on HP% remaining
  3. Unit above 50% HP → no consequences
```

---

## 6. Battle Map Resolution

### 6.1 Territory Battles

If a territory has `battleMapId` set → use that specific map.
Otherwise → select from templates:

```typescript
function resolveBattleMap(
  territory: TerritoryState | null,
  terrain: WorldTerrain,
  templates: Record<string, string>,
): string {
  if (territory?.battleMapId) return territory.battleMapId;
  return templates[terrain] ?? 'battle_field_default';
}
```

### 6.2 Field Battles (on edges)

When armies collide on a route (edge), use the edge's terrain to select map template.

### 6.3 Deploy Zone Definition in MapData

Extended `MapData` to include deploy zones:

```typescript
interface MapData {
  // ... existing fields ...
  deployZones?: {
    attacker: Array<{ x: number; y: number }>;
    defender: Array<{ x: number; y: number }>;
  };
}
```

If `deployZones` not defined, fall back to existing `allySpawns`/`enemySpawns` positions.

---

## 7. Deployment Scene UI

### 7.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  DEPLOYMENT                          Turn 12, Day 360 │
├──────────────────┬───────────────────────────────────┤
│                  │                                    │
│  Available       │        Battle Map Preview          │
│  Generals        │                                    │
│  ┌──────────┐    │     [Deploy zone tiles shown]      │
│  │ Gen 1  ★ │    │     [Placed units shown]           │
│  │ Gen 2    │    │                                    │
│  │ Gen 3    │    │                                    │
│  │ ...      │    │                                    │
│  └──────────┘    │                                    │
│                  │                                    │
│  Commander: [Gen 1]                                   │
│                                                       │
│  [Auto Pick] [Line Atk] [Defense] [Party] [Confirm]  │
└──────────────────────────────────────────────────────┘
```

### 7.2 Interactions

- Click general in list → select/deselect for deployment
- Click formation button → auto-place selected generals
- Drag general from list to map tile → manual placement
- Click "Auto Pick" → system selects best N generals
- Star icon = recommended commander
- Click "Confirm" → battle begins

---

## 8. Auto-Battle Deployment

For delegated battles (auto-resolved), the AI uses:

```
1. Auto-pick all available generals (up to max)
2. Select commander = highest leadership
3. Formation = Steady Expander profile uses "Defense"
                Blitz Conqueror uses "Line Attack"
                Others use "Small Party"
4. Run headless battle with both sides using EnemyAI
```

---

## 9. Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| D1 | Deploy zone size | Proportional to deploy count: `tiles = max(deployCount * 2, 15)`. Minimum 15 tiles guaranteed. |
| D2 | Formation balance | No inherent bonuses. Formations are placement convenience only, no stat effects. |
| D3 | Commander death in battle | Buff persists. Leadership buff is baked into unit stats at battle init — commander death doesn't remove it. |
| D4 | Retreat option | Available after turn 10. Retreating side loses 20% additional troops on top of battle casualties. |
| D5 | Reinforcement waves | Strict 50-unit cap per side. No wave system. Remaining generals are reserves. Wave system deferred to S-10. |
