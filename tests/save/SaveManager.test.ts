import { describe, it, expect } from 'vitest';
import { createSnapshot, restoreState } from '@/engine/systems/save/SaveManager';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { GameProject } from '@/engine/data/types/GameProject';

// ── Test Helpers ──

function makeUnit(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1', name: 'Test',
    job: 'warrior', affinity: 'phys', team: 'ally',
    spriteKey: 'spr', atkRange: 1, skills: [], passiveEffects: [],
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 10, skl: 5,
    x: 3, y: 4, facing: 'S',
    currentAP: 5, maxAP: 5, ct: 0,
    moved: false, acted: false, buffs: [], level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, aiType: 'aggressive',
    ...overrides,
  };
}

const stubGameProject: GameProject = {
  manifest: { id: 'test', name: 'Test', version: '0.1.0', engineVersion: '>=0.1.0', entryMap: 'stage_01', data: { units: '', skills: '', terrains: '', mapsDir: '' } },
  units: [],
  skillsMap: {},
  terrainMap: {},
  equipmentMap: {},
  jobsMap: {},
  audioConfig: null,
  worldMap: null,
  factionsData: null,
  generalsData: null,
  diplomacyData: null,
};

function makeState(): BattleState {
  const ally = makeUnit({ instanceId: 'a1', team: 'ally', x: 1, y: 2 });
  const enemy = makeUnit({ instanceId: 'e1', team: 'enemy', x: 5, y: 6 });
  return {
    gameProject: stubGameProject,
    mapData: {
      id: 'stage_01', name: 'Test Map', width: 10, height: 10,
      terrain: Array.from({ length: 10 }, () => Array(10).fill('plain')),
      allySpawns: [], enemySpawns: [],
      victoryCondition: { type: 'defeat_all' },
      defeatCondition: { type: 'all_allies_dead' },
    },
    units: { a1: ally, e1: enemy },
    turn: 7,
    phase: 'PLAYER_IDLE',
    selectedUnitId: 'a1',
    activeUnitId: 'a1',
    inputMode: 'move',
    activeSkillId: null,
    busy: true,
    actionLog: ['Move a1 to (1,2)'],
    stateHistory: [{} as BattleState, {} as BattleState], // Mock entries
  } as BattleState;
}

// ── Tests ──

describe('SaveManager — createSnapshot', () => {
  it('preserves unit data in snapshot', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    expect(snap.units['a1']!.x).toBe(1);
    expect(snap.units['a1']!.y).toBe(2);
    expect(snap.units['e1']!.x).toBe(5);
  });

  it('preserves turn, phase, and map info', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    expect(snap.turn).toBe(7);
    expect(snap.phase).toBe('PLAYER_IDLE');
    expect(snap.mapData.id).toBe('stage_01');
  });

  it('resets busy to false in snapshot', () => {
    const state = makeState();
    expect(state.busy).toBe(true);
    const snap = createSnapshot(state);
    expect(snap.busy).toBe(false);
  });

  it('preserves actionLog', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    expect(snap.actionLog).toEqual(['Move a1 to (1,2)']);
  });

  it('does NOT include gameProject in snapshot', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    expect((snap as any).gameProject).toBeUndefined();
  });

  it('does NOT include stateHistory in snapshot', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    expect((snap as any).stateHistory).toBeUndefined();
  });
});

describe('SaveManager — restoreState', () => {
  it('reconstructs a full BattleState from snapshot + gameProject', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    const restored = restoreState(snap, stubGameProject);

    expect(restored.gameProject).toBe(stubGameProject);
    expect(restored.turn).toBe(7);
    expect(restored.phase).toBe('PLAYER_IDLE');
    expect(restored.units['a1']!.x).toBe(1);
  });

  it('initializes stateHistory as empty array', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    const restored = restoreState(snap, stubGameProject);
    expect(restored.stateHistory).toEqual([]);
  });

  it('sets busy to false regardless of snapshot', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    const restored = restoreState(snap, stubGameProject);
    expect(restored.busy).toBe(false);
  });

  it('snapshot → restore roundtrip preserves all unit stats', () => {
    const state = makeState();
    const snap = createSnapshot(state);
    const restored = restoreState(snap, stubGameProject);

    const originalAlly = state.units['a1']!;
    const restoredAlly = restored.units['a1']!;
    expect(restoredAlly.hp).toBe(originalAlly.hp);
    expect(restoredAlly.atk).toBe(originalAlly.atk);
    expect(restoredAlly.currentAP).toBe(originalAlly.currentAP);
    expect(restoredAlly.ct).toBe(originalAlly.ct);
    expect(restoredAlly.buffs).toEqual(originalAlly.buffs);
  });
});
