import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { BattleState } from '@/engine/state/BattleState';
import type { MapData } from '@/engine/data/types/Map';
import type { SkillData } from '@/engine/data/types/Skill';
import type { TerrainData } from '@/engine/data/types/Terrain';

// Mock Pathworker before any imports that use it
vi.mock('@/engine/systems/movement/PathfindingWorkerClient', () => ({
  Pathworker: {
    getReachable: vi.fn().mockResolvedValue([]),
    getPath: vi.fn().mockResolvedValue(null),
  },
}));

// Mock GameProjectLoader — provide real skill/terrain data for chooseBestSkill tests
vi.mock('@/engine/loader/GameProjectLoader', async () => {
  const skillsJson = (await import('@/assets/data/skills.json')).default as Record<string, SkillData>;
  const terrainJson = (await import('@/assets/data/terrains.json')).default as TerrainData[];
  const terrainMap = Object.fromEntries(terrainJson.map(t => [t.key, t]));
  return {
    getSkillsMap: () => skillsJson,
    getTerrainMap: () => terrainMap,
    setGameContext: vi.fn(),
    loadGameProject: vi.fn(),
  };
});

// Import after mock is in place
import { EnemyAI } from '@/engine/systems/ai/EnemyAI';
import { Pathworker } from '@/engine/systems/movement/PathfindingWorkerClient';

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    dataId: 'test', instanceId: 'test',
    name: 'T', job: 'J', affinity: 'phys', team: 'ally',
    spriteKey: 'warrior', atkRange: 1,
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 5, spd: 4, skl: 10,
    x: 0, y: 0, facing: 'S',
    currentAP: 3, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1,
    skills: [], passiveEffects: [],
    aiType: 'aggressive', // default personality
    ...overrides,
  };
}

function makeState(units: UnitInstance[]): BattleState {
  const mapData: MapData = {
    id: 'test', name: 'test', width: 10, height: 10,
    terrain: Array.from({ length: 10 }, () => new Array(10).fill('plain')),
    elevation: Array.from({ length: 10 }, () => new Array(10).fill(0)),
    allySpawns: [], enemySpawns: [],
    victoryCondition: { type: 'defeat_all' },
    defeatCondition: { type: 'all_allies_dead' },
  };
  return {
    mapData,
    units: Object.fromEntries(units.map(u => [u.instanceId, u])),
    turn: 1, phase: 'PLAYER_IDLE',
    selectedUnitId: null, activeUnitId: null, inputMode: 'idle',
    activeSkillId: null, busy: false, actionLog: [],
    stateHistory: [],
  };
}

beforeEach(() => {
  vi.mocked(Pathworker.getReachable).mockResolvedValue([]);
  vi.mocked(Pathworker.getPath).mockResolvedValue(null);
});

// ── EnemyAI.pickTarget ─────────────────────────────────────────────

describe('EnemyAI.pickTarget', () => {
  it('picks nearest ally when none are in attack range', () => {
    const enemy = makeUnit({ instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 1 });
    const near  = makeUnit({ instanceId: 'near', team: 'ally', x: 3, y: 0 });
    const far   = makeUnit({ instanceId: 'far',  team: 'ally', x: 8, y: 0 });
    const state = makeState([enemy, near, far]);

    const target = EnemyAI.pickTarget(enemy, [near, far], state);
    expect(target.instanceId).toBe('near');
  });

  it('picks lowest HP ally when multiple are in attack range', () => {
    const enemy  = makeUnit({ instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 3 });
    const weakly = makeUnit({ instanceId: 'weak', team: 'ally', x: 1, y: 0, hp: 10 });
    const sturdy = makeUnit({ instanceId: 'sturdy', team: 'ally', x: 2, y: 0, hp: 40 });
    const state  = makeState([enemy, weakly, sturdy]);

    const target = EnemyAI.pickTarget(enemy, [sturdy, weakly], state);
    expect(target.instanceId).toBe('weak');
  });

  it('picks the only ally available', () => {
    const enemy = makeUnit({ instanceId: 'e', team: 'enemy', x: 5, y: 5, atkRange: 1 });
    const ally  = makeUnit({ instanceId: 'a', team: 'ally', x: 9, y: 9 });
    const state = makeState([enemy, ally]);

    const target = EnemyAI.pickTarget(enemy, [ally], state);
    expect(target.instanceId).toBe('a');
  });

  it('[defensive] picks the highest ATK ally', () => {
    const enemy  = makeUnit({ instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 5, aiType: 'defensive' });
    const weakAtk  = makeUnit({ instanceId: 'w', team: 'ally', x: 1, y: 0, atk: 5  });
    const strongAtk = makeUnit({ instanceId: 's', team: 'ally', x: 2, y: 0, atk: 40 });
    const state     = makeState([enemy, weakAtk, strongAtk]);

    const target = EnemyAI.pickTarget(enemy, [weakAtk, strongAtk], state);
    expect(target.instanceId).toBe('s'); // targets the bigger threat
  });

  it('[support] picks the nearest ally', () => {
    const enemy = makeUnit({ instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 1, aiType: 'support' });
    const near  = makeUnit({ instanceId: 'near', team: 'ally', x: 2, y: 0 });
    const far   = makeUnit({ instanceId: 'far',  team: 'ally', x: 9, y: 0 });
    const state = makeState([enemy, near, far]);

    const target = EnemyAI.pickTarget(enemy, [near, far], state);
    expect(target.instanceId).toBe('near');
  });
});

