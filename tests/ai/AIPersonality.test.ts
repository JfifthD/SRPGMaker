import { describe, it, expect, vi } from 'vitest';

vi.mock('@/engine/systems/movement/PathfindingWorkerClient', () => ({
  Pathworker: {
    getReachable: vi.fn().mockImplementation((unit) => {
      // Mock reachable: just a small 3x3 box around unit for tests
      const reach = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          reach.push({ x: unit.x + dx, y: unit.y + dy, cost: 1 });
        }
      }
      return Promise.resolve(reach);
    }),
    getPath: vi.fn().mockImplementation((start, end) => {
      return Promise.resolve([start, end]); // Simplified path
    }),
  },
}));

vi.mock('@/engine/systems/ai/AIScorer', () => ({
  AIScorer: {
    scoreMove: vi.fn().mockImplementation((unit, dest, target) => {
      // Simple mock: closer to target = higher score
      const dist = Math.abs(dest.x - target.x) + Math.abs(dest.y - target.y);
      return -dist; 
    }),
    scoreSkill: vi.fn().mockReturnValue(0),
    scoreAttack: vi.fn().mockReturnValue(50),
  }
}));

import { EnemyAI } from '@/engine/systems/ai/EnemyAI';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance, AIType, AIConfig } from '@/engine/data/types/Unit';
import { WaitAction } from '@/engine/state/actions/WaitAction';
import { MoveAction } from '@/engine/state/actions/MoveAction';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import type { MapData } from '@/engine/data/types/Map';

// ── Helpers ──

function mockUnit(
  id: string, x: number, y: number, team: 'ally' | 'enemy',
  aiType: AIType = 'aggressive', aiConfig?: AIConfig,
  overrides: Partial<UnitInstance> = {}
): UnitInstance {
  const unit: UnitInstance = {
    dataId: id, instanceId: id, name: id, job: 'soldier', affinity: 'phys',
    team, spriteKey: 'spr', atkRange: 1, skills: [], passiveEffects: [],
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 4, skl: 5,
    x, y, facing: 'S', currentAP: 5, maxAP: 5, ct: 0,
    moved: false, acted: false, buffs: [], level: 1, exp: 0,
    equipment: { weapon: null, armor: null, accessory: null },
    aiType,
    ...overrides
  };
  if (aiConfig) unit.aiConfig = aiConfig;
  return unit;
}

function setupState(units: UnitInstance[]): BattleState {
  const mapData: MapData = {
    id: 'test', name: 'test', width: 20, height: 20,
    terrain: Array.from({ length: 20 }, () => new Array(20).fill('plain')),
    elevation: Array.from({ length: 20 }, () => new Array(20).fill(0)),
    allySpawns: [], enemySpawns: [],
    victoryCondition: { type: 'defeat_all' },
    defeatCondition: { type: 'all_allies_dead' },
  };
  return {
    gameProject: { skillsMap: {}, terrainMap: { 'plain': { key: 'plain', name: 'Plain', defBonus: 0, hitBonus: 0, moveCost: 1 } } },
    mapData,
    units: Object.fromEntries(units.map(u => [u.instanceId, u])),
    turn: 1, phase: 'PLAYER_IDLE',
    selectedUnitId: null, activeUnitId: null, inputMode: 'idle',
    activeSkillId: null, busy: false, actionLog: [],
    stateHistory: [],
  } as unknown as BattleState;
}

// ── Tests ──

describe('AI Personality - Detect Range', () => {
  it('returns WaitAction if no allies are within detectRange', async () => {
    const enemy = mockUnit('e1', 0, 0, 'enemy', 'aggressive', { detectRange: 3 });
    const ally = mockUnit('a1', 5, 0, 'ally'); // dist = 5
    const state = setupState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions[0]).toBeInstanceOf(WaitAction);
  });

  it('acts normally if an ally is within detectRange', async () => {
    const enemy = mockUnit('e1', 0, 0, 'enemy', 'aggressive', { detectRange: 3 });
    const ally = mockUnit('a1', 2, 0, 'ally'); // dist = 2
    const state = setupState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    // Should try to move or attack
    expect(actions[0]).not.toBeInstanceOf(WaitAction);
  });
});

