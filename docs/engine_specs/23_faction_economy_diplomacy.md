# Engine Spec 23 — Faction, Economy, Diplomacy & Wandering Generals

---

## 1. Faction System

### 1.1 Faction Data

```typescript
interface FactionData {
  id: string;                     // "aldora"
  name: string;                   // "Kingdom of Aldora"
  color: number;                  // 0xc9a84c (hex color for map)
  leader: string;                 // general id — death of leader = faction collapse
  capital: string;                // territory id — loss of capital = severe debuff
  aiProfile: StrategicAIProfile;  // AI personality (Spec 24)
  startTerritories: string[];     // Initial territory ownership
  startGenerals: string[];        // Initial general roster
  startResources: ResourcePool;   // Initial gold, food, troops
  isPlayer?: boolean;             // true for player-controlled faction
}
```

### 1.2 Faction Runtime State

```typescript
interface FactionState {
  id: string;
  territories: string[];          // Currently owned territory ids
  generals: string[];             // Currently employed general ids
  armies: string[];               // Active army ids
  resources: ResourcePool;
  upgrades: string[];             // Global faction upgrades (tech tree, future)
  alive: boolean;                 // false = eliminated
  // Diplomacy is in separate DiplomacyState
}

interface ResourcePool {
  gold: number;
  food: number;
  troops: number;                 // Recruit pool (not yet assigned to armies)
}
```

### 1.3 Faction Mechanics

- **Max factions**: 32 (set per game in `factions.json`)
- **Faction elimination**: faction loses all territories → generals scatter (become wandering) → faction marked `alive: false`
- **Player faction elimination** OR **protagonist death**: **GAME OVER**
- **Capital loss**: -20% all production until recaptured. Capital can be relocated (1-time per game? Or freely?)

---

## 2. Territory & Economy

### 2.1 Territory Runtime State

```typescript
interface TerritoryState {
  id: string;
  owner: string | null;           // Faction id or null (neutral)
  garrison: string[];             // General ids stationed here
  upgrades: TerritoryUpgrade[];   // Applied upgrades
  population: number;             // Affects production (grows over time)
  morale: number;                 // 0-100, affects production + rebellion risk
  underSiege: boolean;            // If enemy army is attacking
  turnsOwned: number;             // Longer = higher loyalty
}
```

### 2.2 Resource Production

Each territory produces resources per world turn (30 days):

```typescript
interface TerritoryProduction {
  goldPerTurn: number;
  foodPerTurn: number;
  troopsPerTurn: number;
}
```

Base production by territory type:

| Type | Gold | Food | Troops | Notes |
|------|:---:|:---:|:---:|-------|
| city | 100 | 80 | 30 | Balanced, high total |
| fortress | 30 | 20 | 50 | Military-focused |
| village | 40 | 100 | 20 | Food production |
| port | 120 | 40 | 15 | Trade income |
| pass | 10 | 10 | 10 | Minimal, strategic only |
| camp | 5 | 5 | 5 | Temporary, negligible |

Modifiers:
- `population` multiplier: `production * (population / 1000)`
- `morale` multiplier: `production * (morale / 100)`
- `upgrade` bonuses: additive or multiplicative per upgrade
- **Siege**: production halved while under siege

### 2.3 Territory Upgrades

```typescript
interface TerritoryUpgrade {
  id: string;
  name: string;
  desc: string;
  cost: ResourcePool;
  buildTurns: number;             // World turns to complete
  effects: UpgradeEffect[];
  requires?: string[];            // Prerequisite upgrade ids
  applicableTo: TerritoryType[];  // Which territory types can build this
}

type UpgradeEffect =
  | { type: 'defense_bonus'; value: number }         // +defense in battles here
  | { type: 'production_mult'; resource: string; value: number }  // +X% gold
  | { type: 'vision_bonus'; value: number }           // +N hops vision
  | { type: 'troop_capacity'; value: number }         // Max garrison size
  | { type: 'morale_bonus'; value: number }           // +morale per turn
  | { type: 'heal_bonus'; value: number };            // Generals here recover HP faster
```

Upgrade examples:

| Upgrade | Cost | Turns | Effect | Requires |
|---------|------|:---:|--------|----------|
| Wooden Walls | 200g | 2 | defense +15 | — |
| Stone Walls | 500g | 4 | defense +30 | Wooden Walls |
| Barracks | 300g, 100f | 3 | troops +50% | — |
| Market | 400g | 3 | gold +30% | — |
| Watchtower | 200g | 2 | vision +2 hops | Wooden Walls |
| Granary | 200g | 2 | food +40% | — |
| Hospital | 300g | 3 | heal generals stationed here | Barracks |

