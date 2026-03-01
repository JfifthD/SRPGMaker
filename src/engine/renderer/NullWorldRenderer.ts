// ─────────────────────────────────────────────
//  NullWorldRenderer — Headless no-op stub for IWorldRenderer
//  Used for tests, AI simulators, headless validation.
// ─────────────────────────────────────────────

import type { IWorldRenderer, WorldHighlightMode } from './IWorldRenderer';
import type { WorldMapData } from '@/engine/strategic/data/types/World';
import type { WorldState } from '@/engine/strategic/state/WorldState';

export class NullWorldRenderer implements IWorldRenderer {
  renderMap(_wm: WorldMapData, _s: WorldState, _fc: Record<string, number>): void {}
  syncArmies(_s: WorldState, _fc: Record<string, number>): void {}
  highlightNodes(_ids: string[], _m: WorldHighlightMode): void {}
  clearHighlights(): void {}
  highlightEdges(_ek: string[]): void {}
  clearEdgeHighlights(): void {}
  showNodeSelection(_id: string): void {}
  hideNodeSelection(): void {}
  async animateArmyMove(): Promise<void> {}
  async animateNodeCapture(): Promise<void> {}
  focusNode(_id: string): void {}
  updateTurnDisplay(_t: number, _d: number): void {}
  updateResourcePanel(_g: number, _f: number, _t: number): void {}
  showTerritoryInfo(_id: string, _s: WorldState): void {}
  hideTerritoryInfo(): void {}
  showArmyInfo(_id: string, _s: WorldState): void {}
  hideArmyInfo(): void {}
  showPhaseOverlay(_text: string): void {}
  hidePhaseOverlay(): void {}
  showBattlePreview(_id: string, _a: string, _d: string, _t: string): void {}
  hideBattlePreview(): void {}
  showBattleResultSummary(_w: string, _l: string, _c: boolean): void {}
  hideBattleResultSummary(): void {}
  update(_time: number, _delta: number): void {}
  destroy(): void {}
}
