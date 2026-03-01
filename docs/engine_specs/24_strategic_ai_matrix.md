# Engine Spec 24 — Strategic AI Personality Matrix

> Common stat framework (8 traits, 1-10 scale) defines faction-level AI behavior.
> 6 built-in presets provided; game creators can define custom profiles.

---

## 1. Common AI Trait System

Every faction's strategic AI is governed by **8 common traits** on a 1-10 scale.
Game creators set these traits directly in `factions.json`. The 6 built-in presets are convenience defaults — any combination of values is valid.

### 1.1 Trait Definitions

```typescript
interface AIWeights {
  aggression: number;       // 1-10: willingness to initiate battles
  defense: number;          // 1-10: priority on fortifying owned territory
  expansion: number;        // 1-10: desire to capture new territory
  economy: number;          // 1-10: investment in upgrades and production
  diplomacy: number;        // 1-10: likelihood to form/maintain alliances
  scouting: number;         // 1-10: investment in vision and intelligence
  riskTolerance: number;    // 1-10: willingness to fight outnumbered
  patience: number;         // 1-10: willingness to wait for optimal conditions
}
```

All 8 traits feed directly into the scoring formulas (Section 4). Higher value = more weight in that dimension's scoring.

---

## 2. Built-In Presets (6 Personality Types)

These presets are **just default weight combinations**. Game creators can use them as-is, modify individual traits via `overrides`, or set entirely custom weights.

### 2.1 Preset Matrix

```
Trait             Fort  Ambush Steady Blitz  Diplo  Opport
─────────────────────────────────────────────────────────
Aggression         2      7      5      9      3      6
Defense            9      4      7      3      5      4
Expansion          2      5      6      9      4      6
Economy            8      4      7      2      7      5
Diplomacy          4      2      5      1      9      8
Scouting           5      9      5      4      4      8
Risk Tolerance     1      6      3      9      3      6
Patience           9      5      7      1      7      5
```

### 2.2 Preset Summary

| # | Preset | Korean | Playstyle |
|---|--------|--------|-----------|
| 1 | **Fortress Guardian** | 방어형 | Turtles up. Only attacks with overwhelming advantage. Maxes defense upgrades. |
| 2 | **Ambush Predator** | 기습형 | Scouts heavily, attacks weak/exposed targets, avoids fair fights. Hit-and-run. |
| 3 | **Steady Expander** | 안정적 확장형 | Methodical. Secures borders first, then expands. Balanced economy + military. |
| 4 | **Blitz Conqueror** | 급속 확장형 | All-in aggression. Attacks multiple fronts simultaneously. High risk, high reward. |
| 5 | **Diplomat King** | 외교형 | Uses alliances to isolate targets. Attacks only after diplomatic preparation. Strong economy. |
| 6 | **Opportunist** | 기회주의형 | Adapts to situation. Attacks when others are fighting. Scavenges weakened factions. |

---

## 3. Data Schema

```typescript
interface StrategicAIProfile {
  // Option A: use a preset
  preset?: AIPresetType;
  // Option B: set custom weights directly (overrides preset entirely)
  weights?: AIWeights;
  // Option C: use preset + override specific traits
  overrides?: Partial<AIWeights>;
}

// Resolution: weights > (preset + overrides) > preset defaults
// If neither preset nor weights specified, defaults to 'steady_expander'

type AIPresetType =
  | 'fortress_guardian'
  | 'ambush_predator'
  | 'steady_expander'
  | 'blitz_conqueror'
  | 'diplomat_king'
  | 'opportunist';

function resolveWeights(profile: StrategicAIProfile): AIWeights {
  if (profile.weights) return profile.weights;  // Fully custom
  const base = PRESETS[profile.preset ?? 'steady_expander'];
  return { ...base, ...profile.overrides };     // Preset + optional overrides
}
```

### 3.1 JSON Example (factions.json)

