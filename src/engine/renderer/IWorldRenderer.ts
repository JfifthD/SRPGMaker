// ─────────────────────────────────────────────
//  IWorldRenderer — Abstract interface for strategic world map rendering
//  Implementations: PhaserWorldRenderer (visual), NullWorldRenderer (headless)
//  Mirrors IRenderer pattern from the tactical layer.
// ─────────────────────────────────────────────

import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { WorldState } from '@/engine/strategic/state/WorldState';

export type WorldHighlightMode = 'selection' | 'movement' | 'attack' | 'path';

export interface IWorldRenderer {
  // ── Map Rendering ──

  /** Full map render: background, edges, nodes. Called on init and state changes. */
  renderMap(
    worldMap: WorldMapData,
    state: WorldState,
    factionColors: Record<string, number>,
  ): void;

  /** Sync all army visuals to current WorldState positions. */
  syncArmies(state: WorldState, factionColors: Record<string, number>): void;

  // ── Node Highlights ──

  /** Highlight a set of nodes in the given mode. */
  highlightNodes(nodeIds: string[], mode: WorldHighlightMode): void;

  /** Clear all node highlights. */
  clearHighlights(): void;

  // ── Edge Highlights (path preview) ──

  /** Highlight edges. Keys use "fromNode:toNode" format. */
  highlightEdges(edgeKeys: string[]): void;

  /** Clear edge highlights. */
  clearEdgeHighlights(): void;

  // ── Selection Indicator ──

  /** Show selection ring on a node. */
  showNodeSelection(nodeId: string): void;

  /** Hide node selection indicator. */
  hideNodeSelection(): void;

  // ── Animations ──

  /** Animate army moving along a path of node ids. */
  animateArmyMove(
    armyId: string,
    path: string[],
    nodePositions: Record<string, { x: number; y: number }>,
  ): Promise<void>;

  /** Flash/pulse effect on a node (e.g., territory capture). */
  animateNodeCapture(nodeId: string, newOwnerColor: number): Promise<void>;

  // ── Camera ──

  /** Pan/zoom camera to center on a node. */
  focusNode(nodeId: string): void;

  // ── HUD ──

  /** Update the turn counter display. */
  updateTurnDisplay(turn: number, day: number): void;

  /** Update the resource panel for the player faction. */
  updateResourcePanel(gold: number, food: number, troops: number): void;

  /** Show territory info panel for a selected node. */
  showTerritoryInfo(nodeId: string, state: WorldState): void;

  /** Hide territory info panel. */
  hideTerritoryInfo(): void;

  /** Show army info panel for a selected army. */
  showArmyInfo(armyId: string, state: WorldState): void;

  /** Hide army info panel. */
  hideArmyInfo(): void;

  // ── Phase / Battle HUD ──

  /** Show a full-screen text overlay (e.g., "AI THINKING...", "RESOLUTION"). */
  showPhaseOverlay(text: string): void;

  /** Hide the phase overlay. */
  hidePhaseOverlay(): void;

  /** Show battle preview panel for an upcoming battle. */
  showBattlePreview(battleId: string, attackerName: string, defenderName: string, territoryName: string): void;

  /** Hide battle preview panel. */
  hideBattlePreview(): void;

  /** Show battle result summary. */
  showBattleResultSummary(winnerName: string, loserName: string, captured: boolean): void;

  /** Hide battle result summary. */
  hideBattleResultSummary(): void;

  // ── Lifecycle ──

  /** Per-frame update (camera lerp, etc.). */
  update(time: number, delta: number): void;

  /** Destroy all rendering objects. */
  destroy(): void;
}
