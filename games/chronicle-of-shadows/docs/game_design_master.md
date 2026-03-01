# Chronicle of Shadows — Master Game Design Document

> Target: 20+ hours | Tactical SRPG + Grand Strategy | SRPGMaker showcase
> Status: Design phase

---

## 1. Game Overview

### 1.1 Elevator Pitch
A young border captain discovers that the shadows of a war thought ended three years ago are stirring again. What starts as a personal story of loss and duty escalates into a full-scale continental war where alliances shift, kingdoms fall, and every tactical decision shapes the fate of Aldora.

### 1.2 Core Pillars
- **Personal to Epic**: Story begins intimate (4-person squad) and escalates to commanding armies across continents
- **Tactical Depth**: FFT-class SRPG combat with positioning, skills, terrain, and flanking
- **Strategic Scale**: Grand strategy with territory control, diplomacy, and army management
- **Meaningful Choices**: Story branches and faction diplomacy affect both narrative and gameplay
- **Spectacle**: Key story battles with scripted events, betrayals, reinforcements, and dramatic turns

### 1.3 Playtime Breakdown (20+ hours)

| Phase | Hours | Content |
|-------|-------|---------|
| Act 1: Personal Arc | 4-5h | 6 story battles + tutorial, character introduction |
| Act 2: Rising War | 5-6h | Strategic layer opens, 3 factions, 10+ battles |
| Act 3: Continental War | 6-8h | Full strategic campaign, 15+ territories, 5 factions |
| Act 4: Final Stand | 3-4h | Climactic battles, multiple endings |
| Side content | 2-3h | Optional battles, hidden generals, side quests |

---

## 2. Story Arc

### 2.1 Act 1 — "The Border" (Personal Arc, Chapters 1-6)

The story opens small: Kael commands a 4-person border patrol squad. Strange events at the frontier — undead sightings, villages going silent, sealed ruins cracking open.

**Chapters:**
1. **Silent Frontier** (Tutorial) — Kael's squad investigates a silent outpost. Basic combat tutorial. Win: defeat all. Easy enemies introduce movement, attack, terrain.
2. **Ash Forest Ambush** — Squad is ambushed in a forest. Survival (survive 10 turns). Introduces terrain advantage, defensive play. Serra joins.
3. **The Broken Seal** — Investigate ancient ruins. Reach 3 tiles with units. Puzzle-like navigation through a dungeon map. Zara discovered imprisoned.
4. **Shadow's Reach** — Escort a messenger to the capital. Escort mission. Lyra joins as hired bodyguard. First real tactical challenge.
5. **The Court's Denial** — Political intrigue battle. Defeat assassination squad. Story: the king dismisses shadow warnings, Serra discovers conspiracy.
6. **Exodus** — Kael is branded a traitor. Escape the capital. Defeat pursuit + reach exit. Dramatic: forced to fight former allies.

**Act 1 Climax**: Kael's squad is branded as traitors by a corrupted court. They flee with evidence of the Shadow Legion's infiltration. Personal loss: a close NPC ally dies in the escape, making this personal for every character.

### 2.2 Act 2 — "The Rising Storm" (War Begins, Chapters 7-12)

The strategic layer OPENS. Kael rallies border territories and builds a resistance. Three-way conflict begins: Aldora's corrupt court, Shadow Legion, and Northern Clans (who have their own agenda).

**Strategic Map Expansion**: 13 nodes expands to 20. New factions appear.

**Key Story Beats:**
7. **The Resistance** — Capture first territory. Tutorial for strategic layer.
8. **Northern Alliance** — Diplomatic mission to Northern Clans. Success/failure affects Act 3.
9. **Shadow's General** — Face the Shadow Legion's champion in a dramatic 1v1-start battle. Introduces powerful enemy generals.
10. **The Siege of Eastwall** — First large siege battle. Spectacle: walls, catapults, reinforcement timing.
11. **Betrayal at Dusk** — A trusted general defects to the shadow side. Player-choice dependent: if affinity was low, they betray you earlier and harder.
12. **Breaking the Line** — Critical battle that determines Act 3 starting position. Victory = major advantage; narrow win = harder Act 3.

**Act 2 Climax**: The Shadow Legion reveals its true power. The old king falls. Aldora splinters. Kael must unite the fragments or watch everything burn.

### 2.3 Act 3 — "Continental War" (Full Strategy, Chapters 13-20)

Full strategic campaign. 5 factions compete for 25+ territories. Player manages armies, economy, diplomacy, and territory upgrades while fighting key battles personally.

**New Factions:**
- **Free City League** — Merchant republic, strong economy, weak military
- **Order of the Dawn** — Religious knights, powerful but dogmatic

