import type { BattleState } from '@/engine/state/BattleState';
import type { GameAction } from './MoveAction';
import { DamageCalc } from '@/engine/systems/combat/DamageCalc';
import { EventBus } from '@/engine/utils/EventBus';
import { Logger } from '@/engine/utils/Logger';
import { MathUtils } from '@/engine/utils/MathUtils';
import { produce } from 'immer';
import terrainJson from '@/assets/data/terrains.json';
import type { TerrainData, TerrainKey } from '@/engine/data/types/Terrain';

const TERRAIN_MAP: Record<string, TerrainData> = Object.fromEntries(
  (terrainJson as TerrainData[]).map(t => [t.key, t]),
);
const DEFAULT_TERRAIN = TERRAIN_MAP['plain']!;

function getTerrain(key: TerrainKey | string): TerrainData {
  return TERRAIN_MAP[key] ?? DEFAULT_TERRAIN;
}

export class AttackAction implements GameAction {
  readonly type = 'ATTACK';

  constructor(
    private readonly attackerId: string,
    private readonly defenderId: string,
  ) {}

  execute(state: BattleState): BattleState {
    const attacker = state.units[this.attackerId];
    const defender = state.units[this.defenderId];
    if (!attacker || !defender || defender.hp <= 0) return state;

    const atkTerrain = getTerrain(state.mapData.terrain[attacker.y]?.[attacker.x] ?? 'plain');
    const defTerrain = getTerrain(state.mapData.terrain[defender.y]?.[defender.x] ?? 'plain');

    // Make attacker face the target instantly
    const newFacing = MathUtils.getHitDirection(attacker.x, attacker.y, defender.x, defender.y);

    const result = DamageCalc.calc(
      {...attacker, facing: newFacing}, defender,
      { mult: 1.0, type: 'phys' },
      atkTerrain, defTerrain,
    );

    let msg = `⚔ ${attacker.name} → ${defender.name}: ${result.dmg}`;
    if (result.crit) msg += ' <b>CRIT!</b>';
    if (result.affMult > 1.05) msg += ` ×${result.affMult.toFixed(1)}`;
    Logger.log(msg, result.crit ? 'critical' : 'action');

    const next = produce(state, draft => {
      const def = draft.units[this.defenderId]!;
      def.hp = Math.max(0, def.hp - result.dmg);
      
      const att = draft.units[this.attackerId]!;
      att.currentAP = Math.max(0, att.currentAP - 3); // Default attack AP cost
      att.acted = true;
      att.facing = newFacing;
      
      draft.inputMode = 'idle';
      draft.selectedUnitId = null;
      draft.activeSkillId = null;
    });

    EventBus.emit('unitDamaged', {
      unit: next.units[this.defenderId]!,
      dmg: result.dmg,
      crit: result.crit,
      affMult: result.affMult,
    });

    if (next.units[this.defenderId]!.hp <= 0) {
      Logger.log(`💀 ${defender.name} defeated!`, 'critical');
      EventBus.emit('unitDefeated', { unit: next.units[this.defenderId]! });
    }

    return next;
  }
}
