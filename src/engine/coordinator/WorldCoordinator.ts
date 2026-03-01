// ─────────────────────────────────────────────
//  WorldCoordinator — Bridges WorldStore ↔ IWorldRenderer
//  ZERO Phaser imports. Calls IWorldRenderer methods only.
//  Manages input mode FSM (idle/node_selected/army_selected).
//  Mirrors BattleCoordinator pattern.
// ─────────────────────────────────────────────

import type { IWorldRenderer } from '@/engine/renderer/IWorldRenderer';
import type { WorldState, BattleContext } from '@/engine/strategic/state/WorldState';
import { WorldStateQuery } from '@/engine/strategic/state/WorldState';
import type { WorldStore } from '@/engine/strategic/state/WorldStore';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { FactionData } from '@/engine/strategic/data/types/Faction';
import type { GameProject } from '@/engine/data/types/GameProject';
import type { BattleResult } from '@/engine/strategic/data/types/BattleResult';
import { WorldEventBus } from '@/engine/strategic/WorldEventBus';
import { getReachableNodes, findShortestPath } from '@/engine/strategic/systems/TerritorySystem';
import { WorldTurnSystem } from '@/engine/strategic/systems/WorldTurnSystem';
import { StrategicAI } from '@/engine/strategic/systems/StrategicAI';
import { CasualtySystem } from '@/engine/strategic/systems/CasualtySystem';
import { BattleMapBuilder } from '@/engine/strategic/systems/BattleMapBuilder';
import { AutoBattleResolver } from '@/engine/strategic/systems/AutoBattleResolver';
import { EndTurnAction } from '@/engine/strategic/state/actions/EndTurnAction';
import { ResolveBattleAction } from '@/engine/strategic/state/actions/ResolveBattleAction';
import { FactionSystem } from '@/engine/strategic/systems/FactionSystem';

export type WorldInputMode = 'idle' | 'node_selected' | 'army_selected';

/** Callback when coordinator wants to launch a manual battle scene. */
export type LaunchBattleCallback = (battle: BattleContext) => void;

export class WorldCoordinator {
  private renderer: IWorldRenderer;
  private store: WorldStore;
  private worldMap: WorldMapData;
  private gameProject: GameProject | null = null;
  private factionColors: Record<string, number> = {};
  private factionNames: Record<string, string> = {};

  // Input FSM
  private inputMode: WorldInputMode = 'idle';
  private selectedNodeId: string | null = null;
  private selectedArmyId: string | null = null;
  private busy = false;

  // Turn cycle
  private pendingBattleIndex = 0;
  private launchBattleCallback: LaunchBattleCallback | null = null;

  // Cached data
  private nodePositions: Record<string, { x: number; y: number }> = {};
  private reachableNodes: string[] = [];

  constructor(
    renderer: IWorldRenderer,
    store: WorldStore,
    worldMap: WorldMapData,
    factionDataList: FactionData[],
  ) {
    this.renderer = renderer;
    this.store = store;
    this.worldMap = worldMap;

    // Build faction color + name maps
    for (const fd of factionDataList) {
      this.factionColors[fd.id] = fd.color;
      this.factionNames[fd.id] = fd.name;
    }

    // Build node position lookup
    for (const node of worldMap.nodes) {
      this.nodePositions[node.id] = { x: node.x, y: node.y };
    }

    // Subscribe to store changes
    store.subscribe((state) => this.onStateChange(state));

    // Subscribe to WorldEventBus for animation events
    WorldEventBus.on('armyMoved', (e) => {
      if (this.busy) return;
      this.busy = true;
      const path = [e.fromNode, e.toNode];
      void this.renderer.animateArmyMove(e.armyId, path, this.nodePositions).then(() => {
        this.renderer.syncArmies(this.store.getState(), this.factionColors);
        this.busy = false;
      });
    });

    WorldEventBus.on('territoryCapture', (e) => {
      const color = this.factionColors[e.newOwner] ?? 0xffffff;
      void this.renderer.animateNodeCapture(e.territoryId, color);
    });

    WorldEventBus.on('turnAdvanced', (e) => {
      this.renderer.updateTurnDisplay(e.turn, e.day);
    });

    WorldEventBus.on('resourceCollected', (e) => {
      const state = this.store.getState();
      if (e.factionId === state.playerFactionId) {
        const faction = WorldStateQuery.playerFaction(state);
        if (faction) {
          this.renderer.updateResourcePanel(
            faction.resources.gold,
            faction.resources.food,
            faction.resources.troops,
          );
        }
      }
    });
  }