**Strategic Objectives:**
- Unite at least 3 factions against the Shadow Legion
- Capture the Shadow Legion's capital
- Manage multiple army fronts simultaneously

**Key Spectacle Battles:**
13. **Three-Way Battle of the Pass** — 3 armies converge. Player chooses which front to command; others auto-resolve.
14. **Naval Blockade** — Port territory battle with unique water terrain mechanics.
15. **The Haunted Plains** — Fight on a cursed battlefield where terrain transforms mid-battle (EffectNode system showcase).
16-19. **Dynamic campaign battles** — Generated from strategic layer state. Each unique.
20. **March on the Shadow Capital** — Massive final approach battle.

### 2.4 Act 4 — "The Final Stand" (Climax, Chapters 21-24)

**Multiple Endings** (based on Act 2-3 choices):
- **True Ending**: Full alliance, all characters alive — face the true threat behind the Shadow Legion
- **Sacrifice Ending**: Some allies lost, weaker position — pyrrhic victory
- **Fallen Ending**: Major failures — bitter ending, cycle continues

21. **The Inner Sanctum** — Dungeon crawl through shadow realm. Multi-floor, progressive difficulty.
22. **Comrades** — Defend the capital while strike team infiltrates. Auto-battle + manual split.
23. **The Shadow Crown** — Final boss battle. Multi-phase with scripted events, terrain changes.
24. **Epilogue** — Resolution varies by ending. Character-specific epilogues based on affinity.

---

## 3. Factions & Characters

### 3.1 Faction Design

| Faction | Territories | Playstyle | AI Personality |
|---------|-------------|-----------|----------------|
| Kingdom of Aldora (Player) | 5 start | Balanced | Player-controlled |
| Shadow Legion | 6 start | Aggressive, undead troops | blitz_conqueror |
| Northern Clans | 4 start | Hit-and-run, terrain experts | ambush_predator |
| Free City League | 3 start (Act 3) | Economic, mercenary-heavy | diplomat_king |
| Order of the Dawn | 2 start (Act 3) | Elite units, slow expansion | fortress_guardian |

### 3.2 Main Characters (Deep Profiles)

**Kael** — Protagonist
- Class: Swordsman -> Holy Knight -> Shadow Knight (Act 3 choice)
- Arc: Dutiful soldier -> reluctant rebel -> leader who must choose between mercy and pragmatism
- Mechanic: Cannot die (game over). Leadership buff scales with story progression.
- Key Moment: Act 2 Ch.11 — must choose to pursue the traitor or save civilians. Defines Act 3 relationships.

**Serra** — Heart of the team
- Class: Cleric -> Bishop -> Saint
- Arc: Quiet faith -> shattered by truth -> rebuilt conviction
- Mechanic: Unique healing skills. Affinity with Kael unlocks powerful dual skill "Sacred Light"
- Key Moment: Act 1 Ch.5 — discovers the conspiracy. Her reaction defines her Act 2 development.

**Lyra** — Realist pragmatist
- Class: Thief -> Assassin -> Phantom
- Arc: Mercenary -> invested ally -> will sacrifice everything if pushed
- Mechanic: Intel gathering (reveals enemy stats), first strike. Scout specialist on world map.
- Key Moment: Act 2 — her past in the Free Cities becomes leverage or liability.

**Zara** — Walking weapon
- Class: Dark Mage -> Shadowcaster -> Archmage
- Arc: Imprisoned experiment -> reluctant ally -> must confront her creators
- Mechanic: Highest damage but lowest defense. Affinity affects whether she stays or leaves in Act 3.
- Key Moment: Act 3 — Shadow Legion tries to reclaim her. Player choice: use her power (dark path) or protect her (light path).

### 3.3 Supporting Generals (9 total for strategic layer)

| General | Faction | Leadership | Key Trait |
|---------|---------|------------|-----------|
| Kael | Aldora | 14 | Protagonist, balanced |
| Lyra | Aldora | 8 | Scout specialist, fast |
| Serra | Aldora | 6 | Support, morale boost |
| Marcus | Aldora | 12 | Veteran commander, high defense |
| Thorne | Shadow | 18 | Shadow champion, aggressive |
| Mira | Shadow | 10 | Necromancer, undead troops |
| Vex | Shadow | 15 | Strategist, trap specialist |
| Grimjaw | Northern | 16 | Berserker chief, high offense |
| Yuki | Northern | 11 | Ranger, terrain specialist |

### 3.4 Recruitable/Hidden Generals (Act 2-3)