// ── EnemyAI.chooseBestSkill ────────────────────────────────────────

describe('EnemyAI.chooseBestSkill', () => {
  it('returns null when enemy has no skills', () => {
    const enemy = makeUnit({ instanceId: 'e', team: 'enemy', skills: [], mp: 10 });
    const ally  = makeUnit({ instanceId: 'a', team: 'ally', x: 1, y: 0 });
    const state = makeState([enemy, ally]);

    expect(EnemyAI.chooseBestSkill(enemy, [ally], state)).toBeNull();
  });

  it('returns null when enemy has no MP', () => {
    const enemy = makeUnit({ instanceId: 'e', team: 'enemy', skills: ['m_fire'], mp: 0 });
    const ally  = makeUnit({ instanceId: 'a', team: 'ally', x: 1, y: 0 });
    const state = makeState([enemy, ally]);

    expect(EnemyAI.chooseBestSkill(enemy, [ally], state)).toBeNull();
  });

  it('returns null when all skills target self or ally only', () => {
    // w_shield is a self-buff, w_iron_guard targets self
    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0,
      skills: ['w_shield'], mp: 10,
    });
    const ally  = makeUnit({ instanceId: 'a', team: 'ally', x: 1, y: 0 });
    const state = makeState([enemy, ally]);

    expect(EnemyAI.chooseBestSkill(enemy, [ally], state)).toBeNull();
  });

  it('returns a SkillAction when a valid enemy-targeting skill is in range', () => {
    // m_fire: range=3, targets enemy, aoe=true, mp=4
    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0,
      skills: ['m_fire'], mp: 10, atk: 30,
    });
    const ally  = makeUnit({
      instanceId: 'a', team: 'ally', x: 2, y: 0, // within range 3
      hp: 50, def: 5,
    });
    const state = makeState([enemy, ally]);

    const action = EnemyAI.chooseBestSkill(enemy, [ally], state);
    expect(action).not.toBeNull();
  });

  it('returns null when ally is out of skill range', () => {
    // m_fire range=3, ally at distance 9 → out of range
    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0,
      skills: ['m_fire'], mp: 10,
    });
    const ally  = makeUnit({ instanceId: 'a', team: 'ally', x: 9, y: 0 });
    const state = makeState([enemy, ally]);

    expect(EnemyAI.chooseBestSkill(enemy, [ally], state)).toBeNull();
  });
});

// ── EnemyAI.decide ────────────────────────────────────────────────

describe('EnemyAI.decide', () => {
  it('returns WaitAction when no allies are alive', async () => {
    const enemy = makeUnit({ instanceId: 'e', team: 'enemy' });
    const state = makeState([enemy]); // no allies

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.constructor.name).toBe('WaitAction');
  });

  it('attacks when ally is within attack range', async () => {
    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 2, skills: [], mp: 0,
    });
    const ally = makeUnit({ instanceId: 'a', team: 'ally', x: 1, y: 0 });
    const state = makeState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    const hasAttack = actions.some(a => a.constructor.name === 'AttackAction');
    expect(hasAttack).toBe(true);
  });

  it('uses WaitAction when enemy cannot reach and A* returns null', async () => {
    vi.mocked(Pathworker.getPath).mockResolvedValue(null);
    vi.mocked(Pathworker.getReachable).mockResolvedValue([]);

    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 1, skills: [], mp: 0,
    });
    const ally = makeUnit({ instanceId: 'a', team: 'ally', x: 9, y: 9 });
    const state = makeState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.constructor.name).toBe('WaitAction');
  });

  it('uses skill when in range and returns one action', async () => {
    // m_fire: range=3, aoe=true, mp=4
    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0,
      skills: ['m_fire'], mp: 10, atk: 30,
    });
    const ally = makeUnit({
      instanceId: 'a', team: 'ally', x: 2, y: 0,
      hp: 50, def: 5,
    });
    const state = makeState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.constructor.name).toBe('SkillAction');
  });
});

// ── EnemyAI.chooseBestMove ────────────────────────────────────────

