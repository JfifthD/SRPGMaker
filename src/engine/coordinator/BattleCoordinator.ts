import { store } from '@/engine/state/GameStore';
import { EventBus } from '@/engine/utils/EventBus';
import { Pathworker } from '@/engine/systems/movement/PathfindingWorkerClient';
import { RangeCalc } from '@/engine/systems/movement/RangeCalc';
import { EnemyAI } from '@/engine/systems/ai/EnemyAI';
import { StateQuery } from '@/engine/state/BattleState';
import { MoveAction } from '@/engine/state/actions/MoveAction';
import { FacingAction } from '@/engine/state/actions/FacingAction';
import { AttackAction } from '@/engine/state/actions/AttackAction';
import { WaitAction } from '@/engine/state/actions/WaitAction';
import { SkillAction } from '@/engine/state/actions/SkillAction';
import type { IRenderer } from '@/engine/renderer/IRenderer';
import type { Pos } from '@/engine/data/types/Map';
import type { BattleState } from '@/engine/state/BattleState';
import { DamageCalc } from '@/engine/systems/combat/DamageCalc';
import { MathUtils } from '@/engine/utils/MathUtils';
import type { SkillData } from '@/engine/data/types/Skill';
import type { TerrainKey, TerrainData } from '@/engine/data/types/Terrain';
import { buildDangerZone } from '@/engine/systems/movement/DangerZoneCalc';
import type { BFSContext, ReachableTile } from '@/engine/systems/movement/BFS';
import terrainJson from '@/assets/data/terrains.json';
import skillsJson from '@/assets/data/skills.json';
import { getEffectiveStats } from '@/engine/systems/progression/EquipmentSystem';

export interface ActionPayload {
  id: string; // Used for generic strings now to support sub menus and skills
  label: string;
  costAP: number;
  disabled: boolean;
  metadata?: any;
}

const ALL_SKILLS: Record<string, SkillData> = skillsJson as Record<string, SkillData>;
const TERRAIN_MAP: Record<string, TerrainData> = Object.fromEntries(
  (terrainJson as TerrainData[]).map(t => [t.key, t]),
);

export class BattleCoordinator {
  private renderer: IRenderer;
  
  // Local volatile state mimicking BattleScene's old tracking
  private moveTiles: ReachableTile[] = [];
  private zoneATiles: ReachableTile[] = []; // subset of moveTiles where AP >= atkCost after move
  private rangeTiles: Pos[] = [];
  private hoveredTile: string | null = null;
  private busy = false;
  private lastMoveAnimation: Promise<void> = Promise.resolve();
  private dangerZoneVisible = false;

  constructor(renderer: IRenderer) {
    this.renderer = renderer;

    // Subscribe to store changes
    store.subscribe((state) => this.onStateChange(state));

    // Subscribe to EventBus for animation events
    EventBus.on('unitMoved', async e => {
      const p = (e.path && e.path.length > 0)
        ? this.renderer.animateMove(e.unit.instanceId, e.path)
        : this.renderer.animateMove(e.unit.instanceId, [{ x: e.toX, y: e.toY }]);
      this.lastMoveAnimation = p;
      // Only manage busy for ally (player) moves.
      // During enemy phase, busy is managed exclusively by runEnemyPhase.
      if (e.unit.team !== 'enemy') {
        this.busy = true;
        await p;
        this.busy = false;
        
        // After move animation completes, if it's still our turn and unit is active:
        const currentState = store.getState();
        if (currentState.phase === 'PLAYER_IDLE' && currentState.activeUnitId === e.unit.instanceId) {
            const currentUnit = StateQuery.unit(currentState, e.unit.instanceId);

            // MoveAction sets inputMode='facing' when AP hits 0, so we just need to render it.
            if (currentState.inputMode === 'facing' && currentUnit) {
              this.renderer.showFacingSelection(currentUnit.x, currentUnit.y);
            } else {
              // AP remains — re-highlight remaining move tiles and re-open Ring Menu
              this.handleIdleClick(e.toX, e.toY, currentState);
            }
        }
      }
    });
    
    EventBus.on('unitDamaged', e => this.renderer.showDamageNumber({ x: e.unit.x, y: e.unit.y }, e.dmg, e.crit));
    EventBus.on('unitDefeated', e => this.renderer.destroyUnit(e.unit.instanceId));
    EventBus.on('unitHealed',   e => this.renderer.showHealNumber({ x: e.unit.x, y: e.unit.y }, e.amount));

    // Auto-highlight active ally's move range when their turn starts
    EventBus.on('turnStarted', async e => {
      if (e.phase !== 'player' || !e.activeUnitId) return;
      store.setSelectedUnit(e.activeUnitId);
      const state = store.getState();
      const unit = StateQuery.unit(state, e.activeUnitId);
      if (unit && unit.currentAP > 0) {
        const nodes = await Pathworker.getReachable(unit, state);
        this.computeAndShowZones(unit, nodes, state);
      }
      this.broadcastAvailableActions(store.getState());
      // Auto-open Ring Menu for the active unit
      if (unit) {
        EventBus.emit('openRingMenu', { unit, tx: unit.x, ty: unit.y });
      }
    });
  }