```json
{
  "factions": [
    {
      "id": "shadow_legion",
      "aiProfile": {
        "preset": "blitz_conqueror",
        "overrides": { "diplomacy": 3 }
      }
    },
    {
      "id": "merchant_guild",
      "aiProfile": {
        "weights": {
          "aggression": 1, "defense": 6, "expansion": 3, "economy": 10,
          "diplomacy": 8, "scouting": 4, "riskTolerance": 2, "patience": 8
        }
      }
    }
  ]
}
```

---

## 4. Decision System

### 4.1 Per-Turn AI Loop

```
For each AI faction, each world turn:
  1. Evaluate current state (resources, territories, armies, threats)
  2. Score possible actions:
     - Attack targets
     - Defend vulnerable territories
     - Build upgrades
     - Recruit generals
     - Move armies
     - Diplomatic actions
  3. Select top N actions (constrained by resources + action points)
  4. Execute actions
```

### 4.2 Territory Target Scoring

```
TargetScore(territory T, attacker faction F) =
  baseValue(T)                           // city=100, fort=80, village=50, port=90, pass=40
  * (1 - defenseRatio(T))               // Lower defense = easier target
  * adjacencyBonus(T, F)                // Adjacent to owned territory = +50%
  * strategicValue(T)                   // Chokepoint, capital, resource-rich
  * aggressionWeight(F.aiProfile)       // Personality modifier
  * (1 / distancePenalty(T, F))         // Closer = higher priority
  * opportunityBonus(T)                 // Target is at war with someone else? +30%
  - riskPenalty(T, F)                   // Strong garrison? Risk-averse AI avoids.
```

### 4.3 Defense Priority Scoring

```
DefensePriority(territory T, faction F) =
  baseValue(T)
  * threatLevel(T)                      // Enemy armies nearby? Adjacent to hostile faction?
  * defenseWeight(F.aiProfile)          // Personality modifier
  * (1 + capitalBonus(T))              // Capital = priority x2
  * (1 - currentDefenseRatio(T))       // Under-defended = higher priority
```

### 4.4 Diplomacy Decision

```
AllianceDesirability(faction A → faction B) =
  commonEnemyBonus(A, B)               // +40 if share an enemy
  + borderSafety(A, B)                 // +20 if long shared border (peace is valuable)
  + relativePower(B)                   // +30 if B is strong (useful ally)
  - trustPenalty(A, B)                 // -50 if B broke treaties before
  * diplomacyWeight(A.aiProfile)       // Personality modifier
  - expansionConflict(A, B)            // -30 if both want same territory

WarDecision(faction A → faction B) =
  powerAdvantage(A, B)                 // My army vs theirs
  + targetValue(B.territories)         // Rich territories to gain
  + aggressionWeight(A.aiProfile)      // Personality modifier
  - alliancePenalty(B)                 // B has strong allies? -big
  - riskPenalty(A.aiProfile)           // Risk-averse? -big if not overwhelming
  > threshold(A.aiProfile.patience)    // Must exceed patience threshold to act
```

---

## 5. Personality Behavior Descriptions

### 5.1 Fortress Guardian (방어형)

```
Strategy: Survive and outlast.
Priority:  Build upgrades (walls, barracks) > Defend > Economy > Expand
Military:  Concentrated defense. Rarely splits armies. Attacks only 3:1 advantage.
Economy:   Invests in defense upgrades first, then production.
Diplomacy: Accepts alliances readily. Rarely declares war. Never breaks treaties.
Weakness:  Passive. Can be slowly surrounded and economically outpaced.
```

### 5.2 Ambush Predator (기습형)

```
Strategy: Strike weak points, avoid head-on fights.
Priority:  Scout > Attack weak targets > Economy > Defend
Military:  Fast, small armies. Targets undefended territory. Retreats from strong opponents.
Economy:   Moderate. Spends on scouts and mobile armies.
Diplomacy: Low. Prefers independence. May ally temporarily for shared target.
Weakness:  Vulnerable to multi-front pressure. Weak garrisons.
```

