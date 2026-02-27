import { describe, it, expect } from 'vitest';
import { evaluate } from '@/engine/systems/stage/StageConditionSystem';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { StageCondition } from '@/engine/data/types/Map';

// ── Test Helpers ──

function makeUnit(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1', name: 'Test',
    job: 'warrior', affinity: 'phys', team: 'ally',
    spriteKey: 'spr', atkRange: 1, skills: [], passiveEffects: [],
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 10, skl: 5,
    x: 0, y: 0, facing: 'S',
    currentAP: 5, maxAP: 5, ct: 0,
    moved: false, acted: false, buffs: [], level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, aiType: 'aggressive',
    ...overrides,
  };
}

function makeState(
  units: UnitInstance[],
  opts: {
    turn?: number;
    winConditions?: StageCondition[];
    lossConditions?: StageCondition[];
  } = {},
): BattleState {
  const unitMap: Record<string, UnitInstance> = {};
  for (const u of units) unitMap[u.instanceId] = u;
  return {
    gameProject: { manifest: {} as any, units: [], skillsMap: {}, terrainMap: {}, equipmentMap: {}, jobsMap: {} },
    mapData: {
      id: 'test', name: 'Test', width: 10, height: 10,
      terrain: Array.from({ length: 10 }, () => Array(10).fill('plain')),
      allySpawns: [], enemySpawns: [],
      winConditions: opts.winConditions,
      lossConditions: opts.lossConditions,
      victoryCondition: { type: 'defeat_all' },
      defeatCondition: { type: 'all_allies_dead' },
    },
    units: unitMap,
    turn: opts.turn ?? 1,
    phase: 'PLAYER_IDLE',
    selectedUnitId: null,
    activeUnitId: null,
    inputMode: 'idle',
    activeSkillId: null,
    busy: false,
    actionLog: [],
    stateHistory: [],
  } as BattleState;
}

// ── Tests ──

