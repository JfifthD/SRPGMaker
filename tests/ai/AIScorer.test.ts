import { describe, it, expect } from 'vitest';
import { AIScorer } from '@/engine/systems/ai/AIScorer';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { BattleState } from '@/engine/state/BattleState';
import type { MapData } from '@/engine/data/types/Map';

function makeUnit(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    dataId: 'test', instanceId: 'test',
    name: 'T', job: 'J', affinity: 'phys', team: 'ally',
    spriteKey: 'warrior', atkRange: 1,
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 5, spd: 4, skl: 10,
    x: 0, y: 0, facing: 'S',
    currentAP: 0, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null },
    skills: [], passiveEffects: [], aiType: 'aggressive',
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
    defeatCondition:  { type: 'all_allies_dead' },
  };
  return {
    gameProject: { manifest: {} as any, units: [], skillsMap: {}, terrainMap: {}, equipmentMap: {}, jobsMap: {} },
    mapData,
    units: Object.fromEntries(units.map(u => [u.instanceId, u])),
    turn: 1, phase: 'PLAYER_IDLE',
    selectedUnitId: null, activeUnitId: null, inputMode: 'idle',
    activeSkillId: null, busy: false, actionLog: [],
    stateHistory: [],
  } as BattleState;
}

describe('AIScorer', () => {
  it('killing blow earns large bonus', () => {
    const att = makeUnit({ instanceId: 'att', team: 'enemy', atk: 100 });
    const target = makeUnit({ instanceId: 'tgt', team: 'ally', hp: 1, maxHp: 50, def: 0 });
    const state = makeState([att, target]);

    const score = AIScorer.scoreAttack(att, target, state);
    // Kill bonus (+400) should make score very high
    expect(score).toBeGreaterThan(300);
  });

  it('low HP attacker gets lower attack score', () => {
    const healthyAtt = makeUnit({ instanceId: 'ha', team: 'enemy', hp: 50, maxHp: 50, atk: 20 });
    const lowHpAtt   = makeUnit({ instanceId: 'la', team: 'enemy', hp: 5,  maxHp: 50, atk: 20 });
    const target = makeUnit({ instanceId: 'tgt', team: 'ally', def: 0 });
    const state = makeState([healthyAtt, lowHpAtt, target]);

    const healthyScore = AIScorer.scoreAttack(healthyAtt, target, state);
    const lowHpScore   = AIScorer.scoreAttack(lowHpAtt,   target, state);

    expect(healthyScore).toBeGreaterThan(lowHpScore);
  });
});