### 5.3 Steady Expander (안정적 확장형)

```
Strategy: Grow methodically. Never overextend.
Priority:  Economy = Defend > Expand > Attack
Military:  Balanced armies. Secures each conquest before moving on.
Economy:   Strong. Upgrades production early. Accumulates before spending.
Diplomacy: Moderate. Uses non-aggression pacts to secure flanks while expanding elsewhere.
Weakness:  Slow. Can be overtaken by aggressive factions early game.
```

### 5.4 Blitz Conqueror (급속 확장형)

```
Strategy: Overwhelm quickly before opponents consolidate.
Priority:  Attack > Expand > Economy > Defend
Military:  Multiple simultaneous attacks. Ignores defense. All resources to offense.
Economy:   Minimal. Relies on conquering resource-rich territories.
Diplomacy: Near zero. Views everyone as future target.
Weakness:  Overextended. One major defeat can collapse the whole position.
```

### 5.5 Diplomat King (외교형)

```
Strategy: Manipulate others into fighting each other. Strike last.
Priority:  Diplomacy > Economy > Defend > Attack
Military:  Moderate, defensive. Only attacks isolated targets.
Economy:   Strong. Uses trade and gifts to maintain alliances.
Diplomacy: Maximum. Constantly proposes alliances, breaks them strategically.
Weakness:  Dependent on diplomatic network. If isolated, lacks military punch.
```

### 5.6 Opportunist (기회주의형)

```
Strategy: Wait for chaos, then strike.
Priority:  Scout > Diplomacy > Attack (only weakened targets) > Economy
Military:  Reactive. Mobilizes quickly when opportunity appears.
Economy:   Moderate. Maintains reserve for sudden moves.
Diplomacy: Flexible. Allied one turn, backstabbing next. Reputation suffers.
Weakness:  Unpredictable but not proactively building. Can fall behind.
```

---

## 6. AI Difficulty Modifiers

Per-game difficulty setting affects AI behavior:

| Difficulty | Resource Bonus | Decision Quality | Aggression Modifier |
|------------|:---:|:---:|:---:|
| Easy | -20% | Random noise ±30% on scores | -2 |
| Normal | 0% | Random noise ±15% | 0 |
| Hard | +20% | Random noise ±5% | +1 |
| Nightmare | +40% | Near-optimal (noise ±2%) | +2 |

---

## 7. Implementation Architecture

```typescript
// Main entry point per faction per turn
class StrategicAI {
  evaluateTurn(worldState: WorldState, factionId: string): WorldAction[] {
    const profile = worldState.factions[factionId].aiProfile;
    const weights = getWeightsForProfile(profile);

    const actions: ScoredAction[] = [];

    // Score all possible actions
    actions.push(...this.scoreAttacks(worldState, factionId, weights));
    actions.push(...this.scoreDefense(worldState, factionId, weights));
    actions.push(...this.scoreEconomy(worldState, factionId, weights));
    actions.push(...this.scoreDiplomacy(worldState, factionId, weights));
    actions.push(...this.scoreRecruitment(worldState, factionId, weights));

    // Sort by score, take top N (constrained by resources)
    return this.selectActions(actions, worldState.factions[factionId].resources);
  }
}
```

All scoring functions are pure (no side effects, testable). The `WorldAction` command pattern makes AI turns verifiable via unit tests.

---

## 8. Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| A1 | AI personality evolution | Fixed for MVP. Traits don't change during game. Adaptive behavior deferred to S-10. |
| A2 | AI coalition attacks | Natural occurrence only. No explicit coordination. AIs at war with same target may attack simultaneously by coincidence. |
| A3 | AI cheating (FoW) | Normal and below: honest FoW. Hard: retains explored territory info. Nightmare: full map visibility. |
| A4 | AI personality assignment | Game creator sets in factions.json. Unset factions get random preset. |
