import type { BattleState } from '@/engine/state/BattleState';
import type { Pos } from '@/engine/data/types/Map';
import { produce } from 'immer';
import { EventBus } from '@/engine/utils/EventBus';
import { MathUtils } from '@/engine/utils/MathUtils';

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
  ) {}

  get destination(): Pos { return this.to; }

  execute(state: BattleState): BattleState {
    const unit = state.units[this.unitId];
    if (!unit) return state;

    const fromX = unit.x;
    const fromY = unit.y;

    // Evaluate ZOC along the path
    let actualDestX = this.to.x;
    let actualDestY = this.to.y;
    let actualPath = this.path ? [...this.path] : [];
    let interruptedByZoc = false;

    if (this.path && this.path.length > 0) {
        // Find existing enemy positions to create a virtual ZOC map
        const enemyPositions = Object.values(state.units)
            .filter(u => u.hp > 0 && u.team !== unit.team)
            .map(u => ({ x: u.x, y: u.y }));
            
        // Traverse path step by step. We skip the first node if it's the starting position.
        const pathSteps = this.path[0]!.x === fromX && this.path[0]!.y === fromY ? this.path.slice(1) : this.path;
        
        let pathIndex = 0;
        let wasInZoc = false; // Track if we STARTED inside a ZOC
        
        // Initial check: are we starting adjacent to an enemy?
        wasInZoc = enemyPositions.some(ep => MathUtils.dist({x: fromX, y: fromY}, ep) === 1);

        for (const step of pathSteps) {
            pathIndex++;
            const inZocNow = enemyPositions.some(ep => MathUtils.dist(step, ep) === 1);
            
            // ZOC rule: If you enter an enemy's ZOC, you must stop immediately.
            // If you start in a ZOC, you can move out of it, but entering ANOTHER ZOC stops you.
            if (inZocNow && !wasInZoc) {
                // Stepped into ZOC! Movement halts here.
                actualDestX = step.x;
                actualDestY = step.y;
                actualPath = this.path.slice(0, pathIndex + (this.path.length > pathSteps.length ? 1 : 0));
                interruptedByZoc = true;
                break;
            }
            // Update wasInZoc for the next step iteration (if we move from ZOC tile to ZOC tile, we must stop)
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

      // Calculate AP cost for the actual traversed distance
      const cost = Math.abs(actualDestX - fromX) + Math.abs(actualDestY - fromY);
      u.currentAP = Math.max(0, u.currentAP - cost);

      u.moved = true;
      draft.inputMode = 'idle';
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
}
