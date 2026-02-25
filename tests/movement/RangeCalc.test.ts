import { describe, it, expect } from 'vitest';
import { RangeCalc } from '@/engine/systems/movement/RangeCalc';
import type { SkillData } from '@/engine/data/types/Skill';

function makeSkill(range: number, aoe = false): SkillData {
  return {
    id: 'test_skill', name: 'Test', type: 'phys', target: 'enemy',
    mp: 0, range, aoe, mult: 1.0,
    desc: '', tags: [],
  };
}

describe('RangeCalc.skillRange', () => {
  it('range=0 returns only the origin tile (self-cast)', () => {
    const origin = { x: 5, y: 5 };
    const sk = makeSkill(0);
    const tiles = RangeCalc.skillRange(origin, sk, 10, 10);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual({ x: 5, y: 5 });
  });

  it('range=1 returns 5 tiles in diamond shape on open map', () => {
    const origin = { x: 5, y: 5 };
    const sk = makeSkill(1);
    const tiles = RangeCalc.skillRange(origin, sk, 10, 10);
    // (5,5), (4,5), (6,5), (5,4), (5,6) = 5 tiles
    expect(tiles).toHaveLength(5);
    expect(tiles).toContainEqual({ x: 5, y: 5 });
    expect(tiles).toContainEqual({ x: 4, y: 5 });
    expect(tiles).toContainEqual({ x: 6, y: 5 });
    expect(tiles).toContainEqual({ x: 5, y: 4 });
    expect(tiles).toContainEqual({ x: 5, y: 6 });
  });

  it('range=2 returns 13 tiles in diamond shape on open map', () => {
    const origin = { x: 5, y: 5 };
    const sk = makeSkill(2);
    const tiles = RangeCalc.skillRange(origin, sk, 10, 10);
    // Manhattan distance <= 2: 1 + 4 + 8 = 13 tiles
    expect(tiles).toHaveLength(13);
  });

  it('clips tiles outside map bounds', () => {
    const origin = { x: 0, y: 0 };
    const sk = makeSkill(2);
    const tiles = RangeCalc.skillRange(origin, sk, 10, 10);
    // All tiles must be within [0,9] x [0,9]
    expect(tiles.every(t => t.x >= 0 && t.y >= 0)).toBe(true);
    // At corner, many tiles would be outside (negative coords), so should be < 13
    expect(tiles.length).toBeLessThan(13);
  });

  it('all tiles are within Manhattan distance of range from origin', () => {
    const origin = { x: 3, y: 3 };
    const sk = makeSkill(3);
    const tiles = RangeCalc.skillRange(origin, sk, 10, 10);
    for (const t of tiles) {
      const dist = Math.abs(t.x - origin.x) + Math.abs(t.y - origin.y);
      expect(dist).toBeLessThanOrEqual(3);
    }
  });

  it('includes the origin tile in range=1', () => {
    const origin = { x: 2, y: 2 };
    const sk = makeSkill(1);
    const tiles = RangeCalc.skillRange(origin, sk, 10, 10);
    expect(tiles).toContainEqual({ x: 2, y: 2 });
  });

  it('works correctly at map edge', () => {
    const origin = { x: 9, y: 9 };
    const sk = makeSkill(2);
    const tiles = RangeCalc.skillRange(origin, sk, 10, 10);
    // Should only include tiles within the map
    expect(tiles.every(t => t.x < 10 && t.y < 10)).toBe(true);
  });
});

describe('RangeCalc.aoeArea', () => {
  it('radius=0 returns just the center tile', () => {
    const centre = { x: 3, y: 3 };
    const tiles = RangeCalc.aoeArea(centre, 0, 10, 10);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual(centre);
  });

  it('radius=1 returns 5 tiles in diamond shape', () => {
    const centre = { x: 5, y: 5 };
    const tiles = RangeCalc.aoeArea(centre, 1, 10, 10);
    expect(tiles).toHaveLength(5);
    expect(tiles).toContainEqual({ x: 5, y: 5 });
    expect(tiles).toContainEqual({ x: 4, y: 5 });
    expect(tiles).toContainEqual({ x: 6, y: 5 });
    expect(tiles).toContainEqual({ x: 5, y: 4 });
    expect(tiles).toContainEqual({ x: 5, y: 6 });
  });

  it('radius=2 returns 13 tiles on open map', () => {
    const centre = { x: 5, y: 5 };
    const tiles = RangeCalc.aoeArea(centre, 2, 10, 10);
    expect(tiles).toHaveLength(13);
  });

  it('clips tiles outside map bounds', () => {
    const centre = { x: 0, y: 0 };
    const tiles = RangeCalc.aoeArea(centre, 2, 10, 10);
    expect(tiles.every(t => t.x >= 0 && t.y >= 0)).toBe(true);
    expect(tiles.length).toBeLessThan(13);
  });

  it('all tiles within Manhattan distance of radius', () => {
    const centre = { x: 4, y: 4 };
    const tiles = RangeCalc.aoeArea(centre, 2, 10, 10);
    for (const t of tiles) {
      const dist = Math.abs(t.x - centre.x) + Math.abs(t.y - centre.y);
      expect(dist).toBeLessThanOrEqual(2);
    }
  });
});