### 2.4 Resource Spending

| Action | Cost |
|--------|------|
| Recruit troops | 10g per 100 troops |
| Hire wandering general | 500-2000g (varies by quality) |
| Build upgrade | Per upgrade table |
| Maintain army (per turn) | food = troops / 100, gold = generals * 20 |
| Diplomatic gift | 100-1000g |

---

## 3. Generals (Characters)

### 3.1 General Data

Generals are the SRPG characters. They exist on both strategic and tactical layers:

```typescript
interface GeneralState {
  // Identity
  id: string;
  name: string;
  portrait: PortraitConfig;       // Component-based portrait

  // SRPG stats (used in tactical battles — maps to existing UnitData)
  unitDataId: string;             // Reference to UnitData for battle

  // Strategic stats (used on world map)
  leadership: number;             // 1-20. Troops = leadership * 1000 (max 20,000). Buffs allies 1%/point.
  intellect: number;              // 1-10. Affects auto-battle performance, scouting.
  politics: number;               // 1-10. Territory management, diplomacy success.
  charm: number;                  // 1-10. Recruitment success, morale boost.

  // State
  faction: string | null;         // Owning faction. null = wandering.
  location: string;               // Territory id or army id
  status: 'idle' | 'army' | 'scouting' | 'building' | 'injured';
  injuryTurns: number;            // 0 = healthy. After defeat, 1-3 turns recovery.
  loyalty: number;                // 0-100. Below 30 = desertion risk.
}
```

### 3.2 Leadership → Battle Buff

The commander (army leader) provides a global buff to all allied units in SRPG battle:

```
buff_percentage = commander.leadership * 1%     // Max 20% at leadership 20
Applies to: ATK, DEF, SPD of all allied units in battle
```

| Leadership | Buff | Effective Troops |
|:---:|:---:|:---:|
| 5 | +5% stats | 5,000 |
| 10 | +10% stats | 10,000 |
| 15 | +15% stats | 15,000 |
| 20 | +20% stats | 20,000 |

**Canonical reference**: See Spec 25 §5.2-5.3 for implementation details.

Troop count (`leadership * 1000`, max 20,000) is the abstract army size used for:
- Auto-battle strength calculation
- Post-battle casualty reports
- Army maintenance cost

### 3.3 General Death & Injury

**Canonical reference**: See Spec 25 §5.5 for full death/injury rules.

Summary:
- **Defeated generals (HP=0)**: 3% death chance (winner), 8% (loser). Excludable for story characters. Survivors get severe injury.
- **Damaged generals (<50% HP)**: 15% injury chance (winner), 35% (loser). Duration 1-10 world turns.
- **HP resets each battle**: Generals always start at full HP. Penalty comes from death/injury system.
- **Protagonist death**: **GAME OVER** (regardless of exclude list)
- **Faction leader death**: faction enters chaos (morale -30, 5 turns no AI actions), then AI selects new leader
- **Desertion**: loyalty < 30 → 30% chance per turn to leave. General moves to wandering pool.

---

## 4. Wandering Generals

### 4.1 Spawning

```typescript
interface WanderingGeneralConfig {
  namePool: {
    firstNames: string[];         // ["Ardent", "Brycen", "Cael", ...]
    lastNames: string[];          // ["Ironheart", "Stormwind", "Ashford", ...]
  };
  portraitComponents: {
    faceShapes: string[];         // sprite keys
    hairStyles: string[];
    eyeTypes: string[];
    armorStyles: string[];
    colorPalettes: number[][];    // skin/hair/armor color combos
  };
  statRanges: {
    leadership: [number, number]; // [min, max] e.g. [1, 7]
    intellect: [number, number];
    politics: [number, number];
    charm: [number, number];
  };
  spawnRate: number;              // Per world turn. 0.3 = 30% chance per turn.
  maxAvailable: number;           // Max wandering generals at once (10-20)
  spawnLocations?: string[];      // Territory ids where they can appear. null = any owned.
}
```

### 4.2 Generation Algorithm

```
Every world turn:
  if random() < spawnRate AND availableGenerals.length < maxAvailable:
    name = random(firstNames) + " " + random(lastNames)
    portrait = combine(random components)
    stats = random within statRanges
    unitDataId = generate from template based on stats (warrior/archer/mage/etc.)
    location = random owned territory with tavern/recruitment post
    hireCost = baseCost + (leadership + intellect + politics + charm) * 50
    add to availableGenerals pool
```