  // ── Action Payload Broadcasting ───────────────────────────

  public broadcastAvailableActions(state: BattleState): void {
    if (state.phase !== 'PLAYER_IDLE' || !state.activeUnitId) {
      EventBus.emit('actionMenuUpdate', { actions: [] });
      return;
    }
    const unit = StateQuery.unit(state, state.activeUnitId);
    if (!unit) return;

    const payload: ActionPayload[] = [];
    const hasActedAtAll = unit.moved || unit.acted;

    // Movement is intrinsic via clicking tiles; we do not show a literal MOVE button anymore to save visual space.

    // Attack is allowed if they have AP
    payload.push({
      id: 'attack', label: 'ATTACK', costAP: 3, // Base attack cost TODO: fetch from unit/weapon
      disabled: unit.currentAP < 3
    });

    // Skill is a sub-menu in UI, but parent needs to check AP constraints
    const unitSkills = unit.skills.map(skId => {
       const skData = ALL_SKILLS[skId];
       return {
           id: skId,
           name: skData?.name || skId,
           ap: skData?.ap || 3,
           mp: skData?.mp || 0,
           range: skData?.range || 1,
           desc: skData?.desc || '',
           canUse: skData && unit.mp >= skData.mp && unit.currentAP >= (skData.ap || 3)
       };
    });

    payload.push({
      id: 'skill', label: 'SKILLS', costAP: 0,
      disabled: unit.skills.length === 0,
      metadata: { skills: unitSkills }
    });

    // Wait command (discards remaining AP)
    payload.push({
      id: 'wait', label: 'WAIT', costAP: 0, disabled: false
    });

    EventBus.emit('actionMenuUpdate', { actions: payload });
  }

  // ── Input callbacks (called by InputHandler) ──────────────

  onTileClick(tx: number, ty: number): void {
    if (this.busy) return;
    const state = store.getState();
    
    // Validate bounds
    if (tx < 0 || tx >= state.mapData.width || ty < 0 || ty >= state.mapData.height) return;

    if (state.phase === 'ENEMY_PHASE') return;

    switch (state.inputMode) {
      case 'idle':
        this.handleIdleClick(tx, ty, state);
        break;
      case 'move':
        this.handleMoveClick(tx, ty, state);
        break;
      case 'attack':
        this.handleAttackClick(tx, ty, state);
        break;
      case 'skill':
        this.handleSkillTargetClick(tx, ty, state);
        break;
      case 'facing':
        this.handleFacingClick(tx, ty, state);
        break;
    }
  }