describe('EnemyAI.chooseBestMove', () => {
  it('returns null when no reachable tiles', async () => {
    vi.mocked(Pathworker.getPath).mockResolvedValue(null);
    vi.mocked(Pathworker.getReachable).mockResolvedValue([]);

    const enemy  = makeUnit({ instanceId: 'e', team: 'enemy', x: 0, y: 0 });
    const target = makeUnit({ instanceId: 't', team: 'ally',  x: 5, y: 5 });
    const state  = makeState([enemy, target]);

    const move = await EnemyAI.chooseBestMove(enemy, target, state);
    expect(move).toBeNull();
  });

  it('returns MoveAction when A* finds a valid path', async () => {
    // A* returns a path, and reachable contains the intermediate tiles
    vi.mocked(Pathworker.getPath).mockResolvedValue([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    vi.mocked(Pathworker.getReachable).mockResolvedValue([
      { x: 0, y: 0, cost: 0 },
      { x: 1, y: 0, cost: 1 },
      { x: 2, y: 0, cost: 2 },
    ]);

    const enemy  = makeUnit({ instanceId: 'e', team: 'enemy', x: 0, y: 0 });
    const target = makeUnit({ instanceId: 't', team: 'ally',  x: 2, y: 0 });
    const state  = makeState([enemy, target]);

    const move = await EnemyAI.chooseBestMove(enemy, target, state);
    expect(move).not.toBeNull();
    expect(move?.constructor.name).toBe('MoveAction');
  });

  it('uses fallback heuristic scoring when A* returns null but reachable tiles exist', async () => {
    vi.mocked(Pathworker.getPath).mockResolvedValue(null);
    vi.mocked(Pathworker.getReachable).mockResolvedValue([
      { x: 0, y: 0, cost: 0 },
      { x: 1, y: 0, cost: 1 },
      { x: 2, y: 0, cost: 2 },
    ]);

    const enemy  = makeUnit({ instanceId: 'e', team: 'enemy', x: 0, y: 0 });
    const target = makeUnit({ instanceId: 't', team: 'ally',  x: 5, y: 0 });
    const state  = makeState([enemy, target]);

    const move = await EnemyAI.chooseBestMove(enemy, target, state);
    // Best reachable tile should be x=2 (closest to target at x=5)
    expect(move).not.toBeNull();
    expect(move?.constructor.name).toBe('MoveAction');
  });
});

// ── AI Personality: decide() ───────────────────────────────────────

describe('EnemyAI personality — decide()', () => {
  it('[aggressive] attacks the lowest HP ally in range (original behavior)', async () => {
    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 3, skills: [], mp: 0,
      aiType: 'aggressive',
    });
    const weakAlly   = makeUnit({ instanceId: 'weak', team: 'ally', x: 1, y: 0, hp: 5  });
    const strongAlly = makeUnit({ instanceId: 'str',  team: 'ally', x: 2, y: 0, hp: 50 });
    const state = makeState([enemy, weakAlly, strongAlly]);

    const actions = await EnemyAI.decide(enemy, state);

    // Should end with an AttackAction (aggressive units attack rather than wait)
    const hasAttack = actions.some(a => a.constructor.name === 'AttackAction');
    const hasWait   = actions.some(a => a.constructor.name === 'WaitAction');
    expect(hasAttack).toBe(true);
    expect(hasWait).toBe(false);
  });

  it('[defensive] retreats when HP is below 50%', async () => {
    // Pathworker returns tiles further away from the ally
    vi.mocked(Pathworker.getPath).mockResolvedValue(null);
    vi.mocked(Pathworker.getReachable).mockResolvedValue([
      { x: 0, y: 0, cost: 0 },
      { x: 0, y: 1, cost: 1 }, // farther from ally at (1,0)
    ]);

    const enemy = makeUnit({
      instanceId: 'e', team: 'enemy', x: 0, y: 0, atkRange: 1, skills: [], mp: 0,
      hp: 20, maxHp: 65,   // 30% HP → below defensive retreat threshold of 50%
      aiType: 'defensive',
    });
    const ally = makeUnit({ instanceId: 'a', team: 'ally', x: 1, y: 0, atk: 25 });
    const state = makeState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);

    // Should have a MoveAction (retreating), NOT an AttackAction
    const hasMove   = actions.some(a => a.constructor.name === 'MoveAction');
    const hasAttack = actions.some(a => a.constructor.name === 'AttackAction');
    expect(hasMove).toBe(true);
    expect(hasAttack).toBe(false);
  });

  it('[support] returns WaitAction when no skill targets are in range and cannot attack', async () => {
    vi.mocked(Pathworker.getPath).mockResolvedValue(null);
    vi.mocked(Pathworker.getReachable).mockResolvedValue([]);

    const necro = makeUnit({
      instanceId: 'necro', team: 'enemy', x: 5, y: 5, atkRange: 1,
      skills: [], mp: 0, aiType: 'support',
    });
    const ally = makeUnit({ instanceId: 'a', team: 'ally', x: 0, y: 0 }); // far away
    const state = makeState([necro, ally]);

    const actions = await EnemyAI.decide(necro, state);
    expect(actions[0]?.constructor.name).toBe('WaitAction');
  });
});