### 4.3 Scripted Generals

In addition to random wanderers, game creators can define fixed generals in `wandering_generals.json`:

```json
{
  "scripted": [
    {
      "id": "wg_veteran_01",
      "name": "Marcus Ironheart",
      "appearsOnTurn": 5,
      "appearsAt": "port_haven",
      "stats": { "leadership": 8, "intellect": 6, "politics": 3, "charm": 7 },
      "hireCost": 1500,
      "unitDataId": "veteran_knight"
    }
  ],
  "randomConfig": { ... }
}
```

---

## 5. Diplomacy System

### 5.1 Diplomatic Relations

```typescript
type DiplomaticStatus = 'war' | 'hostile' | 'neutral' | 'friendly' | 'allied';

interface DiplomacyState {
  relations: Record<string, Record<string, DiplomaticRelation>>;
  // relations[factionA][factionB] = relation between A and B
}

interface DiplomaticRelation {
  status: DiplomaticStatus;
  favorability: number;          // -100 to +100
  treatyTurnsLeft: number;       // 0 = no active treaty
  lastAction: string;            // For AI memory
}
```

### 5.2 Status Effects

| Status | Can Attack? | Can Pass Territory? | Trade? |
|--------|:---:|:---:|:---:|
| war | Yes | No | No |
| hostile | No (must declare war first) | No | No |
| neutral | No | With permission | Limited |
| friendly | No | Yes | Yes |
| allied | No | Yes | Yes, bonuses |

### 5.3 Diplomatic Actions

| Action | Cost | Effect | Cooldown |
|--------|------|--------|----------|
| Declare War | — | status → war, favorability -50 | 5 turns after peace |
| Propose Peace | 100-500g | If accepted: war → neutral | — |
| Non-Aggression Pact | 200g | hostile/neutral → friendly for 10 turns | — |
| Propose Alliance | 500g | friendly → allied for 15 turns | — |
| Send Gift | 100-1000g | favorability +10 to +30 | 1 turn |
| Break Treaty | — | allied/friendly → hostile, favorability -40 | — |
| Demand Tribute | — | If accepted: receive gold. If rejected: favorability -20 | 3 turns |

### 5.4 Favorability Factors

```
Per turn:
  +5 if allied
  +2 if friendly
  -2 if hostile
  -5 if at war
  +3 if common enemy (both at war with same faction)
  -10 if attacked ally's territory
  -5 per territory conquered from them (permanent)
  +10 per gift sent
  -30 for treaty break
```

### 5.5 Extensibility

The diplomacy system uses `DiplomaticStatus` enum + `DiplomaticAction` command pattern. Adding new statuses (vassal, tributary, marriage alliance) = add enum values + new action types. No structural changes needed.

---

## 6. Data Files

### 6.1 factions.json

```json
{
  "factions": [
    {
      "id": "aldora",
      "name": "Kingdom of Aldora",
      "color": "0xc9a84c",
      "leader": "gen_protagonist",
      "capital": "capital_aldora",
      "aiProfile": "steady_expander",
      "isPlayer": true,
      "startTerritories": ["capital_aldora", "fort_north", "village_east"],
      "startGenerals": ["gen_protagonist", "gen_knight_01", "gen_mage_01"],
      "startResources": { "gold": 5000, "food": 3000, "troops": 10000 }
    }
  ]
}
```

### 6.2 territory_upgrades.json

```json
{
  "upgrades": [
    {
      "id": "wooden_walls",
      "name": "Wooden Walls",
      "cost": { "gold": 200, "food": 0, "troops": 0 },
      "buildTurns": 2,
      "effects": [{ "type": "defense_bonus", "value": 15 }],
      "applicableTo": ["city", "fortress", "village"]
    }
  ]
}
```

---

## 7. Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| F1 | Capital relocation | 1st free. After: 500g + 3 turn cooldown. |
| F2 | Troop types | Generic troops for MVP. Type diversification deferred to post-S-10. |
| F3 | General desertion | loyalty < 30 → 30% chance/turn → moves to wandering general pool. Not enemy faction. |
| F4 | Neutral territories | Conquerable without war declaration. Optional guardian battles (game creator setting). |
| F5 | Trade routes | MVP excluded. Port base production is sufficient. |
| F6 | Population growth | Linear: `population += growthRate * morale / 100` per turn. Capped by territory type. |