  onTileHover(tx: number, ty: number): void {
    if (this.busy) return;
    const state = store.getState();
    if (state.phase === 'ENEMY_PHASE') return;

    if (tx < 0 || tx >= state.mapData.width || ty < 0 || ty >= state.mapData.height) {
      this.clearHoverPreview();
      return;
    }

    const hoverKey = `${tx},${ty}`;
    if (this.hoveredTile === hoverKey) return;
    this.hoveredTile = hoverKey;

    // 'move' mode = active ally with AP > 0 has zone overlay visible.
    // On hover: show AP cost text + highlight the EXACT attack range from this specific tile
    // (a precise subset of Zone C which shows the full union). Zone A/B/C persist on moveGraphics.
    if (state.inputMode === 'move' && state.selectedUnitId && state.activeUnitId === state.selectedUnitId) {
      const tile = this.moveTiles.find(t => t.x === tx && t.y === ty);
      const attacker = StateQuery.unit(state, state.selectedUnitId);
      this.renderer.clearActionHighlights(); // clears only actionGraphics; zone overlay persists
      if (tile && attacker) {
        this.renderer.showAPPreview(tx, ty, tile.cost);
        // If this is a Zone A tile, show the exact attack range from this position (on actionGraphics)
        const isZoneA = this.zoneATiles.some(t => t.x === tx && t.y === ty);
        if (isZoneA) {
          const range = RangeCalc.skillRange(
            { x: tx, y: ty },
            { range: attacker.atkRange, aoe: false } as SkillData,
            state.mapData.width,
            state.mapData.height,
          );
          this.renderer.highlightTiles(range, 'attack'); // non-persist → drawn on actionGraphics only
        }
      } else {
        this.renderer.hideAPPreview();
      }
      return;
    }

    if ((state.inputMode === 'skill' || state.inputMode === 'attack') && state.selectedUnitId) {
      const inRange = this.rangeTiles.some(t => t.x === tx && t.y === ty);
      const clicked = StateQuery.at(state, tx, ty);
      const attacker = StateQuery.unit(state, state.selectedUnitId);

      if (inRange && clicked && attacker) {
        let sk: SkillData | undefined;
        if (state.inputMode === 'attack') {
          sk = { range: attacker.atkRange, aoe: false, type: 'physical', mult: 1, ignoreDef: false } as unknown as SkillData;
          if (clicked.team === attacker.team) {
            EventBus.emit('combatPreview', { preview: null });
            return;
          }
        } else if (state.activeSkillId) {
          sk = ALL_SKILLS[state.activeSkillId];
          if (sk && sk.target === 'enemy' && clicked.team === attacker.team) {
             EventBus.emit('combatPreview', { preview: null });
             return;
          }
          if (sk && sk.target === 'ally' && clicked.team !== attacker.team) {
             EventBus.emit('combatPreview', { preview: null });
             return;
          }
        }

        if (sk) {
          const atkTerrain = (TERRAIN_MAP[state.mapData.terrain[attacker.y]?.[attacker.x] as TerrainKey] ?? TERRAIN_MAP['plain'])!;
          const defTerrain = (TERRAIN_MAP[state.mapData.terrain[clicked.y]?.[clicked.x] as TerrainKey] ?? TERRAIN_MAP['plain'])!;
          const equipMap = state.gameProject.equipmentMap ?? {};
          const attEff = getEffectiveStats(attacker, equipMap);
          const defEff = getEffectiveStats(clicked, equipMap);
          const preview = DamageCalc.preview(
            { ...attacker, atk: attEff.atk },
            { ...clicked, def: defEff.def },
            sk, atkTerrain, defTerrain,
          );
          EventBus.emit('combatPreview', { preview, target: clicked });
        } else {
          EventBus.emit('combatPreview', { preview: null });
        }
      } else {
        EventBus.emit('combatPreview', { preview: null });
      }
    } else {
      EventBus.emit('combatPreview', { preview: null });
    }
  }

  private clearHoverPreview() {
    this.hoveredTile = null;
    this.renderer.hideAPPreview();
    this.renderer.clearActionHighlights();
    EventBus.emit('combatPreview', { preview: null });
  }