  // ════════════════════════════════════════════
  //  Initial render
  // ════════════════════════════════════════════

  initialRender(): void {
    const state = this.store.getState();
    this.renderer.renderMap(this.worldMap, state, this.factionColors);
    this.renderer.syncArmies(state, this.factionColors);

    // Update HUD
    this.renderer.updateTurnDisplay(state.turn, state.day);
    const playerFaction = WorldStateQuery.playerFaction(state);
    if (playerFaction) {
      this.renderer.updateResourcePanel(
        playerFaction.resources.gold,
        playerFaction.resources.food,
        playerFaction.resources.troops,
      );
    }
  }

  // ════════════════════════════════════════════
  //  Input callbacks (called by WorldInputHandler)
  // ════════════════════════════════════════════

  onNodeClick(nodeId: string): void {
    if (this.busy) return;
    const state = this.store.getState();

    switch (this.inputMode) {
      case 'idle':
      case 'node_selected':
        this.selectNode(nodeId, state);
        break;
      case 'army_selected':
        // If clicking a reachable node, show path preview
        if (this.reachableNodes.includes(nodeId) && this.selectedArmyId) {
          this.showPathPreview(nodeId, state);
        } else {
          this.selectNode(nodeId, state);
        }
        break;
    }
  }

  onArmyClick(armyId: string): void {
    if (this.busy) return;
    const state = this.store.getState();
    const army = WorldStateQuery.army(state, armyId);
    if (!army) return;

    // Only allow selecting player faction armies
    if (army.factionId !== state.playerFactionId) {
      this.selectNode(army.locationNodeId, state);
      return;
    }

    this.selectArmy(armyId, state);
  }

  onEmptyClick(): void {
    this.deselect();
  }

  onCancel(): void {
    this.deselect();
  }

  onNodeHover(_nodeId: string): void {
    // Future: show tooltip
  }

  // ════════════════════════════════════════════
  //  Public getters (for input handler)
  // ════════════════════════════════════════════

  getNodePositions(): Record<string, { x: number; y: number }> {
    return this.nodePositions;
  }

  getState(): WorldState {
    return this.store.getState();
  }

  getWorldMap(): WorldMapData {
    return this.worldMap;
  }

  getInputMode(): WorldInputMode {
    return this.inputMode;
  }

  // ════════════════════════════════════════════
  //  Turn Cycle — Public API
  // ════════════════════════════════════════════

  /** Set the GameProject reference (needed for auto-battle). */
  setGameProject(project: GameProject): void {
    this.gameProject = project;
  }

  /** Register callback for launching manual battle scenes. */
  setLaunchBattleCallback(cb: LaunchBattleCallback): void {
    this.launchBattleCallback = cb;
  }

  /**
   * Player ends their turn → runs AI phase → resolution → battles → advance.
   * This is the main turn-cycle entry point.
   */
  endPlayerTurn(): void {
    if (this.busy) return;
    const state = this.store.getState();
    if (state.phase !== 'player_actions') return;

    this.deselect();
    this.busy = true;

    // Dispatch EndTurnAction → transitions to ai_actions
    this.store.dispatch(new EndTurnAction());

    // Execute AI phase
    this.executeAIPhase();
  }

  /**
   * Called from BattleScene/ResultScene when a manual battle completes.
   */
  onBattleComplete(battleId: string, result: BattleResult): void {
    this.store.dispatch(new ResolveBattleAction(battleId, result, this.worldMap));

    // Show result summary briefly
    const winnerName = this.factionNames[result.winnerId] ?? result.winnerId;
    const loserName = this.factionNames[result.loserId] ?? result.loserId;
    this.renderer.showBattleResultSummary(winnerName, loserName, result.territoryCaptured);

    // Continue processing remaining battles after a delay
    setTimeout(() => {
      this.renderer.hideBattleResultSummary();
      this.pendingBattleIndex++;
      this.processNextBattle();
    }, 1500);
  }

