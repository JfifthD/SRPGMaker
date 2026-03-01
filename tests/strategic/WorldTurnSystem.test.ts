import { describe, it, expect, beforeEach } from 'vitest';
import { WorldTurnSystem } from '@/engine/strategic/systems/WorldTurnSystem';
import { WorldStore } from '@/engine/strategic/state/WorldStore';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';
import { resetArmyIdCounter } from '@/engine/strategic/systems/ArmySystem';
import type { FactionData } from '@/engine/strategic/data/types/Faction';
import type { GeneralData } from '@/engine/strategic/data/types/General';
import type { DiplomacyState } from '@/engine/strategic/data/types/Diplomacy';
import type { WorldMapData } from '@/engine/strategic/data/types/World';

const worldMap: WorldMapData = {
  mapWidth: 800, mapHeight: 600,
  nodes: [
    { id: 'A', name: 'A', x: 100, y: 100, type: 'city', terrain: 'plains', visionRadius: 5, defenseBonus: 0, maxUpgradeSlots: 2 },
    { id: 'B', name: 'B', x: 300, y: 100, type: 'village', terrain: 'plains', visionRadius: 3, defenseBonus: 0, maxUpgradeSlots: 1 },
    { id: 'C', name: 'C', x: 500, y: 100, type: 'city', terrain: 'plains', visionRadius: 5, defenseBonus: 0, maxUpgradeSlots: 2 },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', terrain: 'plains', passable: true, bidirectional: true, moveCost: 1 },
    { id: 'e2', from: 'B', to: 'C', terrain: 'plains', passable: true, bidirectional: true, moveCost: 1 },
  ],
};

const factions: FactionData[] = [
  {
    id: 'f1', name: 'Blue', color: 0x0000ff, leader: 'g1', capital: 'A',
    aiProfile: {}, startTerritories: ['A', 'B'], startGenerals: ['g1'],
    startResources: { gold: 100, food: 100, troops: 100 }, isPlayer: true,
  },
  {
    id: 'f2', name: 'Red', color: 0xff0000, leader: 'g2', capital: 'C',
    aiProfile: { preset: 'blitz_conqueror' }, startTerritories: ['C'], startGenerals: ['g2'],
    startResources: { gold: 100, food: 100, troops: 100 },
  },
];

const generals: GeneralData[] = [
  { id: 'g1', name: 'Hero', unitDataId: 'knight', leadership: 10, intellect: 5, politics: 3, charm: 4 },
  { id: 'g2', name: 'Villain', unitDataId: 'mage', leadership: 8, intellect: 7, politics: 5, charm: 6 },
];