  onCancel(): void {
    if (this.busy) return;
    const state = store.getState();
    const unit = state.selectedUnitId ? StateQuery.unit(state, state.selectedUnitId) : null;
    this.hoveredTile = null;

    // 1. Always clean up visual overlays first (facing arrows are purely visual — not part of state)
    this.renderer.hideFacingSelection();
    this.renderer.hideAPPreview();
    EventBus.emit('closeRingMenu', {});

    // 2. If we were targeting skills or attacks, drop back to idle state without undoing movement
    if (state.inputMode === 'attack' || state.inputMode === 'skill') {
        store.dispatchAsync(null, draft => {
            draft.inputMode = 'idle';
            draft.activeSkillId = null;
        });
        this.rangeTiles = [];
        this.renderer.clearHighlights();
        
        // After stepping back to idle, re-open the UI for the unit
        if (unit) {
            setTimeout(() => {
                this.handleIdleClick(unit.x, unit.y, store.getState());
            }, 0);
        }
        EventBus.emit('combatPreview', { preview: null });
        return;
    }
    
    // 3. Revert movement if we haven't acted yet and we're just in idle mode
    if (unit && unit.team === 'ally' && unit.moved && !unit.acted && state.stateHistory.length > 0) {
      // Undo all partial moves back to turn-start in one shot (no dispatch — prevents history bounce)
      store.undoUnitMoves(unit.instanceId);
      const revertedState = store.getState();

      const revertedUnit = revertedState.activeUnitId
        ? StateQuery.unit(revertedState, revertedState.activeUnitId)
        : null;
      if (revertedUnit && revertedUnit.currentAP > 0) {
        Pathworker.getReachable(revertedUnit, revertedState).then(nodes => {
          this.computeAndShowZones(revertedUnit, nodes, revertedState);
        });
        EventBus.emit('openRingMenu', { unit: revertedUnit, tx: revertedUnit.x, ty: revertedUnit.y });
      } else {
        this.moveTiles = [];
        this.rangeTiles = [];
        this.renderer.clearHighlights();
        if (revertedUnit) {
           EventBus.emit('openRingMenu', { unit: revertedUnit, tx: revertedUnit.x, ty: revertedUnit.y });
        }
      }

      EventBus.emit('combatPreview', { preview: null });
      return;
    }

    // 4. If nothing else, clear everything
    store.clearSelection();
    this.moveTiles = [];
    this.zoneATiles = [];
    this.rangeTiles = [];
    this.renderer.clearHighlights();
    EventBus.emit('cancelAction', {});
    EventBus.emit('combatPreview', { preview: null });
    this.hoveredTile = null;
  }

  // ── State change handler ──────────────────────────────────

  private onStateChange(state: BattleState): void {
    this.renderer.syncUnits(state);

    if (state.phase === 'PLAYER_IDLE' && state.activeUnitId) {
       this.broadcastAvailableActions(state);
    }

    // Guard: only start runEnemyPhase when not already running.
    // store.nextTurn() inside runEnemyPhase triggers onStateChange synchronously;
    // the busy flag prevents re-entrant execution.
    if (state.phase === 'ENEMY_PHASE' && !this.busy) {
      this.runEnemyPhase(state);
    }
  }

  // ── Private helpers ───────────────────────────────────────

  private handleIdleClick(tx: number, ty: number, state: BattleState): void {
    const unit = StateQuery.at(state, tx, ty);
    if (!unit) return;

    store.setSelectedUnit(unit.instanceId);
    this.rangeTiles = [];
    
    if (unit.team === 'ally' && unit.instanceId === state.activeUnitId) {
      if (unit.currentAP > 0) {
        Pathworker.getReachable(unit, state).then(nodes => {
          this.computeAndShowZones(unit, nodes, state);
        });
      }
      // Ring menu anchor event for UI
      if (state.phase === 'PLAYER_IDLE') {
         EventBus.emit('openRingMenu', { unit, tx, ty });
      }
    } else {
      this.moveTiles = [];
      this.renderer.clearHighlights();
      this.renderer.highlightTiles([{x: unit.x, y: unit.y}], 'selected', true);
      EventBus.emit('closeRingMenu', {});
      this.hoveredTile = null;
    }
  }

  private handleMoveClick(tx: number, ty: number, state: BattleState): void {
    const unit = StateQuery.unit(state, state.selectedUnitId!);
    if (!unit) return;

    const clicked = StateQuery.at(state, tx, ty);
    const inRange = this.moveTiles.some(t => t.x === tx && t.y === ty);

    if (inRange && !(clicked && clicked.instanceId !== state.selectedUnitId)) {
        EventBus.emit('closeRingMenu', {});
        // Find path asynchronously
        Pathworker.getPath({x: unit.x, y: unit.y}, {x: tx, y: ty}, unit, state).then(path => {
          this.renderer.clearHighlights();
          this.renderer.hideAPPreview();
          const targetTile = this.moveTiles.find(t => t.x === tx && t.y === ty);
          const moveCost = targetTile?.cost ?? 0;
          this.moveTiles = [];
          this.hoveredTile = null;

          // Pass cost into MoveAction so AP deduction is tracked inside stateHistory.
          // This guarantees full AP restoration on cancel/undo.
          store.dispatch(new MoveAction(unit.instanceId, {x: tx, y: ty}, path || [{x: tx, y: ty}], moveCost));
          // Facing UI is shown after animation completes in the 'unitMoved' event listener.
        });
    } else if (clicked) {
        this.handleIdleClick(tx, ty, state);
    }
  }

