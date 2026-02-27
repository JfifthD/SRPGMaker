import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, registerScript, clearScripts, getScript } from '@/engine/systems/effectnode/EffectNodeRunner';
import type { EffectNode, EffectContext } from '@/engine/data/types/EffectNode';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';

// ── Test Helpers ──

function makeUnit(overrides: Partial<UnitInstance>): UnitInstance {
  return {
    dataId: 'test',
    instanceId: 'u1',
    name: 'TestUnit',
    job: 'warrior',
    affinity: 'phys',
    team: 'ally',
    spriteKey: 'spr',
    atkRange: 1,
    skills: [],
    passiveEffects: [],
    hp: 50, maxHp: 50,
    mp: 10, maxMp: 10,
    atk: 20, def: 10, spd: 10, skl: 5,
    x: 3, y: 3, facing: 'S',
    currentAP: 5, maxAP: 5, ct: 0,
    moved: false, acted: false,
    buffs: [], level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null },
    aiType: 'aggressive',
    ...overrides,
  };
}

function makeState(units: UnitInstance[]): BattleState {
  const unitMap: Record<string, UnitInstance> = {};
  for (const u of units) unitMap[u.instanceId] = u;
  return {
    gameProject: { manifest: {} as any, units: [], skillsMap: {}, terrainMap: {}, equipmentMap: {}, jobsMap: {} },
    mapData: {
      id: 'test', name: 'Test Map', width: 8, height: 8,
      terrain: Array.from({ length: 8 }, () => Array(8).fill('plain')),
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

describe('EffectNodeRunner', () => {
  beforeEach(() => {
    clearScripts();
  });

  describe('evaluate()', () => {
    it('should return matching effects for the correct trigger', () => {
      const nodes: EffectNode[] = [
        {
          name: 'Counter',
          type: 'ReactionStrike',
          trigger: 'OnAfterDamaged',
          target: 'TriggeringEntity',
          conditions: [],
          payload: { action: 'BasicAttack' },
        },
        {
          name: 'Buff',
          type: 'ApplyBuff',
          trigger: 'OnTurnStart',
          target: 'Self',
          conditions: [],
          payload: { buff: { stat: 'atk', val: 5, dur: 2 } },
        },
      ];

      const ctx: EffectContext = {
        ownerId: 'u1',
        triggeringEntityId: 'u2',
        currentTrigger: 'OnAfterDamaged',
      };

      const state = makeState([makeUnit({ instanceId: 'u1' }), makeUnit({ instanceId: 'u2', team: 'enemy', x: 4, y: 3 })]);
      const results = evaluate(nodes, 'OnAfterDamaged', ctx, state);

      expect(results).toHaveLength(1);
      expect(results[0]!.node.name).toBe('Counter');
      expect(results[0]!.targets).toEqual(['u2']);
    });

    it('should filter by conditions', () => {
      const nodes: EffectNode[] = [
        {
          name: 'ZOC_Strike',
          type: 'ReactionStrike',
          trigger: 'OnMoveLeave',
          target: 'TriggeringEntity',
          conditions: [
            { type: 'IsEnemy' },
            { type: 'Distance', op: '==', value: 1 },
          ],
          payload: { action: 'BasicAttack', interruptMovement: true },
        },
      ];

      const ally = makeUnit({ instanceId: 'u1', team: 'ally', x: 3, y: 3 });
      const enemy = makeUnit({ instanceId: 'u2', team: 'enemy', x: 4, y: 3 });
      const state = makeState([ally, enemy]);

      // Enemy triggering — IsEnemy should be true from ally's perspective
      const ctx: EffectContext = {
        ownerId: 'u1',
        triggeringEntityId: 'u2',
        currentTrigger: 'OnMoveLeave',
        distance: 1,
      };

      const results = evaluate(nodes, 'OnMoveLeave', ctx, state);
      expect(results).toHaveLength(1);
      expect(results[0]!.interruptMovement).toBe(true);
    });

    it('should fail conditions when IsEnemy check fails (same team)', () => {
      const nodes: EffectNode[] = [
        {
          name: 'ZOC_Strike',
          type: 'ReactionStrike',
          trigger: 'OnMoveLeave',
          target: 'TriggeringEntity',
          conditions: [{ type: 'IsEnemy' }],
          payload: { action: 'BasicAttack' },
        },
      ];

      const ally1 = makeUnit({ instanceId: 'u1', team: 'ally', x: 3, y: 3 });
      const ally2 = makeUnit({ instanceId: 'u3', team: 'ally', x: 4, y: 3 });
      const state = makeState([ally1, ally2]);

      const ctx: EffectContext = {
        ownerId: 'u1',
        triggeringEntityId: 'u3',
        currentTrigger: 'OnMoveLeave',
      };

      const results = evaluate(nodes, 'OnMoveLeave', ctx, state);
      expect(results).toHaveLength(0);
    });

    it('should resolve AlliesInRange targets', () => {
      const nodes: EffectNode[] = [
        {
          name: 'HealAllies',
          type: 'Heal',
          trigger: 'OnTurnStart',
          target: 'AlliesInRange',
          conditions: [],
          payload: { action: 'Heal', range: 2 },
        },
      ];

      const healer = makeUnit({ instanceId: 'healer', team: 'ally', x: 3, y: 3 });
      const nearAlly = makeUnit({ instanceId: 'near', team: 'ally', x: 4, y: 3 });
      const farAlly = makeUnit({ instanceId: 'far', team: 'ally', x: 8, y: 8 }); // Out of range
      const state = makeState([healer, nearAlly, farAlly]);

      // Fix state: the far ally is at 8,8 which is out of 8x8 map bounds for range=2
      const ctx: EffectContext = {
        ownerId: 'healer',
        currentTrigger: 'OnTurnStart',
      };

      const results = evaluate(nodes, 'OnTurnStart', ctx, state);
      expect(results).toHaveLength(1);
      expect(results[0]!.targets).toContain('near');
      expect(results[0]!.targets).not.toContain('far');
      expect(results[0]!.targets).not.toContain('healer'); // Self excluded
    });

    it('should respect priority ordering', () => {
      const nodes: EffectNode[] = [
        {
          name: 'LowPriority',
          type: 'Effect',
          trigger: 'OnAfterDamaged',
          target: 'Self',
          conditions: [],
          payload: { action: 'LowAction' },
          priority: 1,
        },
        {
          name: 'HighPriority',
          type: 'Effect',
          trigger: 'OnAfterDamaged',
          target: 'Self',
          conditions: [],
          payload: { action: 'HighAction' },
          priority: 10,
        },
      ];

      const ctx: EffectContext = {
        ownerId: 'u1',
        currentTrigger: 'OnAfterDamaged',
      };

      const state = makeState([makeUnit({ instanceId: 'u1' })]);
      const results = evaluate(nodes, 'OnAfterDamaged', ctx, state);

      expect(results).toHaveLength(2);
      expect(results[0]!.node.name).toBe('HighPriority');
      expect(results[1]!.node.name).toBe('LowPriority');
    });

    it('should evaluate HasTag condition', () => {
      const nodes: EffectNode[] = [
        {
          name: 'FireReaction',
          type: 'TerrainTransform',
          trigger: 'OnHitByTag',
          target: 'Tile',
          conditions: [{ type: 'HasTag', tag: 'Fire' }],
          payload: { transformTerrainTo: 'burning_forest' },
        },
      ];

      const ctx: EffectContext = {
        ownerId: 'terrain_3_3',
        currentTrigger: 'OnHitByTag',
        tags: ['Fire'],
        position: { x: 3, y: 3 },
      };

      const state = makeState([]);
      const results = evaluate(nodes, 'OnHitByTag', ctx, state);

      expect(results).toHaveLength(1);
      expect(results[0]!.payload.transformTerrainTo).toBe('burning_forest');
      expect(results[0]!.targets).toEqual(['3,3']);
    });

    it('should fail HasTag when tag is not present', () => {
      const nodes: EffectNode[] = [
        {
          name: 'FireReaction',
          type: 'TerrainTransform',
          trigger: 'OnHitByTag',
          target: 'Tile',
          conditions: [{ type: 'HasTag', tag: 'Fire' }],
          payload: { transformTerrainTo: 'burning_forest' },
        },
      ];

      const ctx: EffectContext = {
        ownerId: 'terrain_3_3',
        currentTrigger: 'OnHitByTag',
        tags: ['Ice'],
        position: { x: 3, y: 3 },
      };

      const state = makeState([]);
      const results = evaluate(nodes, 'OnHitByTag', ctx, state);

      expect(results).toHaveLength(0);
    });
  });

  describe('Script Registry', () => {
    it('should register and retrieve scripts', () => {
      const fn = () => {};
      registerScript('test_script', fn);
      expect(getScript('test_script')).toBe(fn);
    });

    it('should return undefined for unregistered scripts', () => {
      expect(getScript('nonexistent')).toBeUndefined();
    });

    it('should clear all scripts', () => {
      registerScript('a', () => {});
      registerScript('b', () => {});
      clearScripts();
      expect(getScript('a')).toBeUndefined();
      expect(getScript('b')).toBeUndefined();
    });
  });

  describe('TargetInWeaponRange condition', () => {
    it('should pass when target is within weapon range', () => {
      const nodes: EffectNode[] = [
        {
          name: 'ChainAssist',
          type: 'ReactionStrike',
          trigger: 'OnAllyAttacking',
          target: 'EventTarget',
          conditions: [{ type: 'TargetInWeaponRange' }],
          payload: { action: 'BasicAttack', damageMultiplier: 0.5, apCost: 0 },
        },
      ];

      const owner = makeUnit({ instanceId: 'assist', team: 'ally', x: 3, y: 3, atkRange: 1 });
      const target = makeUnit({ instanceId: 'enemy', team: 'enemy', x: 4, y: 3 });
      const state = makeState([owner, target]);

      const ctx: EffectContext = {
        ownerId: 'assist',
        triggeringEntityId: 'attacker',
        eventTargetId: 'enemy',
        currentTrigger: 'OnAllyAttacking',
      };

      const results = evaluate(nodes, 'OnAllyAttacking', ctx, state);
      expect(results).toHaveLength(1);
      expect(results[0]!.targets).toEqual(['enemy']);
    });

    it('should fail when target is out of weapon range', () => {
      const nodes: EffectNode[] = [
        {
          name: 'ChainAssist',
          type: 'ReactionStrike',
          trigger: 'OnAllyAttacking',
          target: 'EventTarget',
          conditions: [{ type: 'TargetInWeaponRange' }],
          payload: { action: 'BasicAttack' },
        },
      ];

      const owner = makeUnit({ instanceId: 'assist', team: 'ally', x: 0, y: 0, atkRange: 1 });
      const target = makeUnit({ instanceId: 'enemy', team: 'enemy', x: 5, y: 5 });
      const state = makeState([owner, target]);

      const ctx: EffectContext = {
        ownerId: 'assist',
        eventTargetId: 'enemy',
        currentTrigger: 'OnAllyAttacking',
      };

      const results = evaluate(nodes, 'OnAllyAttacking', ctx, state);
      expect(results).toHaveLength(0);
    });
  });
});
