import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { FactionData } from '@/engine/strategic/data/types/Faction';
import type { GeneralData } from '@/engine/strategic/data/types/General';
import type { DiplomacyState } from '@/engine/strategic/data/types/Diplomacy';
import { WorldStore } from '@/engine/strategic/state/WorldStore';
import { EndTurnAction } from '@/engine/strategic/state/actions/EndTurnAction';
import { CreateArmyAction } from '@/engine/strategic/state/actions/CreateArmyAction';
import { resetArmyIdCounter } from '@/engine/strategic/systems/ArmySystem';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';

const testMap: WorldMapData = {
  mapWidth: 400, mapHeight: 400,
  nodes: [
    { id: 'A', name: 'A', type: 'city', x: 0, y: 0, visionRadius: 7, defenseBonus: 30, maxUpgradeSlots: 4, terrain: 'plains' },
    { id: 'B', name: 'B', type: 'fortress', x: 100, y: 0, visionRadius: 7, defenseBonus: 50, maxUpgradeSlots: 3, terrain: 'mountain' },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', bidirectional: true, moveCost: 1, terrain: 'plains', passable: true },
  ],
};

const factions: FactionData[] = [
  {
    id: 'f1', name: 'F1', color: 0xFF0000, leader: 'g1', capital: 'A',
    aiProfile: { preset: 'steady_expander' }, isPlayer: true,
    startTerritories: ['A', 'B'], startGenerals: ['g1', 'g2'],
    startResources: { gold: 5000, food: 3000, troops: 10000 },
  },
];

const generals: GeneralData[] = [
  { id: 'g1', name: 'G1', unitDataId: 'warrior', leadership: 10, intellect: 5, politics: 5, charm: 5 },
  { id: 'g2', name: 'G2', unitDataId: 'archer', leadership: 8, intellect: 7, politics: 4, charm: 6 },
];

const diplomacy: DiplomacyState = { relations: {} };

let store: WorldStore;

beforeEach(() => {
  WorldEventBus.clear();
  resetArmyIdCounter();
  store = new WorldStore();
  store.init(testMap, factions, generals, diplomacy, 'f1', 'g1');
});

describe('WorldStore', () => {
  it('initializes state correctly', () => {
    const state = store.getState();
    expect(state.turn).toBe(1);
    expect(state.phase).toBe('player_actions');
    expect(Object.keys(state.factions)).toHaveLength(1);
    expect(Object.keys(state.generals)).toHaveLength(2);
  });

  it('dispatch updates state immutably', () => {
    const before = store.getState();
    store.dispatch(new EndTurnAction());
    const after = store.getState();

    expect(after).not.toBe(before);
    expect(after.phase).toBe('ai_actions');
    expect(before.phase).toBe('player_actions');
  });

  it('tracks state history after dispatch', () => {
    store.dispatch(new EndTurnAction());
    expect(store.getState().stateHistory).toHaveLength(1);
    expect(store.getState().stateHistory[0]!.phase).toBe('player_actions');
  });

  it('rejects invalid actions silently', () => {
    store.dispatch(new EndTurnAction()); // phase → resolution
    const afterFirst = store.getState();

    // EndTurn requires phase='player_actions', should be rejected
    store.dispatch(new EndTurnAction());
    expect(store.getState()).toBe(afterFirst); // No change
  });

  it('dispatch with CreateArmyAction creates army', () => {
    store.dispatch(new CreateArmyAction('f1', ['g1'], 'A'));
    const state = store.getState();
    expect(Object.keys(state.armies)).toHaveLength(1);
    expect(state.generals['g1']!.status).toBe('army');
  });

  it('subscribe notifies on state change', () => {
    let notified = false;
    store.subscribe(() => { notified = true; });
    store.dispatch(new EndTurnAction());
    expect(notified).toBe(true);
  });

  it('unsubscribe stops notifications', () => {
    let count = 0;
    const unsub = store.subscribe(() => { count++; });
    store.dispatch(new EndTurnAction());
    expect(count).toBe(1);

    unsub();
    store.apply(draft => { draft.phase = 'player_actions'; });
    store.dispatch(new EndTurnAction());
    expect(count).toBe(1); // Not notified again (apply does notify, but second dispatch should not reach listener)
  });

  it('apply mutates state directly with recipe', () => {
    store.apply(draft => {
      draft.factions['f1']!.resources.gold = 9999;
    });
    expect(store.getState().factions['f1']!.resources.gold).toBe(9999);
  });

  it('history limit is respected', () => {
    // Dispatch many actions alternating phase
    for (let i = 0; i < 110; i++) {
      store.apply(draft => { draft.phase = 'player_actions'; });
      store.dispatch(new EndTurnAction());
    }
    // History should be capped at 100
    expect(store.getState().stateHistory.length).toBeLessThanOrEqual(100);
  });
});
