import type { BattleState } from '@/engine/state/BattleState';
import type { Pos } from '@/engine/data/types/Map';
import type { EffectContext } from '@/engine/data/types/EffectNode';
import { produce } from 'immer';
import { EventBus } from '@/engine/utils/EventBus';
import { MathUtils } from '@/engine/utils/MathUtils';
import { evaluate } from '@/engine/systems/effectnode/EffectNodeRunner';
import { getDefaultPassives } from '@/engine/data/defaults/DefaultPassives';

export interface GameAction {
  readonly type: string;
  execute(state: BattleState): BattleState;
}

export class MoveAction implements GameAction {
  readonly type = 'MOVE';

  constructor(
    private readonly unitId: string,
    private readonly to: Pos,
    private readonly path?: Pos[],
    /** BFS-computed AP cost for this move. Must be provided when a path exists so that
     *  AP deduction happens inside the action (tracked in stateHistory) rather than outside. */
    private readonly cost?: number,
  ) {}

  get destination(): Pos { return this.to; }

  execute(state: BattleState): BattleState {
    const unit = state.units[this.unitId];
    if (!unit) return state;

    const fromX = unit.x;
    const fromY = unit.y;

    // Evaluate ZOC along the path using EffectNodeRunner
    let actualDestX = this.to.x;
    let actualDestY = this.to.y;
    let actualPath = this.path ? [...this.path] : [];
    let interruptedByZoc = false;

    if (this.path && this.path.length > 0) {
        // Collect all living enemy units with their passive effect nodes
        const enemies = Object.values(state.units)
            .filter(u => u.hp > 0 && u.team !== unit.team);

        // Traverse path step by step
        const pathSteps = this.path[0]!.x === fromX && this.path[0]!.y === fromY ? this.path.slice(1) : this.path;

        let pathIndex = 0;
        let wasInZoc = false;

        // Check if starting in ZOC
        wasInZoc = this.checkZocAtPosition(state, enemies, unit.instanceId, fromX, fromY);

        for (const step of pathSteps) {
            pathIndex++;
            const inZocNow = this.checkZocAtPosition(state, enemies, unit.instanceId, step.x, step.y);

            if (inZocNow && !wasInZoc) {
                // Entered ZOC — halt movement
                actualDestX = step.x;
                actualDestY = step.y;
                actualPath = this.path.slice(0, pathIndex + (this.path.length > pathSteps.length ? 1 : 0));
                interruptedByZoc = true;
                break;
            }
            if (inZocNow && wasInZoc) {
                actualDestX = step.x;
                actualDestY = step.y;
                actualPath = this.path.slice(0, pathIndex + (this.path.length > pathSteps.length ? 1 : 0));
                interruptedByZoc = true;
                break;
            }
            wasInZoc = inZocNow;
        }
    }

    const next = produce(state, draft => {
      const u = draft.units[this.unitId]!;
      u.prevX = fromX;
      u.prevY = fromY;
      u.facing = MathUtils.getHitDirection(fromX, fromY, actualDestX, actualDestY);
      u.x = actualDestX;
      u.y = actualDestY;

      // AP deduction: use the BFS-computed cost when provided, otherwise fall back to Manhattan.
      // This ensures the deduction is part of the dispatched action and therefore tracked in
      // stateHistory — making full undo/cancel possible.
      let apDeduct: number;
      if (this.cost !== undefined) {
          apDeduct = this.cost;
      } else if (actualPath.length === 0) {
          apDeduct = Math.abs(actualDestX - fromX) + Math.abs(actualDestY - fromY);
      } else {
          apDeduct = 0; // cost=0 means caller forgot to pass it; no silent double-deduction
      }
      u.currentAP = Math.max(0, u.currentAP - apDeduct);

      // Auto-transition to facing mode when AP is fully consumed by this move
      if (u.currentAP <= 0) {
          draft.inputMode = 'facing';
      }

      u.moved = true;
      // inputMode is set to 'facing' above if AP=0, otherwise reset to 'idle'
      if (draft.inputMode !== 'facing') {
          draft.inputMode = 'idle';
      }
      draft.selectedUnitId = this.unitId;
    });

    if (interruptedByZoc) {
         EventBus.emit('logMessage', { text: `⛔ ${unit.name}의 이동이 ZOC에 의해 차단되었습니다!`, cls: 'lae' });
    }

    const payload: any = {
      unit: next.units[this.unitId]!,
      fromX,
      fromY,
      toX: actualDestX,
      toY: actualDestY,
      path: actualPath
    };

    EventBus.emit('unitMoved', payload);

    return next;
  }

  /**
   * Check if a position is in ZOC of any enemy, using EffectNodeRunner.
   * Evaluates each enemy's passiveEffects for OnMoveEnter triggers.
   */
  private checkZocAtPosition(
    state: BattleState,
    enemies: import('@/engine/data/types/Unit').UnitInstance[],
    movingUnitId: string,
    x: number,
    y: number,
  ): boolean {
    for (const enemy of enemies) {
      const dist = MathUtils.dist({ x, y }, { x: enemy.x, y: enemy.y });
      if (dist > 2) continue; // Quick skip: no ZOC effect has range > 2

      const passives = enemy.passiveEffects && enemy.passiveEffects.length > 0
        ? enemy.passiveEffects
        : getDefaultPassives();

      const ctx: EffectContext = {
        ownerId: enemy.instanceId,
        triggeringEntityId: movingUnitId,
        currentTrigger: 'OnMoveEnter',
        distance: dist,
        position: { x, y },
      };

      const results = evaluate(passives, 'OnMoveEnter', ctx, state);
      if (results.some(r => r.interruptMovement)) {
        return true;
      }
    }
    return false;
  }
}