  // ════════════════════════════════════════════
  //  Turn Cycle — Private
  // ════════════════════════════════════════════

  private executeAIPhase(): void {
    this.renderer.showPhaseOverlay('AI THINKING...');

    // Run AI for all non-player factions
    const state = this.store.getState();
    const aiFactions = Object.values(state.factions).filter(
      f => f.alive && f.id !== state.playerFactionId,
    );

    for (const faction of aiFactions) {
      const actions = StrategicAI.decideFactionActions(
        this.store.getState(),
        faction.id,
        this.worldMap,
      );
      for (const action of actions) {
        this.store.dispatch(action);
      }
    }

    // Short visual delay for "AI thinking" feel
    setTimeout(() => {
      this.renderer.hidePhaseOverlay();
      // Transition to resolution
      WorldTurnSystem.transition(this.store, 'resolution');
      this.executeResolutionPhase();
    }, 600);
  }

  private executeResolutionPhase(): void {
    this.renderer.showPhaseOverlay('RESOLUTION');

    // Advance armies and detect collisions
    const battles = WorldTurnSystem.executeResolution(this.store, this.worldMap);

    setTimeout(() => {
      this.renderer.hidePhaseOverlay();

      if (battles.length > 0) {
        // Transition to battle_selection and process battles
        WorldTurnSystem.transition(this.store, 'battle_selection');
        this.pendingBattleIndex = 0;
        this.processNextBattle();
      } else {
        // No battles — advance turn directly
        WorldTurnSystem.transition(this.store, 'advance');
        this.finishTurn();
      }
    }, 800);
  }

  private processNextBattle(): void {
    const state = this.store.getState();
    const battles = state.pendingBattles;

    if (this.pendingBattleIndex >= battles.length) {
      // All battles resolved — check if any remain (some got resolved and removed)
      if (state.pendingBattles.length === 0) {
        WorldTurnSystem.transition(this.store, 'advance');
        this.finishTurn();
      } else {
        // Still battles left (shouldn't happen in normal flow)
        WorldTurnSystem.transition(this.store, 'advance');
        this.finishTurn();
      }
      return;
    }

    const battle = battles[this.pendingBattleIndex]!;
    const attackerName = this.factionNames[battle.attacker.factionId] ?? battle.attacker.factionId;
    const defenderName = this.factionNames[battle.defender.factionId] ?? battle.defender.factionId;
    const nodeName = battle.territoryId ?? 'field';

    this.renderer.showBattlePreview(battle.id, attackerName, defenderName, nodeName);

    // Determine battle mode
    const isPlayerBattle =
      battle.attacker.factionId === state.playerFactionId ||
      battle.defender.factionId === state.playerFactionId;

    if (isPlayerBattle && battle.mode === 'manual' && this.launchBattleCallback) {
      // Manual battle — launch BattleScene
      setTimeout(() => {
        this.renderer.hideBattlePreview();
        WorldTurnSystem.transition(this.store, 'battle_active');
        this.launchBattleCallback!(battle);
        // onBattleComplete() will be called when battle finishes
      }, 1500);
    } else {
      // Auto-resolve
      setTimeout(() => {
        this.renderer.hideBattlePreview();
        this.autoResolveBattle(battle);
      }, 1500);
    }
  }

  private autoResolveBattle(battle: BattleContext): void {
    if (!this.gameProject) {
      console.error('[WorldCoordinator] gameProject not set — cannot auto-resolve');
      this.pendingBattleIndex++;
      this.processNextBattle();
      return;
    }

    const state = this.store.getState();
    const buildResult = BattleMapBuilder.build(battle, state);
    const result = AutoBattleResolver.resolve(buildResult, this.gameProject);

    // Build full BattleResult
    const attackerResults = result.generalResults.filter(g => g.team === 'ally');
    const defenderResults = result.generalResults.filter(g => g.team === 'enemy');

    const attackerCasualties = CasualtySystem.calculateCasualties(attackerResults, state.generals);
    const defenderCasualties = CasualtySystem.calculateCasualties(defenderResults, state.generals);

    // Roll death/injury
    const protagonistId = state.protagonistId;
    CasualtySystem.rollDeathAndInjury(
      attackerCasualties.generalReports,
      result.victory,
      [protagonistId],
    );
    CasualtySystem.rollDeathAndInjury(
      defenderCasualties.generalReports,
      !result.victory,
      [],
    );

    const winnerId = result.victory ? battle.attacker.factionId : battle.defender.factionId;
    const loserId = result.victory ? battle.defender.factionId : battle.attacker.factionId;

    const battleResult: BattleResult = {
      winnerId,
      loserId,
      turns: result.turns,
      attackerCasualties,
      defenderCasualties,
      territoryCaptured: result.victory && battle.type === 'siege',
      generalResults: result.generalResults,
    };

    // Dispatch resolve action
    this.onBattleComplete(battle.id, battleResult);
  }

