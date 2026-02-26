import type { Pos } from '@/engine/data/types/Map';
import type { BattleState } from '@/engine/state/BattleState';

export type HighlightMode =
  | 'move'         // legacy single-color move range
  | 'attack'       // attack target range (action layer)
  | 'skill'        // skill target range (action layer)
  | 'aoe'
  | 'selected'
  // 3-Zone static overlay (persist layer, shown on unit selection)
  | 'move-attack'  // Zone A: can move here AND still afford to attack
  | 'move-only'    // Zone B: can reach but AP too low to attack afterward
  | 'attack-reach' // Zone C: union of attack tiles reachable from any Zone A position
  ;

export interface IRenderer {
  // ── Map & Terrain ─────────────────────────────
  /** Full map redraw (terrain tiles, grid lines). Called once on init and on state change. */
  renderMap(state: BattleState): void;

  // ── Unit Visuals ───────────────────────────────
  /** Sync all unit sprite positions/states to current BattleState. */
  syncUnits(state: BattleState): void;

  /** Remove a unit's sprite (on defeat). */
  destroyUnit(unitId: string): void;

  /** Highlight a set of tiles in a given mode (color-coded). If persist is true, it won't be cleared by clearActionHighlights */
  highlightTiles(tiles: Pos[], mode: HighlightMode, persist?: boolean): void;

  /** Clear specific action highlights (attack/skill). */
  clearActionHighlights(): void;

  /** Clear all tile highlights including move. */
  clearHighlights(): void;

  // ── AP & Facing UI ─────────────────────────────
  /** Show the AP cost of moving to a specific hovered tile. */
  showAPPreview(x: number, y: number, cost: number): void;

  /** Hide the AP cost preview. */
  hideAPPreview(): void;

  /** Show directional selection arrows around a unit (N, E, S, W). */
  showFacingSelection(unitX: number, unitY: number): void;

  /** Hide directional selection arrows. */
  hideFacingSelection(): void;

  // ── Animations (all return Promise so coordinator can await) ──
  /** Animate a unit moving along a path. Path excludes the start tile. */
  animateMove(unitId: string, path: Pos[]): Promise<void>;

  /** Flash the attacker + shake the defender. */
  animateAttack(attackerId: string, defenderId: string): Promise<void>;

  /** Skill cast VFX (projectile, AoE burst, heal glow, etc.). */
  animateSkillCast(
    casterId: string,
    skillId: string,
    targets: Pos[],
  ): Promise<void>;

  // ── Floating Numbers ───────────────────────────
  showDamageNumber(pos: Pos, dmg: number, crit: boolean): void;
  showHealNumber(pos: Pos, amount: number): void;
  showMissText(pos: Pos): void;

  // ── Camera ─────────────────────────────────────
  /** Pan/zoom camera to center on a tile. */
  focusTile(pos: Pos): void;

  // ── Danger Zone ────────────────────────────────
  /** Render red overlay on danger zone tiles. */
  renderDangerZone(tiles: Set<string>): void;

  /** Clear danger zone overlay. */
  clearDangerZone(): void;

  // ── Lifecycle ──────────────────────────────────
  /** Called every Phaser update tick (for animations that need per-frame updates). */
  update(time: number, delta: number): void;

  /** Clean up all Phaser objects (called when scene shuts down). */
  destroy(): void;
}
