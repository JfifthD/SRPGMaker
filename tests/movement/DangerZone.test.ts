import { describe, it, expect, beforeEach } from 'vitest';
import { buildDangerZone } from '@/engine/systems/movement/DangerZoneCalc';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { BFSContext } from '@/engine/systems/movement/BFS';
import type { TerrainData } from '@/engine/data/types/Terrain';

// ── Test Helpers ──

const plainTerrain: TerrainData = {
  key: 'plain', name: 'Plain', tileIndex: 0,
  defBonus: 0, atkBonus: 0, moveCost: 1, passable: true,
};

const wallTerrain: TerrainData = {
  key: 'wall', name: 'Wall', tileIndex: 1,
  defBonus: 0, atkBonus: 0, moveCost: 99, passable: false,
};

function makeUnit(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1', name: 'Test',
    job: 'warrior', affinity: 'phys', team: 'enemy',
    spriteKey: 'spr', atkRange: 1, skills: [], passiveEffects: [],
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 10, skl: 5,
    x: 0, y: 0, facing: 'S',
    currentAP: 3, maxAP: 5, ct: 0,
    moved: false, acted: false, buffs: [], level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, aiType: 'aggressive',
    ...overrides,
  };
}

function makeCtx(
  width: number,
  height: number,
  units: UnitInstance[],
  blocked: Set<string> = new Set(),
): BFSContext {
  return {
    width,
    height,
    getTerrain(x: number, y: number): TerrainData {
      return blocked.has(`${x},${y}`) ? wallTerrain : plainTerrain;
    },
    getUnit(x: number, y: number): UnitInstance | undefined {
      return units.find(u => u.x === x && u.y === y && u.hp > 0);
    },
  };
}

function makeState(units: UnitInstance[], width = 8, height = 8): BattleState {
  const unitMap: Record<string, UnitInstance> = {};
  for (const u of units) unitMap[u.instanceId] = u;
  return {
    gameProject: { manifest: {} as any, units: [], skillsMap: {}, terrainMap: {} },
    mapData: {
      id: 'test', name: 'Test Map', width, height,
      terrain: Array.from({ length: height }, () => Array(width).fill('plain')),
      allySpawns: [], enemySpawns: [],
      victoryCondition: { type: 'defeat_all' },
      defeatCondition: { type: 'all_allies_dead' },
    },
    units: unitMap,
    turn: 1,
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

describe('DangerZoneCalc', () => {
  it('should return empty set when no enemies exist', () => {
    const ally = makeUnit({ instanceId: 'a1', team: 'ally', x: 3, y: 3 });
    const state = makeState([ally]);
    const ctx = makeCtx(8, 8, [ally]);
    const zone = buildDangerZone(state, ctx);
    expect(zone.size).toBe(0);
  });

  it('should compute danger zone for a single stationary enemy', () => {
    // Enemy at (0,0) with maxAP=0 (can't move), atkRange=1
    // Should only threaten adjacent tiles from current position
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy', x: 0, y: 0, currentAP: 0, maxAP: 0, atkRange: 1 });
    const state = makeState([enemy]);
    const ctx = makeCtx(8, 8, [enemy]);
    const zone = buildDangerZone(state, ctx);

    // With maxAP=0, enemy can only be at (0,0). Attack range 1 reaches (1,0), (0,1)
    expect(zone.has('0,0')).toBe(true);
    expect(zone.has('1,0')).toBe(true);
    expect(zone.has('0,1')).toBe(true);
    // Should not reach far tiles
    expect(zone.has('5,5')).toBe(false);
  });

  it('should compute danger zone for enemy with movement + attack range', () => {
    // Enemy at (3,3) with maxAP=3, atkRange=1 → max threat range = 4 tiles from center
    const enemy = makeUnit({ instanceId: 'e1', team: 'enemy', x: 3, y: 3, currentAP: 2, maxAP: 3, atkRange: 1 });
    const state = makeState([enemy]);
    const ctx = makeCtx(8, 8, [enemy]);
    const zone = buildDangerZone(state, ctx);

    // Center tile should be in zone
    expect(zone.has('3,3')).toBe(true);
    // 3 move + 1 attack = 4 tiles from center
    expect(zone.has('7,3')).toBe(true);  // 4 right
    expect(zone.has('3,7')).toBe(true);  // 4 down
  });

  it('should merge danger zones from multiple enemies', () => {
    // maxAP=2 → can move 2, atkRange=1 → threat 3 tiles from start
    const e1 = makeUnit({ instanceId: 'e1', team: 'enemy', x: 0, y: 0, currentAP: 1, maxAP: 2, atkRange: 1 });
    const e2 = makeUnit({ instanceId: 'e2', team: 'enemy', x: 7, y: 7, currentAP: 1, maxAP: 2, atkRange: 1 });
    const state = makeState([e1, e2]);
    const ctx = makeCtx(8, 8, [e1, e2]);
    const zone = buildDangerZone(state, ctx);

    // Both corners should be dangerous
    expect(zone.has('0,0')).toBe(true);
    expect(zone.has('7,7')).toBe(true);
    // Center should NOT be dangerous (2 move + 1 attack = 3 tiles from corners)
    expect(zone.has('4,4')).toBe(false);
  });

  it('should ignore dead enemies', () => {
    const dead = makeUnit({ instanceId: 'e1', team: 'enemy', x: 3, y: 3, hp: 0 });
    const state = makeState([dead]);
    const ctx = makeCtx(8, 8, [dead]);
    const zone = buildDangerZone(state, ctx);
    expect(zone.size).toBe(0);
  });
});