  private finishTurn(): void {
    const result = WorldTurnSystem.advanceTurn(this.store);

    // Check elimination
    const elimState = FactionSystem.checkFactionElimination(this.store.getState());
    if (elimState !== this.store.getState()) {
      this.store.apply(draft => {
        for (const [fId, faction] of Object.entries(elimState.factions)) {
          draft.factions[fId] = faction as any;
        }
      });
    }

    this.busy = false;

    if (result.gameOver) {
      WorldEventBus.emit('gameOver', { reason: result.reason ?? 'unknown' });
    }

    // Re-render
    this.renderer.syncArmies(this.store.getState(), this.factionColors);
  }

  // ════════════════════════════════════════════
  //  Private — FSM transitions
  // ════════════════════════════════════════════

  private selectNode(nodeId: string, state: WorldState): void {
    this.renderer.clearHighlights();
    this.renderer.clearEdgeHighlights();
    this.renderer.hideArmyInfo();

    this.selectedNodeId = nodeId;
    this.selectedArmyId = null;
    this.reachableNodes = [];
    this.inputMode = 'node_selected';

    this.renderer.showNodeSelection(nodeId);
    this.renderer.showTerritoryInfo(nodeId, state);
    this.renderer.highlightNodes([nodeId], 'selection');
  }

  private selectArmy(armyId: string, state: WorldState): void {
    const army = WorldStateQuery.army(state, armyId);
    if (!army) return;

    this.renderer.clearHighlights();
    this.renderer.clearEdgeHighlights();
    this.renderer.hideTerritoryInfo();

    this.selectedArmyId = armyId;
    this.selectedNodeId = army.locationNodeId;
    this.inputMode = 'army_selected';

    this.renderer.showNodeSelection(army.locationNodeId);
    this.renderer.showArmyInfo(armyId, state);

    // Compute and highlight reachable nodes (3-hop for visual feedback)
    this.reachableNodes = getReachableNodes(this.worldMap, army.locationNodeId, 3);
    this.renderer.highlightNodes(this.reachableNodes, 'movement');
    this.renderer.highlightNodes([army.locationNodeId], 'selection');
  }

  private showPathPreview(targetNodeId: string, state: WorldState): void {
    if (!this.selectedArmyId) return;
    const army = WorldStateQuery.army(state, this.selectedArmyId);
    if (!army) return;

    const path = findShortestPath(this.worldMap, army.locationNodeId, targetNodeId);
    if (!path) return;

    // Highlight path edges
    const edgeKeys: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      edgeKeys.push(`${path[i]!}:${path[i + 1]!}`);
    }
    this.renderer.clearEdgeHighlights();
    this.renderer.highlightEdges(edgeKeys);
  }

  private deselect(): void {
    this.inputMode = 'idle';
    this.selectedNodeId = null;
    this.selectedArmyId = null;
    this.reachableNodes = [];
    this.renderer.clearHighlights();
    this.renderer.clearEdgeHighlights();
    this.renderer.hideNodeSelection();
    this.renderer.hideTerritoryInfo();
    this.renderer.hideArmyInfo();
  }

  // ════════════════════════════════════════════
  //  State change handler
  // ════════════════════════════════════════════

  private onStateChange(state: WorldState): void {
    this.renderer.syncArmies(state, this.factionColors);

    // Update HUD
    this.renderer.updateTurnDisplay(state.turn, state.day);
    const pf = WorldStateQuery.playerFaction(state);
    if (pf) {
      this.renderer.updateResourcePanel(pf.resources.gold, pf.resources.food, pf.resources.troops);
    }
  }
}