describe('StageConditionSystem.evaluate', () => {

  // ── defeat_all (default / backwards compat) ──

  it('returns VICTORY when no enemies remain (default defeat_all)', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    const state = makeState([ally]);
    expect(evaluate(state)).toBe('VICTORY');
  });

  it('returns ONGOING when live enemies exist (default defeat_all)', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy]);
    expect(evaluate(state)).toBe('ONGOING');
  });

  // ── all_allies_dead (default loss) ──

  it('returns DEFEAT when all allies are dead', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally', hp: 0 });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy]);
    expect(evaluate(state)).toBe('DEFEAT');
  });

  // ── defeat_target ──

  it('returns VICTORY when target unit is defeated', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    const grunt = makeUnit({ instanceId: 'e_grunt_0', team: 'enemy', dataId: 'e_grunt' });
    const boss = makeUnit({ instanceId: 'boss_0', team: 'enemy', dataId: 'boss', hp: 0 });
    const state = makeState([ally, grunt, boss], {
      winConditions: [{ type: 'defeat_target', targetUnitId: 'boss' }],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    expect(evaluate(state)).toBe('VICTORY');
  });

  it('returns ONGOING when target unit is still alive', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    const boss = makeUnit({ instanceId: 'boss_0', team: 'enemy', dataId: 'boss', hp: 30 });
    const state = makeState([ally, boss], {
      winConditions: [{ type: 'defeat_target', targetUnitId: 'boss' }],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    expect(evaluate(state)).toBe('ONGOING');
  });

  // ── reach_tile (any_ally) ──

  it('returns VICTORY when any ally reaches the target tile', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally', x: 9, y: 9 });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy], {
      winConditions: [{ type: 'reach_tile', x: 9, y: 9, reachUnitId: 'any_ally' }],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    expect(evaluate(state)).toBe('VICTORY');
  });

  it('returns ONGOING when ally has not reached the target tile', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally', x: 0, y: 0 });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy], {
      winConditions: [{ type: 'reach_tile', x: 9, y: 9, reachUnitId: 'any_ally' }],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    expect(evaluate(state)).toBe('ONGOING');
  });

  // ── reach_tile (specific unit) ──

  it('returns VICTORY when specific unit reaches the tile', () => {
    const leader = makeUnit({ instanceId: 'leader', dataId: 'leader', team: 'ally', x: 5, y: 5 });
    const other = makeUnit({ instanceId: 'other', team: 'ally', x: 5, y: 5 });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([leader, other, enemy], {
      winConditions: [{ type: 'reach_tile', x: 5, y: 5, reachUnitId: 'leader' }],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    expect(evaluate(state)).toBe('VICTORY');
  });

  // ── survive_turns ──

  it('returns VICTORY when turn count exceeds survival requirement', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy], {
      turn: 11,
      winConditions: [{ type: 'survive_turns', turns: 10 }],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    expect(evaluate(state)).toBe('VICTORY');
  });

  it('returns ONGOING when not enough turns have passed', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy], {
      turn: 5,
      winConditions: [{ type: 'survive_turns', turns: 10 }],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    expect(evaluate(state)).toBe('ONGOING');
  });

  // ── protect_target (loss) ──

  it('returns DEFEAT when protected unit dies', () => {
    const npc = makeUnit({ instanceId: 'npc', dataId: 'npc', team: 'ally', hp: 0 });
    const hero = makeUnit({ instanceId: 'hero', team: 'ally' });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([npc, hero, enemy], {
      winConditions: [{ type: 'defeat_all' }],
      lossConditions: [{ type: 'protect_target', targetUnitId: 'npc' }],
    });
    expect(evaluate(state)).toBe('DEFEAT');
  });

  it('returns ONGOING when protected unit is alive', () => {
    const npc = makeUnit({ instanceId: 'npc', dataId: 'npc', team: 'ally', hp: 30 });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([npc, enemy], {
      winConditions: [{ type: 'defeat_all' }],
      lossConditions: [{ type: 'protect_target', targetUnitId: 'npc' }],
    });
    expect(evaluate(state)).toBe('ONGOING');
  });

  // ── turn_limit (loss) ──

  it('returns DEFEAT when turn limit is exceeded', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy], {
      turn: 21,
      winConditions: [{ type: 'defeat_all' }],
      lossConditions: [{ type: 'turn_limit', turns: 20 }],
    });
    expect(evaluate(state)).toBe('DEFEAT');
  });

  // ── Priority: loss checked first ──

  it('returns DEFEAT when both win and loss conditions are met simultaneously', () => {
    // All enemies dead (win) + protected NPC also dead (loss) → DEFEAT wins
    const npc = makeUnit({ instanceId: 'npc', dataId: 'npc', team: 'ally', hp: 0 });
    const hero = makeUnit({ instanceId: 'hero', team: 'ally' });
    const state = makeState([npc, hero], {
      winConditions: [{ type: 'defeat_all' }],
      lossConditions: [{ type: 'protect_target', targetUnitId: 'npc' }],
    });
    expect(evaluate(state)).toBe('DEFEAT');
  });

  // ── OR logic across conditions ──

  it('returns VICTORY when any of multiple win conditions is met', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally', x: 9, y: 9 });
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy' });
    const state = makeState([ally, enemy], {
      winConditions: [
        { type: 'defeat_all' },
        { type: 'reach_tile', x: 9, y: 9, reachUnitId: 'any_ally' },
      ],
      lossConditions: [{ type: 'all_allies_dead' }],
    });
    // defeat_all is not met (enemy alive), but reach_tile IS met → VICTORY
    expect(evaluate(state)).toBe('VICTORY');
  });

  // ── Legacy backwards compatibility ──

  it('falls back to legacy victoryCondition when winConditions is empty', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally' });
    // No enemies → legacy defeat_all should still trigger VICTORY
    const state = makeState([ally]);
    expect(evaluate(state)).toBe('VICTORY');
  });
});