- **Old Man Kai** — Retired legendary general. Hidden quest in Act 2. Leadership 20, but injured (starts with 5-turn injury).
- **Elena** — Defector from Shadow Legion (if player's reputation is high enough).
- **Rook** — Free City mercenary captain. Hired with gold. Loyal only while paid.
- **Brother Aldric** — Dawn Order knight. Joins if alliance formed.

---

## 4. Strategic Campaign Design

### 4.1 World Map (Target: 25-30 nodes)

**Act 1** (linear): 5 story maps, no strategic layer
**Act 2** (opening): 13 nodes, expands to 20 as story progresses
**Act 3** (full): 25-30 nodes, 5 factions, full economy/diplomacy

### 4.2 Economy Balance

| Territory Type | Gold/turn | Food/turn | Troops/turn |
|---------------|-----------|-----------|-------------|
| Village | 100 | 200 | 300 |
| City | 300 | 100 | 200 |
| Fortress | 50 | 50 | 500 |
| Port | 400 | 150 | 100 |
| Pass | 0 | 0 | 100 |
| Camp | 50 | 100 | 200 |

### 4.3 Difficulty Curve

- **Act 1**: Story difficulty (forgiving, teaches mechanics progressively)
- **Act 2**: Tactical challenge (enemies get smarter, terrain matters)
- **Act 2 Strategic**: Introduction difficulty (limited decisions, guided)
- **Act 3**: Full difficulty (multiple fronts, resource pressure, time pressure)
- **Act 4**: Climax difficulty (elite enemies, no hand-holding)

### 4.4 Pacing Rules

- Maximum 3 mandatory battles between story beats
- Auto-battle available for weak enemies (player choice)
- Strategic turns should take 2-3 minutes each in Act 3
- No turn limit for Acts 1-2; Act 3 has soft pressure (Shadow Legion expands)
- Each act ends with a spectacle battle that lasts 15-30 minutes

---

## 5. Battle Design Highlights

### 5.1 Tutorial Progression (Act 1)

| Chapter | Mechanic Introduced |
|---------|-------------------|
| 1 | Move, attack, terrain bonus |
| 2 | Terrain advantage, survival tactics, healing |
| 3 | Tile objectives, skill usage, mage combat |
| 4 | Escort mechanics, formation, flanking |
| 5 | Indoor maps, assassination defense, reaction skills |
| 6 | Multi-phase battle, retreat mechanics |

### 5.2 Spectacle Battles

1. **Siege of Eastwall** (Act 2) — Walls as elevated terrain, catapult EffectNodes, reinforcement waves on turn 5/10/15
2. **Three-Way Pass** (Act 3) — 3 armies, fog of war, player chooses entry point
3. **Haunted Plains** (Act 3) — Terrain transforms: plains -> cursed -> lava over 5-turn cycle
4. **Shadow Capital** (Act 4) — Multi-floor, boss at end, allies provide buffs from adjacent floors
5. **Final Boss** (Act 4) — 3-phase fight, arena changes between phases, scripted dialogue mid-battle

### 5.3 Map Variety Targets

| Map Type | Count | Features |
|----------|-------|----------|
| Plains/outdoor | 8 | Open terrain, cavalry advantage |
| Forest/mountain | 5 | Elevation, terrain cover |
| Indoor/dungeon | 4 | Tight corridors, traps |
| Siege/fortress | 3 | Walls, gates, height advantage |
| Special | 4 | Water, cursed, multi-floor, arena |
| Total | 24+ | |

---

## 6. Implementation Roadmap

### Phase G-1: Act 1 Content (6 maps + story data)
- Create 6 MapData files (stage_01 through stage_06)
- Write dialogue JSON for each chapter
- Implement tutorial triggers
- Balance: 4-character squad, level 1-10

### Phase G-2: Act 2 Content (6 maps + strategic expansion)
- Expand world.json to 20 nodes
- Add 2 new factions to factions.json
- Create 6 battle maps + 4 strategic-triggered maps
- Implement story events (betrayal, alliance)
- Balance: 6-8 characters, level 10-20

### Phase G-3: Act 3 Content (strategic campaign)
- Expand world.json to 25-30 nodes
- 5 factions fully operational
- 10+ dynamic battle maps
- Economy balance tuning
- AI personality tuning per faction
- Balance: full roster, level 20-30

### Phase G-4: Act 4 + Polish
- 4 climactic battle maps
- Multiple ending logic
- Epilogue scenes
- Full balance pass
- Achievement system (stretch goal)

---

## 7. Data Requirements Summary

| Data Type | Current | Target |
|-----------|---------|--------|
| Maps (tactical) | 1 | 24+ |
| World nodes | 13 | 25-30 |
| World edges | 16 | 35-40 |
| Factions | 3 | 5 |
| Generals | 9 | 16-20 |
| Units (unique) | ~10 | 30-40 |
| Skills | ~10 | 40-50 |
| Equipment items | 10 | 30-40 |
| Job classes | 9 | 15-20 |
| Dialogue entries | 0 | 200+ |
| Audio tracks | 22 | 40-50 |