  private handleAttackClick(tx: number, ty: number, state: BattleState): void {
    const unit = StateQuery.unit(state, state.selectedUnitId!);
    if (!unit) return;
    
    const clicked = StateQuery.at(state, tx, ty);
    const inRange = this.rangeTiles.some(t => t.x === tx && t.y === ty);
    
    if (!inRange) return;
    if (!clicked || clicked.team === unit.team) return;
    
    this.doAttack(unit.instanceId, clicked.instanceId);
  }

  private async doAttack(attackerId: string, targetId: string): Promise<void> {
    this.busy = true;
    await this.renderer.animateAttack(attackerId, targetId);
    store.dispatch(new AttackAction(attackerId, targetId));
    this.moveTiles = [];
    this.rangeTiles = [];
    this.renderer.clearHighlights();
    this.busy = false;

    // Auto-end turn if unit is dead or out of AP
    const postState = store.getState();
    const attacker = StateQuery.unit(postState, attackerId);
    if (!attacker || attacker.hp <= 0 || attacker.currentAP <= 0) {
      EventBus.emit('closeRingMenu', {});
      this.endTurn();
    } else {
      setTimeout(() => {
        this.handleIdleClick(attacker.x, attacker.y, store.getState());
      }, 0);
    }
  }

  private handleSkillTargetClick(tx: number, ty: number, state: BattleState): void {
    if (!state.selectedUnitId || !state.activeSkillId) return;
    
    const inRange = this.rangeTiles.some(t => t.x === tx && t.y === ty);
    if (!inRange) return;
    
    this.doSkill(state.selectedUnitId, state.activeSkillId, tx, ty, state);
  }

  private handleFacingClick(tx: number, ty: number, state: BattleState): void {
    const unit = state.selectedUnitId ? StateQuery.unit(state, state.selectedUnitId) : null;
    if (!unit) return;

    // Determine facing direction based on click relative to unit
    const dx = tx - unit.x;
    const dy = ty - unit.y;

    let newFacing = unit.facing;
    if (dx === 0 && dy === -1) newFacing = 'N';
    else if (dx === 1 && dy === 0) newFacing = 'E';
    else if (dx === 0 && dy === 1) newFacing = 'S';
    else if (dx === -1 && dy === 0) newFacing = 'W';
    // If clicked exactly on the unit or far away, keep current facing
    
    store.dispatch(new FacingAction(unit.instanceId, newFacing));
    
    this.renderer.hideFacingSelection();
    // After facing is chosen, the turn truly ends
    this.endTurn();
  }

  private async doSkill(casterId: string, skillId: string, tx: number, ty: number, state: BattleState): Promise<void> {
    const caster = StateQuery.unit(state, casterId);
    const sk = ALL_SKILLS[skillId];
    if (!caster || !sk) return;

    this.busy = true;
    
    const targets = sk.aoe
      ? Object.values(state.units).filter((u: any) => {
          if (u.hp <= 0) return false;
          if (!MathUtils.dist(u, { x: tx, y: ty })) return true;
          if (sk.target === 'enemy') return u.team !== caster.team && MathUtils.dist(u, { x: tx, y: ty }) <= 1;
          if (sk.target === 'ally') return u.team === caster.team && MathUtils.dist(u, { x: tx, y: ty }) <= 1;
          return MathUtils.dist(u, { x: tx, y: ty }) <= 1;
        })
      : (() => {
          const t = StateQuery.at(state, tx, ty);
          if (!t) return [];
          if (sk.target === 'enemy' && t.team === caster.team) return [];
          if (sk.target === 'ally'  && t.team !== caster.team) return [];
          if (sk.target === 'self'  && t.instanceId !== caster.instanceId) return [];
          return [t];
        })();

    await this.renderer.animateSkillCast(casterId, skillId, targets);
    store.dispatch(new SkillAction(casterId, sk, tx, ty, targets));
    
    this.moveTiles = [];
    this.rangeTiles = [];
    this.renderer.clearHighlights();
    this.busy = false;

    // Auto-end turn if unit is dead or out of AP
    const postState = store.getState();
    const caster2 = StateQuery.unit(postState, casterId);
    if (!caster2 || caster2.hp <= 0 || caster2.currentAP <= 0) {
      EventBus.emit('closeRingMenu', {});
      this.endTurn();
    } else {
      setTimeout(() => {
        this.handleIdleClick(caster2.x, caster2.y, store.getState());
      }, 0);
    }
  }

