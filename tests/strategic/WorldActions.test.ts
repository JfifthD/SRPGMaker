import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldState } from '@/engine/strategic/state/WorldState';
import type { GeneralState } from '@/engine/strategic/data/types/General';
import { MoveArmyAction } from '@/engine/strategic/state/actions/MoveArmyAction';
import { CreateArmyAction } from '@/engine/strategic/state/actions/CreateArmyAction';
import { TransferTerritoryAction } from '@/engine/strategic/state/actions/TransferTerritoryAction';
import { EndTurnAction } from '@/engine/strategic/state/actions/EndTurnAction';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';
import { resetArmyIdCounter, createArmy } from '@/engine/strategic/systems/ArmySystem';

function makeGeneral(id: string, faction: string): GeneralState {
  return {
    id, name: id, unitDataId: 'warrior',
    leadership: 10, intellect: 5, politics: 5, charm: 5,
    faction, location: 'A', status: 'idle', injuryTurns: 0,
    loyalty: 70, currentTroops: 10000,
  };
}

function makeState(): WorldState {
  return {
    turn: 1, day: 30, phase: 'player_actions',
    factions: {
      f1: { id: 'f1', territories: ['A', 'B'], generals: ['g1', 'g2'], armies: [], resources: { gold: 5000, food: 3000, troops: 10000 }, alive: true },
      f2: { id: 'f2', territories: ['C'], generals: ['g3'], armies: [], resources: { gold: 3000, food: 2000, troops: 5000 }, alive: true },
    },
    territories: {
      A: { id: 'A', owner: 'f1', garrison: [], upgrades: [], population: 5000, morale: 50, underSiege: false, turnsOwned: 5 },
      B: { id: 'B', owner: 'f1', garrison: [], upgrades: [], population: 2000, morale: 50, underSiege: false, turnsOwned: 5 },
      C: { id: 'C', owner: 'f2', garrison: [], upgrades: [], population: 3000, morale: 50, underSiege: false, turnsOwned: 3 },
    },
    armies: {},
    generals: {
      g1: makeGeneral('g1', 'f1'),
      g2: makeGeneral('g2', 'f1'),
      g3: { ...makeGeneral('g3', 'f2'), location: 'C' },
    },
    diplomacy: { relations: {} },
    pendingBattles: [],
    playerFactionId: 'f1', protagonistId: 'g1',
    availableGenerals: [], stateHistory: [],
  };
}

beforeEach(() => {
  WorldEventBus.clear();
  resetArmyIdCounter();
});

describe('WorldActions', () => {
  describe('EndTurnAction', () => {
    it('validates only in player_actions phase', () => {
      const action = new EndTurnAction();
      expect(action.validate(makeState())).toBe(true);
      expect(action.validate({ ...makeState(), phase: 'resolution' })).toBe(false);
    });

    it('transitions phase to ai_actions', () => {
      const action = new EndTurnAction();
      const next = action.execute(makeState());
      expect(next.phase).toBe('ai_actions');
    });
  });

  describe('CreateArmyAction', () => {
    it('validates generals and maxArmies', () => {
      const action = new CreateArmyAction('f1', ['g1'], 'A');
      expect(action.validate(makeState())).toBe(true);
    });

    it('rejects when maxArmies reached', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      state = createArmy(state, 'f1', ['g2'], 'A');
      // f1 has 2 territories = max 2 armies
      const action = new CreateArmyAction('f1', ['g1'], 'A');
      expect(action.validate(state)).toBe(false);
    });

    it('executes and creates army', () => {
      const action = new CreateArmyAction('f1', ['g1'], 'A');
      const next = action.execute(makeState());
      expect(Object.keys(next.armies)).toHaveLength(1);
    });
  });

  describe('MoveArmyAction', () => {
    it('validates army exists and path starts at current location', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      const armyId = Object.keys(state.armies)[0]!;

      const valid = new MoveArmyAction(armyId, ['A', 'B']);
      expect(valid.validate(state)).toBe(true);

      const invalidPath = new MoveArmyAction(armyId, ['B', 'C']);
      expect(invalidPath.validate(state)).toBe(false);

      const tooShort = new MoveArmyAction(armyId, ['A']);
      expect(tooShort.validate(state)).toBe(false);
    });

    it('executes and sets movement order', () => {
      let state = makeState();
      state = createArmy(state, 'f1', ['g1'], 'A');
      const armyId = Object.keys(state.armies)[0]!;

      const action = new MoveArmyAction(armyId, ['A', 'B']);
      const next = action.execute(state);
      expect(next.armies[armyId]!.status).toBe('moving');
      expect(next.armies[armyId]!.targetNodeId).toBe('B');
    });
  });

  describe('TransferTerritoryAction', () => {
    it('validates territory exists and new owner differs', () => {
      const state = makeState();
      expect(new TransferTerritoryAction('A', 'f2').validate(state)).toBe(true);
      expect(new TransferTerritoryAction('A', 'f1').validate(state)).toBe(false); // same owner
      expect(new TransferTerritoryAction('Z', 'f1').validate(state)).toBe(false); // no territory
    });

    it('executes and transfers ownership', () => {
      const state = makeState();
      const action = new TransferTerritoryAction('A', 'f2');
      const next = action.execute(state);

      expect(next.territories['A']!.owner).toBe('f2');
      expect(next.factions['f1']!.territories).not.toContain('A');
      expect(next.factions['f2']!.territories).toContain('A');
    });

    it('emits territoryCapture event', () => {
      let captured = false;
      WorldEventBus.on('territoryCapture', () => { captured = true; });

      const action = new TransferTerritoryAction('A', 'f2');
      action.execute(makeState());
      expect(captured).toBe(true);
    });
  });
});
