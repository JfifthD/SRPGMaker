// ─────────────────────────────────────────────
//  NullRenderer — No-op IRenderer for headless testing
//  All methods are silent no-ops; Promises resolve immediately.
//  Use this in integration tests instead of PhaserRenderer.
// ─────────────────────────────────────────────

import type { IRenderer, HighlightMode } from '@/engine/renderer/IRenderer';
import type { BattleState } from '@/engine/state/BattleState';
import type { Pos } from '@/engine/data/types/Map';

export class NullRenderer implements IRenderer {
  renderMap(_state: BattleState): void {}
  syncUnits(_state: BattleState): void {}
  destroyUnit(_unitId: string): void {}
  highlightTiles(_tiles: Pos[], _mode: HighlightMode, _persist?: boolean): void {}
  clearActionHighlights(): void {}
  clearHighlights(): void {}
  showAPPreview(_x: number, _y: number, _cost: number): void {}
  hideAPPreview(): void {}
  showFacingSelection(_unitX: number, _unitY: number): void {}
  hideFacingSelection(): void {}
  async animateMove(_unitId: string, _path: Pos[]): Promise<void> {}
  async animateAttack(_attackerId: string, _defenderId: string): Promise<void> {}
  async animateSkillCast(_casterId: string, _skillId: string, _targets: Pos[]): Promise<void> {}
  showDamageNumber(_pos: Pos, _dmg: number, _crit: boolean): void {}
  showHealNumber(_pos: Pos, _amount: number): void {}
  showMissText(_pos: Pos): void {}
  focusTile(_pos: Pos): void {}
  renderDangerZone(_tiles: Set<string>): void {}
  clearDangerZone(): void {}
  update(_time: number, _delta: number): void {}
  destroy(): void {}
}
