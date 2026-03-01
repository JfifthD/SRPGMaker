import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { FactionData } from '@/engine/strategic/data/types/Faction';
import type { GeneralData } from '@/engine/strategic/data/types/General';
import type { DiplomacyState } from '@/engine/strategic/data/types/Diplomacy';
import { WorldStore } from '@/engine/strategic/state/WorldStore';
import { WorldCoordinator } from '@/engine/coordinator/WorldCoordinator';
import { NullWorldRenderer } from '@/engine/renderer/NullWorldRenderer';
import { CreateArmyAction } from '@/engine/strategic/state/actions/CreateArmyAction';
import { resetArmyIdCounter } from '@/engine/strategic/systems/ArmySystem';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';

// ── Test fixtures ──

const testMap: WorldMapData = {
  mapWidth: 400, mapHeight: 400,
  nodes: [
    { id: 'A', name: 'Alpha', type: 'city', x: 0, y: 0, visionRadius: 7, defenseBonus: 30, maxUpgradeSlots: 4, terrain: 'plains' },
    { id: 'B', name: 'Beta', type: 'fortress', x: 100, y: 0, visionRadius: 7, defenseBonus: 50, maxUpgradeSlots: 3, terrain: 'mountain' },
    { id: 'C', name: 'Gamma', type: 'village', x: 200, y: 100, visionRadius: 5, defenseBonus: 10, maxUpgradeSlots: 2, terrain: 'forest' },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', bidirectional: true, moveCost: 1, terrain: 'plains', passable: true },
    { id: 'e2', from: 'B', to: 'C', bidirectional: true, moveCost: 2, terrain: 'mountain', passable: true },
  ],
};

const factions: FactionData[] = [
  {
    id: 'f1', name: 'Player Faction', color: 0xFF0000, leader: 'g1', capital: 'A',
    aiProfile: { preset: 'steady_expander' }, isPlayer: true,
    startTerritories: ['A', 'B'], startGenerals: ['g1', 'g2'],
    startResources: { gold: 5000, food: 3000, troops: 10000 },
  },
  {
    id: 'f2', name: 'Enemy Faction', color: 0x0000FF, leader: 'g3', capital: 'C',
    aiProfile: { preset: 'blitz_conqueror' }, isPlayer: false,
    startTerritories: ['C'], startGenerals: ['g3'],
    startResources: { gold: 3000, food: 2000, troops: 8000 },
  },
];

const generals: GeneralData[] = [
  { id: 'g1', name: 'General1', unitDataId: 'warrior', leadership: 10, intellect: 5, politics: 5, charm: 5 },
  { id: 'g2', name: 'General2', unitDataId: 'archer', leadership: 8, intellect: 7, politics: 4, charm: 6 },
  { id: 'g3', name: 'General3', unitDataId: 'warrior', leadership: 9, intellect: 6, politics: 3, charm: 4 },
];

const diplomacy: DiplomacyState = { relations: {} };

// ── Spy renderer ──

function createSpyRenderer(): NullWorldRenderer & { [K in keyof NullWorldRenderer]: ReturnType<typeof vi.fn> } {
  const renderer = new NullWorldRenderer();
  const methods: (keyof NullWorldRenderer)[] = [
    'renderMap', 'syncArmies', 'highlightNodes', 'clearHighlights',
    'highlightEdges', 'clearEdgeHighlights',
    'showNodeSelection', 'hideNodeSelection',
    'animateArmyMove', 'animateNodeCapture', 'focusNode',
    'updateTurnDisplay', 'updateResourcePanel',
    'showTerritoryInfo', 'hideTerritoryInfo',
    'showArmyInfo', 'hideArmyInfo',
    'update', 'destroy',
  ];
  for (const m of methods) {
    vi.spyOn(renderer, m as never);
  }
  return renderer as never;
}

// ── Tests ──

let store: WorldStore;
let renderer: ReturnType<typeof createSpyRenderer>;
let coord: WorldCoordinator;

beforeEach(() => {
  WorldEventBus.clear();
  resetArmyIdCounter();
  store = new WorldStore();
  store.init(testMap, factions, generals, diplomacy, 'f1', 'g1');
  renderer = createSpyRenderer();
  coord = new WorldCoordinator(renderer, store, testMap, factions);
});