  // ── Public API for UI ──────────────────────────────────────
  
  activateSkill(skillId: string): void {
    const state = store.getState();
    const unit = state.selectedUnitId ? StateQuery.unit(state, state.selectedUnitId) : null;
    if (!unit) return;
    const sk = ALL_SKILLS[skillId];
    if (!sk || unit.mp < sk.mp || unit.currentAP < (sk.ap ?? 3)) return;

    store.dispatchAsync(null, draft => {
       draft.activeSkillId = skillId;
       draft.inputMode = 'skill';
    });
    
    const updatedState = store.getState();
    this.rangeTiles = RangeCalc.skillRange(
      { x: unit.x, y: unit.y }, sk,
      updatedState.mapData.width,
      updatedState.mapData.height,
    );
    
    this.renderer.clearHighlights();
    this.renderer.highlightTiles(this.rangeTiles, 'skill');
  }

  activateAttack(): void {
    const state = store.getState();
    const unit = state.selectedUnitId ? StateQuery.unit(state, state.selectedUnitId) : null;
    if (!unit || unit.currentAP < 3) return;
    
    store.dispatchAsync(null, draft => {
       draft.activeSkillId = null;
       draft.inputMode = 'attack';
    });
    
    const updatedState = store.getState();
    this.rangeTiles = RangeCalc.skillRange(
      { x: unit.x, y: unit.y },
      { range: unit.atkRange, aoe: false } as SkillData,
      updatedState.mapData.width,
      updatedState.mapData.height,
    );
    
    this.renderer.clearHighlights();
    this.renderer.highlightTiles(this.rangeTiles, 'attack');
  }

  waitAction(): void {
    const state = store.getState();
    if (!state.selectedUnitId) return;
    
    store.dispatch(new WaitAction(state.selectedUnitId));
    
    // Instead of ending turn immediately, enter facing selection mode
    store.dispatchAsync(null, draft => {
      draft.inputMode = 'facing';
    });
    
    EventBus.emit('closeRingMenu', {});
    this.renderer.clearHighlights();
    
    const unit = StateQuery.unit(store.getState(), state.selectedUnitId);
    if (unit) {
      this.renderer.showFacingSelection(unit.x, unit.y);
    }
  }

  // ── 3-Zone Static Overlay ─────────────────────────────────

  /**
   * Compute and render the 3-zone reachability overlay for an active ally unit.
   *
   * Zone A (teal)       — can move here AND still afford to attack (remainingAP >= atkCost)
   * Zone B (dim blue)   — can reach but not enough AP to attack afterward
   * Zone C (dark red)   — union of attack tiles reachable from any Zone A position
   *
   * Drawn back-to-front on the persist (moveGraphics) layer so Zone A always reads on top.
   */
  private computeAndShowZones(
    unit: import('@/engine/data/types/Unit').UnitInstance,
    reachable: ReachableTile[],
    state: BattleState,
  ): void {
    const atkCost = 3; // must match broadcastAvailableActions cost; TODO: from unit/weapon data

    const zoneA = reachable.filter(t => unit.currentAP - t.cost >= atkCost);
    const zoneB = reachable.filter(t => unit.currentAP - t.cost < atkCost);

    // Zone C: union of attack tiles from all Zone A positions, excluding the movement zone itself
    const movePosSet = new Set(reachable.map(t => `${t.x},${t.y}`));
    const zoneCSet = new Set<string>();
    for (const tile of zoneA) {
      RangeCalc.skillRange(
        { x: tile.x, y: tile.y },
        { range: unit.atkRange, aoe: false } as SkillData,
        state.mapData.width,
        state.mapData.height,
      ).forEach(t => {
        const key = `${t.x},${t.y}`;
        if (!movePosSet.has(key)) zoneCSet.add(key);
      });
    }
    const zoneC: Pos[] = [];
    for (const key of zoneCSet) {
      const parts = key.split(',');
      zoneC.push({ x: parseInt(parts[0]!, 10), y: parseInt(parts[1]!, 10) });
    }

    this.zoneATiles = zoneA;
    this.moveTiles  = reachable;
    this.rangeTiles = [];

    this.renderer.clearHighlights();
    // Back-to-front: Zone C first so A sits on top visually
    if (zoneC.length > 0) this.renderer.highlightTiles(zoneC, 'attack-reach', true);
    if (zoneB.length > 0) this.renderer.highlightTiles(zoneB, 'move-only',    true);
    if (zoneA.length > 0) this.renderer.highlightTiles(zoneA, 'move-attack',  true);
  }

