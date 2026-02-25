import { describe, it, expect } from 'vitest';
import { ThreatMapCalc } from '@/engine/systems/ai/ThreatMap';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { BattleState } from '@/engine/state/BattleState';
import type { MapData } from '@/engine/data/types/Map';

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    dataId: 'test', instanceId: 'test',
    name: 'T', job: 'J', affinity: 'phys', team: 'ally',
    spriteKey: 'warrior', atkRange: 1,
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 5, spd: 4, skl: 10,
    x: 0, y: 0, facing: 'S',
    currentAP: 0, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1,
    skills: [],
    ...overrides,
  };
}

function makeState(units: UnitInstance[], width = 8, height = 8): BattleState {
  const mapData: MapData = {
    id: 'test', name: 'test', width, height,
    terrain: Array.from({ length: height }, () => new Array(width).fill('plain')),
    elevation: Array.from({ length: height }, () => new Array(width).fill(0)),
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

describe('ThreatMapCalc.build', () => {
  it('returns a grid of correct dimensions', () => {
    const state = makeState([], 6, 4);
    const grid = ThreatMapCalc.build(state, { team: 'ally' });
    expect(grid).toHaveLength(4);         // height rows
    expect(grid[0]).toHaveLength(6);      // width columns
  });

  it('all tiles are 0 when no enemies present', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally', x: 3, y: 3 });
    const state = makeState([ally]);
    const grid = ThreatMapCalc.build(state, { team: 'ally' });
    for (const row of grid) {
      for (const cell of row) {
        expect(cell).toBe(0);
      }
    }
  });

  it('tiles in enemy attack range have non-zero threat', () => {
    // enemy at (3,3) with atkRange=1 threatens (2,3),(4,3),(3,2),(3,4),(3,3)
    const enemy = makeUnit({
      instanceId: 'e1', team: 'enemy', x: 3, y: 3, atk: 30, atkRange: 1,
    });
    const state = makeState([enemy]);
    const grid = ThreatMapCalc.build(state, { team: 'ally' });

    // At least the tiles adjacent to enemy should have threat > 0
    const adjacentThreat =
      (grid[3]?.[2] ?? 0) +   // left
      (grid[3]?.[4] ?? 0) +   // right
      (grid[2]?.[3] ?? 0) +   // above
      (grid[4]?.[3] ?? 0);    // below

    expect(adjacentThreat).toBeGreaterThan(0);
  });

  it('builds threat for enemy perspective (viewing ally threats)', () => {
    const ally = makeUnit({
      instanceId: 'a1', team: 'ally', x: 2, y: 2, atk: 40, atkRange: 1,
    });
    const state = makeState([ally]);
    // From enemy's perspective, allies are the threat
    const grid = ThreatMapCalc.build(state, { team: 'enemy' });
    // At least some tile adjacent to ally should be threatened
    const threat =
      (grid[2]?.[1] ?? 0) +   // left
      (grid[2]?.[3] ?? 0);    // right
    expect(threat).toBeGreaterThan(0);
  });

  it('enemy with higher ATK produces higher threat values', () => {
    const weakEnemy = makeUnit({ instanceId: 'e_weak', team: 'enemy', x: 3, y: 3, atk: 10, atkRange: 1 });
    const strongEnemy = makeUnit({ instanceId: 'e_strong', team: 'enemy', x: 3, y: 3, atk: 60, atkRange: 1 });

    const stateWeak   = makeState([weakEnemy]);
    const stateStrong = makeState([strongEnemy]);

    const gridWeak   = ThreatMapCalc.build(stateWeak,   { team: 'ally' });
    const gridStrong = ThreatMapCalc.build(stateStrong, { team: 'ally' });

    const threatWeak   = gridWeak[3]?.[2] ?? 0;
    const threatStrong = gridStrong[3]?.[2] ?? 0;

    expect(threatStrong).toBeGreaterThan(threatWeak);
  });
});

describe('ThreatMapCalc.threatAt', () => {
  it('returns 0 for an empty grid tile', () => {
    const state = makeState([]);
    const grid = ThreatMapCalc.build(state, { team: 'ally' });
    expect(ThreatMapCalc.threatAt(grid, 0, 0)).toBe(0);
  });

  it('returns 0 for out-of-bounds coordinates', () => {
    const state = makeState([]);
    const grid = ThreatMapCalc.build(state, { team: 'ally' });
    expect(ThreatMapCalc.threatAt(grid, 999, 999)).toBe(0);
  });

  it('returns threat value set in grid', () => {
    const grid: number[][] = [[5, 10], [0, 15]];
    expect(ThreatMapCalc.threatAt(grid, 1, 0)).toBe(10);
    expect(ThreatMapCalc.threatAt(grid, 1, 1)).toBe(15);
    expect(ThreatMapCalc.threatAt(grid, 0, 0)).toBe(5);
  });
});