describe('WorldCoordinator', () => {
  describe('initialRender', () => {
    it('calls renderMap and syncArmies on init', () => {
      coord.initialRender();
      expect(renderer.renderMap).toHaveBeenCalledOnce();
      expect(renderer.syncArmies).toHaveBeenCalledOnce();
    });

    it('updates HUD on init', () => {
      coord.initialRender();
      expect(renderer.updateTurnDisplay).toHaveBeenCalledWith(1, expect.any(Number));
      expect(renderer.updateResourcePanel).toHaveBeenCalledWith(5000, 3000, 10000);
    });
  });

  describe('node positions', () => {
    it('builds node positions from world map', () => {
      const positions = coord.getNodePositions();
      expect(positions['A']).toEqual({ x: 0, y: 0 });
      expect(positions['B']).toEqual({ x: 100, y: 0 });
      expect(positions['C']).toEqual({ x: 200, y: 100 });
    });
  });

  describe('onNodeClick', () => {
    it('shows node selection and territory info', () => {
      coord.onNodeClick('A');
      expect(renderer.showNodeSelection).toHaveBeenCalledWith('A');
      expect(renderer.showTerritoryInfo).toHaveBeenCalledWith('A', expect.anything());
      expect(renderer.highlightNodes).toHaveBeenCalled();
    });

    it('transitions to node_selected mode', () => {
      coord.onNodeClick('A');
      expect(coord.getInputMode()).toBe('node_selected');
    });

    it('clears previous highlights when selecting new node', () => {
      coord.onNodeClick('A');
      coord.onNodeClick('B');
      // Should have cleared highlights before new selection
      expect(renderer.clearHighlights).toHaveBeenCalledTimes(2);
    });
  });

  describe('onArmyClick', () => {
    it('selects player army and shows movement range', () => {
      store.dispatch(new CreateArmyAction('f1', ['g1'], 'A'));
      const state = store.getState();
      const armyId = Object.keys(state.armies)[0]!;

      coord.onArmyClick(armyId);

      expect(coord.getInputMode()).toBe('army_selected');
      expect(renderer.showArmyInfo).toHaveBeenCalledWith(armyId, expect.anything());
      expect(renderer.highlightNodes).toHaveBeenCalled();
    });

    it('selects node instead for enemy army', () => {
      store.dispatch(new CreateArmyAction('f2', ['g3'], 'C'));
      const state = store.getState();
      const armyId = Object.keys(state.armies)[0]!;

      coord.onArmyClick(armyId);

      // Should show territory info for the node, not army info
      expect(coord.getInputMode()).toBe('node_selected');
      expect(renderer.showTerritoryInfo).toHaveBeenCalledWith('C', expect.anything());
    });
  });

  describe('onCancel / onEmptyClick', () => {
    it('deselects on cancel', () => {
      coord.onNodeClick('A');
      expect(coord.getInputMode()).toBe('node_selected');

      coord.onCancel();
      expect(coord.getInputMode()).toBe('idle');
      expect(renderer.clearHighlights).toHaveBeenCalled();
      expect(renderer.hideNodeSelection).toHaveBeenCalled();
      expect(renderer.hideTerritoryInfo).toHaveBeenCalled();
      expect(renderer.hideArmyInfo).toHaveBeenCalled();
    });

    it('deselects on empty click', () => {
      coord.onNodeClick('B');
      coord.onEmptyClick();
      expect(coord.getInputMode()).toBe('idle');
    });
  });

  describe('FSM transitions', () => {
    it('idle → node_selected → idle', () => {
      expect(coord.getInputMode()).toBe('idle');
      coord.onNodeClick('A');
      expect(coord.getInputMode()).toBe('node_selected');
      coord.onCancel();
      expect(coord.getInputMode()).toBe('idle');
    });

    it('idle → army_selected → idle', () => {
      store.dispatch(new CreateArmyAction('f1', ['g1'], 'A'));
      const armyId = Object.keys(store.getState().armies)[0]!;

      coord.onArmyClick(armyId);
      expect(coord.getInputMode()).toBe('army_selected');
      coord.onCancel();
      expect(coord.getInputMode()).toBe('idle');
    });

    it('node_selected → army_selected (clicking own army)', () => {
      store.dispatch(new CreateArmyAction('f1', ['g1'], 'A'));
      const armyId = Object.keys(store.getState().armies)[0]!;

      coord.onNodeClick('B');
      expect(coord.getInputMode()).toBe('node_selected');

      coord.onArmyClick(armyId);
      expect(coord.getInputMode()).toBe('army_selected');
    });
  });

  describe('store subscription', () => {
    it('syncArmies is called when store state changes', () => {
      coord.initialRender();
      renderer.syncArmies.mockClear();

      store.dispatch(new CreateArmyAction('f1', ['g1'], 'A'));
      expect(renderer.syncArmies).toHaveBeenCalled();
    });

    it('updates HUD when store state changes', () => {
      coord.initialRender();
      renderer.updateTurnDisplay.mockClear();
      renderer.updateResourcePanel.mockClear();

      store.apply(draft => {
        draft.factions['f1']!.resources.gold = 9999;
      });

      expect(renderer.updateResourcePanel).toHaveBeenCalledWith(9999, 3000, 10000);
    });
  });

  describe('getState', () => {
    it('returns current world state', () => {
      const state = coord.getState();
      expect(state.playerFactionId).toBe('f1');
      expect(state.turn).toBe(1);
    });
  });

  describe('getWorldMap', () => {
    it('returns the world map data', () => {
      expect(coord.getWorldMap()).toBe(testMap);
    });
  });
});