  async endTurn(): Promise<void> {
    if (this.busy) return;
    // Clear selection WITHOUT undo — End Turn always commits the current state.
    // (onCancel() would undo a pending move if unit.moved && !unit.acted)
    store.clearSelection();
    this.moveTiles = [];
    this.zoneATiles = [];
    this.rangeTiles = [];
    this.renderer.clearHighlights();
    EventBus.emit('combatPreview', { preview: null });
    this.hoveredTile = null;
    store.nextTurn();
    // onStateChange fires synchronously from nextTurn and handles runEnemyPhase.

    // Refresh danger zone if visible (enemy positions changed)
    if (this.dangerZoneVisible) {
      this.refreshDangerZone();
    }
  }

  toggleDangerZone(): void {
    this.dangerZoneVisible = !this.dangerZoneVisible;
    EventBus.emit('dangerZoneToggled', { visible: this.dangerZoneVisible });

    if (this.dangerZoneVisible) {
      this.refreshDangerZone();
    } else {
      this.renderer.clearDangerZone();
    }
  }

  private refreshDangerZone(): void {
    const state = store.getState();
    const ctx = this.buildBFSContext(state);
    const dangerTiles = buildDangerZone(state, ctx);
    const numEnemies = Object.values(state.units).filter(u => u.hp > 0 && u.team === 'enemy').length;
    console.log('[DangerZone] Computed ' + dangerTiles.size + ' tiles from ' + numEnemies + ' enemies');
    this.renderer.renderDangerZone(dangerTiles);
  }

  private buildBFSContext(state: BattleState): BFSContext {
    return {
      width: state.mapData.width,
      height: state.mapData.height,
      getTerrain(x: number, y: number) {
        const key = state.mapData.terrain[y]?.[x] as TerrainKey ?? 'plain';
        return TERRAIN_MAP[key] ?? TERRAIN_MAP['plain']!;
      },
      getUnit(x: number, y: number) {
        return Object.values(state.units).find(u => u.hp > 0 && u.x === x && u.y === y);
      },
    };
  }

  private async runEnemyPhase(state: BattleState): Promise<void> {
    this.busy = true;

    // CT system: only the ACTIVE enemy acts this turn (the one that reached CT >= 100).
    // After acting, nextTurn() advances CT to the next unit, which may be another enemy.
    // The busy guard in onStateChange prevents re-entrant calls; we chain explicitly below.
    const enemy = state.activeUnitId ? StateQuery.unit(state, state.activeUnitId) : null;

    if (enemy && enemy.team === 'enemy' && enemy.hp > 0) {
      // Show enemy movement range briefly so the player can see what's coming
      const reachable = await Pathworker.getReachable(enemy, state);
      if (reachable.length > 0) {
        this.renderer.highlightTiles(reachable, 'move', true);
        await new Promise(r => setTimeout(r, 600));
        this.renderer.clearHighlights();
      }

      if (StateQuery.liveAllies(store.getState()).length > 0) {
        const actions = await EnemyAI.decide(enemy, store.getState());
        for (const action of actions) {
          store.dispatch(action);
          await this.lastMoveAnimation; // Wait for move animation to fully complete
          await new Promise(r => setTimeout(r, 150));
        }
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // Check for game-over before advancing — checkWin may have set phase to VICTORY/DEFEAT
    if (store.getState().phase === 'VICTORY' || store.getState().phase === 'DEFEAT') {
      this.busy = false;
      return;
    }

    store.nextTurn();
    this.busy = false;

    // If the next unit is also an enemy, chain to their turn directly.
    const nextState = store.getState();
    if (nextState.phase === 'VICTORY' || nextState.phase === 'DEFEAT') return;
    if (nextState.phase === 'ENEMY_PHASE') {
      this.runEnemyPhase(nextState);
    }
  }
}
