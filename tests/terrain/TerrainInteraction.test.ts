import { describe, it, expect, beforeEach } from 'vitest';
import { initTerrainRegistry, onSkillHitTile, onUnitEnterTile, getTerrainData } from '@/engine/systems/terrain/TerrainInteractionSystem';
import type { TerrainData } from '@/engine/data/types/Terrain';
import type { EffectNode } from '@/engine/data/types/EffectNode';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { EventBus } from '@/engine/utils/EventBus';

// ── Test Helpers ──

function makeUnit(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    dataId: 'test', instanceId: 'u1', name: 'TestUnit',
    job: 'warrior', affinity: 'phys', team: 'ally',
    spriteKey: 'spr', atkRange: 1, skills: [], passiveEffects: [],
    hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 10, skl: 5,
    x: 3, y: 3, facing: 'S',
    currentAP: 5, maxAP: 5, ct: 0,
    moved: false, acted: false, buffs: [], level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, aiType: 'aggressive',
    ...overrides,
  };
}

function makeState(units: UnitInstance[], terrainGrid?: string[][]): BattleState {
  const unitMap: Record<string, UnitInstance> = {};
  for (const u of units) unitMap[u.instanceId] = u;
  return {
    gameProject: { manifest: {} as any, units: [], skillsMap: {}, terrainMap: {} },
    mapData: {
      id: 'test', name: 'Test Map', width: 8, height: 8,
      terrain: terrainGrid ?? Array.from({ length: 8 }, () => Array(8).fill('plain')),
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

describe('TerrainInteractionSystem', () => {
  const fireReaction: EffectNode = {
    name: 'BurnOnFire',
    type: 'TerrainTransform',
    trigger: 'OnHitByTag',
    target: 'Tile',
    conditions: [{ type: 'HasTag', tag: 'Fire' }],
    payload: { transformTerrainTo: 'burning_forest' },
  };

  const forestTerrain: TerrainData = {
    key: 'forest', name: 'Forest', tileIndex: 2,
    defBonus: 20, atkBonus: 0, moveCost: 2, passable: true,
    tags: ['Forest'],
    reactions: [fireReaction],
  };

  const burningForestTerrain: TerrainData = {
    key: 'burning_forest', name: 'Burning Forest', tileIndex: 3,
    defBonus: 0, atkBonus: 0, moveCost: 1, passable: true,
    tags: ['Fire', 'Hazard'],
    reactions: [],
  };

  const plainTerrain: TerrainData = {
    key: 'plain', name: 'Plain', tileIndex: 0,
    defBonus: 0, atkBonus: 0, moveCost: 1, passable: true,
  };

  beforeEach(() => {
    EventBus.clear();
    initTerrainRegistry([plainTerrain, forestTerrain, burningForestTerrain]);
  });

  describe('initTerrainRegistry', () => {
    it('should register terrain data by key', () => {
      expect(getTerrainData('forest')).toBeDefined();
      expect(getTerrainData('forest')!.name).toBe('Forest');
    });

    it('should return undefined for unknown terrain', () => {
      expect(getTerrainData('lava')).toBeUndefined();
    });
  });

  describe('onSkillHitTile', () => {
    it('should transform forest to burning_forest when hit by Fire skill', () => {
      const terrain = Array.from({ length: 8 }, () => Array(8).fill('plain'));
      terrain[3]![3] = 'forest';
      const state = makeState([makeUnit({})], terrain);

      const newState = onSkillHitTile(state, 3, 3, ['Fire'], 'u1');

      expect(newState.mapData.terrain[3]![3]).toBe('burning_forest');
      expect(newState).not.toBe(state); // Immutability: new state object
    });

    it('should emit terrainChanged event on transform', () => {
      const events: any[] = [];
      EventBus.on('terrainChanged', (e: any) => events.push(e));

      const terrain = Array.from({ length: 8 }, () => Array(8).fill('plain'));
      terrain[2]![4] = 'forest';
      const state = makeState([], terrain);

      onSkillHitTile(state, 4, 2, ['Fire'], 'u1');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ x: 4, y: 2, from: 'forest', to: 'burning_forest' });
    });

    it('should NOT transform when skill tags do not match', () => {
      const terrain = Array.from({ length: 8 }, () => Array(8).fill('plain'));
      terrain[3]![3] = 'forest';
      const state = makeState([], terrain);

      const newState = onSkillHitTile(state, 3, 3, ['Ice'], 'u1');

      expect(newState.mapData.terrain[3]![3]).toBe('forest'); // Unchanged
      expect(newState).toBe(state); // Same reference (no mutation needed)
    });

    it('should NOT transform plain terrain (no reactions)', () => {
      const state = makeState([]);
      const newState = onSkillHitTile(state, 3, 3, ['Fire'], 'u1');
      expect(newState).toBe(state);
    });
  });

  describe('onUnitEnterTile', () => {
    it('should return empty results for plain terrain', () => {
      const state = makeState([makeUnit({})]);
      const results = onUnitEnterTile(state, 'u1', 3, 3);
      expect(results).toHaveLength(0);
    });

    it('should evaluate OnMoveEnter reactions for terrain with entry effects', () => {
      const hazardReaction: EffectNode = {
        name: 'BurnDamage',
        type: 'Damage',
        trigger: 'OnMoveEnter',
        target: 'TriggeringEntity',
        conditions: [],
        payload: { action: 'TileDamage', damageMultiplier: 0.1 },
      };

      const hazardTerrain: TerrainData = {
        key: 'burning_forest', name: 'Burning Forest', tileIndex: 3,
        defBonus: 0, atkBonus: 0, moveCost: 1, passable: true,
        tags: ['Fire', 'Hazard'],
        reactions: [hazardReaction],
      };

      initTerrainRegistry([plainTerrain, forestTerrain, hazardTerrain]);

      const terrain = Array.from({ length: 8 }, () => Array(8).fill('plain'));
      terrain[3]![3] = 'burning_forest';
      const state = makeState([makeUnit({})], terrain);

      const results = onUnitEnterTile(state, 'u1', 3, 3);
      expect(results).toHaveLength(1);
      expect(results[0]!.node.name).toBe('BurnDamage');
      expect(results[0]!.targets).toEqual(['u1']);
    });
  });
});