describe('AI Personality - Patrol', () => {
  it('moves towards the next patrol waypoint if not provoked', async () => {
    const enemy = mockUnit('e1', 0, 0, 'enemy', 'patrol', { 
      detectRange: 2, 
      patrolPath: [{x: 0, y: 3}, {x: 3, y: 3}] 
    });
    const ally = mockUnit('a1', 5, 5, 'ally'); // out of range
    const state = setupState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions[0]).toBeInstanceOf(MoveAction);
    const m = actions[0] as MoveAction;
    // Should move downwards towards (0,3)
    expect(m.destination.y).toBeGreaterThan(0);
    expect(m.destination.x).toBe(0);
  });

  it('attacks if an ally enters detectRange during patrol', async () => {
    const enemy = mockUnit('e1', 0, 0, 'enemy', 'patrol', { 
      detectRange: 2, 
      patrolPath: [{x: 0, y: 3}, {x: 3, y: 3}] 
    });
    const ally = mockUnit('a1', 1, 0, 'ally'); // within attack/detect range
    const state = setupState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions[0]).toBeInstanceOf(AttackAction);
  });
});

describe('AI Personality - Boss Guard Tile', () => {
  it('waits if on guard tile and no target in attack range', async () => {
    const enemy = mockUnit('boss', 5, 5, 'enemy', 'boss', { guardTile: {x: 5, y: 5} });
    const ally = mockUnit('a1', 8, 8, 'ally'); // out of attack range (dist 6)
    const state = setupState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions[0]).toBeInstanceOf(WaitAction);
  });

  it('moves back to guard tile if displaced and no target in range', async () => {
    const enemy = mockUnit('boss', 4, 5, 'enemy', 'boss', { guardTile: {x: 5, y: 5} });
    const ally = mockUnit('a1', 8, 8, 'ally'); // out of attack range
    const state = setupState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions[0]).toBeInstanceOf(MoveAction);
    const m = actions[0] as MoveAction;
    expect(m.destination.x).toBe(5);
    expect(m.destination.y).toBe(5);
  });

  it('attacks if target enters attack range regardless of guard tile', async () => {
    const enemy = mockUnit('boss', 5, 5, 'enemy', 'boss', { guardTile: {x: 5, y: 5} }, { atkRange: 2 });
    const ally = mockUnit('a1', 5, 6, 'ally'); // within attack range
    const state = setupState([enemy, ally]);

    const actions = await EnemyAI.decide(enemy, state);
    expect(actions[0]).toBeInstanceOf(AttackAction);
  });
});

describe('AI Personality - Target Priority Overrides', () => {
  it('respects healer_first priority', () => {
    const enemy = mockUnit('e1', 0, 0, 'enemy', 'aggressive', { targetPriority: 'healer_first' });
    const allyWarrior = mockUnit('a1', 1, 0, 'ally', 'aggressive', undefined, { job: 'Warrior' });
    const allyCleric = mockUnit('a2', 3, 0, 'ally', 'support', undefined, { job: 'Cleric' });
    
    // Nearest is Warrior, but heuristic should pick Cleric
    const state = setupState([enemy, allyWarrior, allyCleric]);
    const target = EnemyAI.pickTarget(enemy, [allyWarrior, allyCleric], state);
    
    expect(target.instanceId).toBe('a2');
  });

  it('respects strongest priority', () => {
    const enemy = mockUnit('e1', 0, 0, 'enemy', 'aggressive', { targetPriority: 'strongest' });
    const ally1 = mockUnit('a1', 1, 0, 'ally', 'aggressive', undefined, { atk: 10 });
    const ally2 = mockUnit('a2', 2, 0, 'ally', 'aggressive', undefined, { atk: 50 }); // Strongest
    
    const state = setupState([enemy, ally1, ally2]);
    const target = EnemyAI.pickTarget(enemy, [ally1, ally2], state);
    
    expect(target.instanceId).toBe('a2');
  });
});
