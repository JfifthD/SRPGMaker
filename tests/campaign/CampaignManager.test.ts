import { describe, it, expect, beforeEach } from 'vitest';
import { CampaignManager, createDefaultCampaign } from '@/engine/systems/campaign/CampaignManager';
import type { CampaignDefinition, StageEntry, CampaignState } from '@/engine/data/types/Campaign';
import type { UnitInstance } from '@/engine/data/types/Unit';

// ── Helpers ──

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

const testDefinition: CampaignDefinition = {
  id: 'test-campaign',
  name: 'Test Campaign',
  stages: [
    { id: 'stage_01', name: 'Stage 1', mapId: 'stage_01', order: 0, preDialogue: 'pre_01' },
    { id: 'stage_02', name: 'Stage 2', mapId: 'stage_02', order: 1 },
    { id: 'stage_03', name: 'Stage 3', mapId: 'stage_03', order: 2, postDialogue: 'post_03' },
  ],
};

// ── Tests ──

describe('createDefaultCampaign', () => {
  it('returns a fresh campaign state', () => {
    const cs = createDefaultCampaign();
    expect(cs.currentStageIdx).toBe(0);
    expect(cs.roster).toEqual([]);
    expect(cs.inventory).toEqual({});
    expect(cs.flags).toEqual({});
    expect(cs.completedStages).toEqual([]);
  });
});

describe('CampaignManager', () => {
  let mgr: CampaignManager;

  beforeEach(() => {
    mgr = new CampaignManager();
    mgr.setDefinition(testDefinition);
  });

  // ── Stage Queries ──

  describe('getUnlockedStages', () => {
    it('returns only stage_01 initially (currentStageIdx=0)', () => {
      const unlocked = mgr.getUnlockedStages();
      expect(unlocked).toHaveLength(1);
      expect(unlocked[0]!.id).toBe('stage_01');
    });

    it('returns stages 01 and 02 after completing stage_01', () => {
      mgr.completeStage('stage_01');
      const unlocked = mgr.getUnlockedStages();
      expect(unlocked).toHaveLength(2);
      expect(unlocked.map(s => s.id)).toContain('stage_02');
    });
  });

  describe('getCurrentStage', () => {
    it('returns stage_01 initially', () => {
      expect(mgr.getCurrentStage()?.id).toBe('stage_01');
    });

    it('returns stage_02 after completing stage_01', () => {
      mgr.completeStage('stage_01');
      expect(mgr.getCurrentStage()?.id).toBe('stage_02');
    });
  });

  describe('getStage', () => {
    it('returns the correct stage by ID', () => {
      expect(mgr.getStage('stage_02')?.name).toBe('Stage 2');
    });

    it('returns null for unknown stage', () => {
      expect(mgr.getStage('stage_99')).toBeNull();
    });
  });

  describe('isUnlocked / isCompleted', () => {
    it('stage_01 is unlocked initially', () => {
      expect(mgr.isUnlocked('stage_01')).toBe(true);
    });

    it('stage_02 is NOT unlocked initially', () => {
      expect(mgr.isUnlocked('stage_02')).toBe(false);
    });

    it('isCompleted returns false before completion', () => {
      expect(mgr.isCompleted('stage_01')).toBe(false);
    });

    it('isCompleted returns true after completion', () => {
      mgr.completeStage('stage_01');
      expect(mgr.isCompleted('stage_01')).toBe(true);
    });
  });

  // ── Progression ──

  describe('completeStage', () => {
    it('advances currentStageIdx after completion', () => {
      mgr.completeStage('stage_01');
      expect(mgr.state.currentStageIdx).toBe(1);
    });

    it('does not double-count completion', () => {
      mgr.completeStage('stage_01');
      mgr.completeStage('stage_01');
      expect(mgr.state.completedStages.filter(s => s === 'stage_01')).toHaveLength(1);
    });

    it('unlocks all previous stages when completing a later one', () => {
      // Set state as if stage_01 is already completed
      mgr.completeStage('stage_01');
      mgr.completeStage('stage_02');
      expect(mgr.state.currentStageIdx).toBe(2);
      expect(mgr.getUnlockedStages()).toHaveLength(3);
    });
  });

  // ── Roster ──

  describe('initRoster / updateRoster', () => {
    it('initializes roster with given units', () => {
      const units = [makeUnit({ instanceId: 'hero', dataId: 'hero' })];
      mgr.initRoster(units);
      expect(mgr.state.roster).toHaveLength(1);
      expect(mgr.state.roster[0]!.dataId).toBe('hero');
    });

    it('updateRoster merges surviving allies back (hp reset to max)', () => {
      const hero = makeUnit({ instanceId: 'hero', dataId: 'hero', hp: 50 });
      mgr.initRoster([hero]);

      const battleSurvivor = makeUnit({ instanceId: 'hero_inst', dataId: 'hero', hp: 20, level: 3 });
      mgr.updateRoster([battleSurvivor]);

      expect(mgr.state.roster[0]!.hp).toBe(50); // Reset to maxHp
      expect(mgr.state.roster[0]!.level).toBe(3); // Level preserved from battle
    });
  });

  // ── Flags ──

  describe('setFlag / getFlag', () => {
    it('sets and reads flags', () => {
      mgr.setFlag('boss_defeated');
      expect(mgr.getFlag('boss_defeated')).toBe(true);
    });

    it('returns false for unset flags', () => {
      expect(mgr.getFlag('nonexistent')).toBe(false);
    });
  });

  // ── Inventory ──

  describe('addItem', () => {
    it('adds items to inventory', () => {
      mgr.addItem('potion', 3);
      expect(mgr.state.inventory['potion']).toBe(3);
    });

    it('accumulates items', () => {
      mgr.addItem('potion', 2);
      mgr.addItem('potion', 5);
      expect(mgr.state.inventory['potion']).toBe(7);
    });
  });

  // ── State Persistence ──

  describe('setState', () => {
    it('replaces entire state', () => {
      const saved: CampaignState = {
        currentStageIdx: 2,
        roster: [],
        inventory: { gold: 500 },
        flags: { boss_defeated: true },
        completedStages: ['stage_01', 'stage_02'],
      };
      mgr.setState(saved);
      expect(mgr.state.currentStageIdx).toBe(2);
      expect(mgr.state.inventory['gold']).toBe(500);
      expect(mgr.state.completedStages).toHaveLength(2);
    });
  });
});