const diplomacy: DiplomacyState = {
  relations: {
    f1: { f2: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
    f2: { f1: { status: 'war', favorability: -80, treatyTurnsLeft: 0 } },
  },
};

let store: WorldStore;

beforeEach(() => {
  WorldEventBus.clear();
  resetArmyIdCounter();
  store = new WorldStore();
  store.init(worldMap, factions, generals, diplomacy, 'f1', 'g1');
});

describe('WorldTurnSystem', () => {
  // ── transition ──────────────────────────────────────────

  describe('transition', () => {
    it('valid player_actions → ai_actions returns true', () => {
      expect(store.getState().phase).toBe('player_actions');
      const ok = WorldTurnSystem.transition(store, 'ai_actions');
      expect(ok).toBe(true);
      expect(store.getState().phase).toBe('ai_actions');
    });

    it('invalid player_actions → battle_active returns false', () => {
      expect(store.getState().phase).toBe('player_actions');
      const ok = WorldTurnSystem.transition(store, 'battle_active');
      expect(ok).toBe(false);
    });

    it('invalid transition does not change phase', () => {
      expect(store.getState().phase).toBe('player_actions');
      WorldTurnSystem.transition(store, 'results');
      expect(store.getState().phase).toBe('player_actions');
    });

    it('valid multi-step transition chain works', () => {
      WorldTurnSystem.transition(store, 'ai_actions');
      expect(store.getState().phase).toBe('ai_actions');

      WorldTurnSystem.transition(store, 'resolution');
      expect(store.getState().phase).toBe('resolution');

      WorldTurnSystem.transition(store, 'advance');
      expect(store.getState().phase).toBe('advance');

      WorldTurnSystem.transition(store, 'player_actions');
      expect(store.getState().phase).toBe('player_actions');
    });

    it('resolution → battle_selection is valid', () => {
      WorldTurnSystem.transition(store, 'ai_actions');
      WorldTurnSystem.transition(store, 'resolution');
      const ok = WorldTurnSystem.transition(store, 'battle_selection');
      expect(ok).toBe(true);
      expect(store.getState().phase).toBe('battle_selection');
    });
  });

  // ── tickInjuries ────────────────────────────────────────

  describe('tickInjuries', () => {
    it('decrements injured general turns', () => {
      store.apply(draft => {
        draft.generals['g1']!.injuryTurns = 3;
        draft.generals['g1']!.status = 'injured';
      });

      const newState = WorldTurnSystem.tickInjuries(store.getState());
      expect(newState.generals['g1']!.injuryTurns).toBe(2);
      expect(newState.generals['g1']!.status).toBe('injured');
    });

    it('recovers general when injuryTurns reaches 0', () => {
      store.apply(draft => {
        draft.generals['g1']!.injuryTurns = 1;
        draft.generals['g1']!.status = 'injured';
      });

      const newState = WorldTurnSystem.tickInjuries(store.getState());
      expect(newState.generals['g1']!.injuryTurns).toBe(0);
      expect(newState.generals['g1']!.status).toBe('idle');
    });

    it('returns same state if no injured generals', () => {
      const state = store.getState();
      const result = WorldTurnSystem.tickInjuries(state);
      expect(result).toBe(state);
    });

    it('decrements multiple injured generals independently', () => {
      store.apply(draft => {
        draft.generals['g1']!.injuryTurns = 2;
        draft.generals['g1']!.status = 'injured';
        draft.generals['g2']!.injuryTurns = 1;
        draft.generals['g2']!.status = 'injured';
      });

      const newState = WorldTurnSystem.tickInjuries(store.getState());
      expect(newState.generals['g1']!.injuryTurns).toBe(1);
      expect(newState.generals['g1']!.status).toBe('injured');
      expect(newState.generals['g2']!.injuryTurns).toBe(0);
      expect(newState.generals['g2']!.status).toBe('idle');
    });
  });

  // ── advanceTurn ─────────────────────────────────────────

  describe('advanceTurn', () => {
    it('increments turn and day', () => {
      // Move to advance phase first
      WorldTurnSystem.transition(store, 'ai_actions');
      WorldTurnSystem.transition(store, 'resolution');
      WorldTurnSystem.transition(store, 'advance');

      const prevTurn = store.getState().turn;
      WorldTurnSystem.advanceTurn(store);
      expect(store.getState().turn).toBe(prevTurn + 1);
      expect(store.getState().day).toBe((prevTurn + 1) * 30);
    });

    it('resets phase to player_actions', () => {
      WorldTurnSystem.transition(store, 'ai_actions');
      WorldTurnSystem.transition(store, 'resolution');
      WorldTurnSystem.transition(store, 'advance');

      WorldTurnSystem.advanceTurn(store);
      expect(store.getState().phase).toBe('player_actions');
    });

    it('clears pendingBattles', () => {
      // Add a fake pending battle
      store.apply(draft => {
        draft.pendingBattles = [{
          id: 'battle_1_0', type: 'field', territoryId: 'B', edgeId: null,
          attacker: { factionId: 'f1', armyId: 'army_f1_1' },
          defender: { factionId: 'f2', armyId: 'army_f2_1' },
          mode: 'auto', battleMapId: 'field_plains',
        }];
      });
      expect(store.getState().pendingBattles).toHaveLength(1);

      WorldTurnSystem.transition(store, 'ai_actions');
      WorldTurnSystem.transition(store, 'resolution');
      WorldTurnSystem.transition(store, 'advance');
      WorldTurnSystem.advanceTurn(store);

      expect(store.getState().pendingBattles).toHaveLength(0);
    });

    it('emits turnAdvanced event', () => {
      const events: { turn: number; day: number }[] = [];
      WorldEventBus.on('turnAdvanced', e => events.push(e));

      WorldTurnSystem.transition(store, 'ai_actions');
      WorldTurnSystem.transition(store, 'resolution');
      WorldTurnSystem.transition(store, 'advance');
      WorldTurnSystem.advanceTurn(store);

      expect(events).toHaveLength(1);
      expect(events[0]!.turn).toBe(2);
      expect(events[0]!.day).toBe(60);
    });

    it('returns gameOver false when both factions alive', () => {
      WorldTurnSystem.transition(store, 'ai_actions');
      WorldTurnSystem.transition(store, 'resolution');
      WorldTurnSystem.transition(store, 'advance');

      const result = WorldTurnSystem.advanceTurn(store);
      expect(result.gameOver).toBe(false);
    });
  });

  // ── executeResolution ───────────────────────────────────

  describe('executeResolution', () => {
    it('returns empty battles when no collisions', () => {
      // Create two armies at different locations
      store.apply(draft => {
        draft.armies['army_f1_1'] = {
          id: 'army_f1_1', factionId: 'f1', generals: ['g1'],
          locationNodeId: 'A', status: 'idle',
        };
        draft.armies['army_f2_1'] = {
          id: 'army_f2_1', factionId: 'f2', generals: ['g2'],
          locationNodeId: 'C', status: 'idle',
        };
        draft.factions['f1']!.armies.push('army_f1_1');
        draft.factions['f2']!.armies.push('army_f2_1');
      });

      const battles = WorldTurnSystem.executeResolution(store, worldMap);
      expect(battles).toHaveLength(0);
      expect(store.getState().pendingBattles).toHaveLength(0);
    });

    it('detects collision when hostile armies at same node', () => {
      // Place both armies at node B
      store.apply(draft => {
        draft.armies['army_f1_1'] = {
          id: 'army_f1_1', factionId: 'f1', generals: ['g1'],
          locationNodeId: 'B', status: 'idle',
        };
        draft.armies['army_f2_1'] = {
          id: 'army_f2_1', factionId: 'f2', generals: ['g2'],
          locationNodeId: 'B', status: 'idle',
        };
        draft.factions['f1']!.armies.push('army_f1_1');
        draft.factions['f2']!.armies.push('army_f2_1');
      });

      const battles = WorldTurnSystem.executeResolution(store, worldMap);
      expect(battles).toHaveLength(1);
      expect(battles[0]!.territoryId).toBe('B');
      expect(store.getState().pendingBattles).toHaveLength(1);
    });

    it('marks colliding armies as in_battle', () => {
      store.apply(draft => {
        draft.armies['army_f1_1'] = {
          id: 'army_f1_1', factionId: 'f1', generals: ['g1'],
          locationNodeId: 'B', status: 'idle',
        };
        draft.armies['army_f2_1'] = {
          id: 'army_f2_1', factionId: 'f2', generals: ['g2'],
          locationNodeId: 'B', status: 'idle',
        };
        draft.factions['f1']!.armies.push('army_f1_1');
        draft.factions['f2']!.armies.push('army_f2_1');
      });

      WorldTurnSystem.executeResolution(store, worldMap);
      expect(store.getState().armies['army_f1_1']!.status).toBe('in_battle');
      expect(store.getState().armies['army_f2_1']!.status).toBe('in_battle');
    });

    it('advances moving army before detecting collision', () => {
      // f1 army at A moving toward B, f2 army idle at B
      store.apply(draft => {
        draft.armies['army_f1_1'] = {
          id: 'army_f1_1', factionId: 'f1', generals: ['g1'],
          locationNodeId: 'A', status: 'moving',
          targetNodeId: 'B', movementPath: ['B'], movementProgress: 0,
        };
        draft.armies['army_f2_1'] = {
          id: 'army_f2_1', factionId: 'f2', generals: ['g2'],
          locationNodeId: 'B', status: 'idle',
        };
        draft.factions['f1']!.armies.push('army_f1_1');
        draft.factions['f2']!.armies.push('army_f2_1');
      });

      const battles = WorldTurnSystem.executeResolution(store, worldMap);

      // Army should have advanced to B and collided with f2
      expect(store.getState().armies['army_f1_1']!.locationNodeId).toBe('B');
      expect(battles).toHaveLength(1);
    });
  });
});
