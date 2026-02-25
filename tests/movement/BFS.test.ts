import { describe, it, expect } from 'vitest';
import { BFS } from '@/engine/systems/movement/BFS';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { TerrainData } from '@/engine/data/types/Terrain';
import type { BFSContext } from '@/engine/systems/movement/BFS';

// ── Helpers ──────────────────────────────────

const plainT: TerrainData = {
  key: 'plain', name: '평지', tileIndex: 0,
  defBonus: 0, atkBonus: 0, moveCost: 1, passable: true,
};
const wallT: TerrainData = {
  key: 'wall', name: '성벽', tileIndex: 4,
  defBonus: 8, atkBonus: 0, moveCost: 99, passable: false,
};
const forestT: TerrainData = {
  key: 'forest', name: '숲', tileIndex: 1,
  defBonus: 3, atkBonus: 0, moveCost: 2, passable: true,
};

function makeUnit(x: number, y: number, spd: number, team: 'ally' | 'enemy' = 'ally'): UnitInstance {
  return {
    dataId: 'test', instanceId: `u_${x}_${y}`,
    name: 'T', job: 'J', affinity: 'phys', team,
    spriteKey: 'warrior', atkRange: 1,
    hp: 50, maxHp: 50, mp: 0, maxMp: 0,
    atk: 10, def: 5, spd, skl: 10,
    x, y, facing: 'S',
    currentAP: spd, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1,
    skills: [], passiveEffects: [],
  };
}

function emptyCtx(w = 10, h = 10): BFSContext {
  return {
    width: w, height: h,
    getTerrain: () => plainT,
    getUnit: () => undefined,
  };
}

// ── Tests ──────────────────────────────────

describe('BFS.reachable', () => {
  it('includes the starting tile', () => {
    const unit = makeUnit(5, 5, 3);
    const result = BFS.reachable(unit, emptyCtx());
    expect(result.some(t => t.x === 5 && t.y === 5)).toBe(true);
  });

  it('SPD=0 can only stay in place', () => {
    const unit = makeUnit(5, 5, 0);
    const result = BFS.reachable(unit, emptyCtx());
    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({ x: 5, y: 5, cost: 0 });
  });

  it('SPD=1 reaches 4 adjacent tiles on open ground', () => {
    const unit = makeUnit(5, 5, 1);
    const result = BFS.reachable(unit, emptyCtx());
    // Start + 4 adjacent
    expect(result.length).toBe(5);
  });

  it('cannot move through walls', () => {
    const unit = makeUnit(5, 5, 4);
    const ctx: BFSContext = {
      width: 10, height: 10,
      getTerrain: (x, y) => (x === 6 ? wallT : plainT),
      getUnit: () => undefined,
    };
    const result = BFS.reachable(unit, ctx);
    // None of the reachable tiles should have x >= 6
    expect(result.every(t => t.x <= 5 || t.x === 5)).toBe(true);
    expect(result.some(t => t.x === 6)).toBe(false);
  });

  it('forest tiles cost 2 movement', () => {
    const unit = makeUnit(0, 0, 2);
    const ctx: BFSContext = {
      width: 10, height: 10,
      // All tiles are forest
      getTerrain: () => forestT,
      getUnit: () => undefined,
    };
    const result = BFS.reachable(unit, ctx);
    // With SPD 2, can reach TWO tiles away through forest: (1,0) and (0,1)
    const reached = result.filter(t => !(t.x === 0 && t.y === 0));
    expect(reached.length).toBe(2); 
  });

  it('cannot end on an enemy tile', () => {
    const unit = makeUnit(0, 0, 3);
    const enemy = makeUnit(1, 0, 3, 'enemy');
    const ctx: BFSContext = {
      width: 10, height: 10,
      getTerrain: () => plainT,
      getUnit: (x, y) => (x === 1 && y === 0 ? enemy : undefined),
    };
    const result = BFS.reachable(unit, ctx);
    // (1,0) is occupied by enemy → cannot reach
    expect(result.some(t => t.x === 1 && t.y === 0)).toBe(false);
  });

  it('stays within grid bounds', () => {
    const unit = makeUnit(0, 0, 5);
    const result = BFS.reachable(unit, emptyCtx(4, 4));
    expect(result.every(t => t.x >= 0 && t.x < 4 && t.y >= 0 && t.y < 4)).toBe(true);
  });
});

describe('BFS.findPath', () => {
  it('finds a simple path on open ground', () => {
    const unit = makeUnit(0, 0, 10);
    const ctx = emptyCtx();
    const path = BFS.findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, unit, ctx);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3); // 3 steps: (1,0), (2,0), (3,0)
    expect(path![path!.length - 1]).toMatchObject({ x: 3, y: 0 });
  });

  it('returns null if goal is blocked', () => {
    const unit = makeUnit(0, 0, 10);
    const ctx: BFSContext = {
      width: 5, height: 1,
      getTerrain: (x) => (x >= 1 ? wallT : plainT),
      getUnit: () => undefined,
    };
    const path = BFS.findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, unit, ctx);
    expect(path).toBeNull();
  });
});
