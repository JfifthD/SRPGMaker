import type { BattleState } from '@/engine/state/BattleState';
import type { GameAction } from './MoveAction';
import type { SkillData } from '@/engine/data/types/Skill';
import { DamageCalc } from '@/engine/systems/combat/DamageCalc';
import { BuffSystem } from '@/engine/systems/skill/BuffSystem';
import { EventBus } from '@/engine/utils/EventBus';
import { Logger } from '@/engine/utils/Logger';
import { MathUtils } from '@/engine/utils/MathUtils';
import { produce } from 'immer';
import terrainJson from '@/assets/data/terrains.json';
import type { TerrainData, TerrainKey } from '@/engine/data/types/Terrain';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { CritSystem } from '@/engine/systems/combat/CritSystem';

const TERRAIN_MAP: Record<string, TerrainData> = Object.fromEntries(
  (terrainJson as TerrainData[]).map(t => [t.key, t]),
);
const DEFAULT_TERRAIN = TERRAIN_MAP['plain']!;
function getTerrain(key: TerrainKey | string): TerrainData {
  return TERRAIN_MAP[key] ?? DEFAULT_TERRAIN;
}

export class SkillAction implements GameAction {
  readonly type = 'SKILL';

  constructor(
    private readonly casterId: string,
    private readonly skill: SkillData,
    private readonly targetX: number,
    private readonly targetY: number,
    /** Pre-resolved targets (passed in by SkillExecutor) */
    private readonly targets: UnitInstance[],
  ) {}

  execute(state: BattleState): BattleState {
    const caster = state.units[this.casterId];
    if (!caster || caster.mp < this.skill.mp) return state;

    Logger.log(`✦ ${caster.name} → ${this.skill.name}!`, 'skill');
    EventBus.emit('skillCast', {
      caster,
      skillId: this.skill.id,
      tx: this.targetX,
      ty: this.targetY,
    });

    // Determine facing based on the skill target center
    const newFacing = MathUtils.getHitDirection(caster.x, caster.y, this.targetX, this.targetY);

    let next = produce(state, draft => {
      const u = draft.units[this.casterId]!;
      u.mp -= this.skill.mp;
      u.currentAP = Math.max(0, u.currentAP - (this.skill.ap ?? 3));
      u.acted = true;
      u.facing = newFacing;
      draft.inputMode = 'idle';
      draft.selectedUnitId = null;
      draft.activeSkillId = null;
    });

    for (const target of this.targets) {
      next = this.applyToTarget(next, caster, target);
    }

    return next;
  }

  private applyToTarget(state: BattleState, caster: UnitInstance, target: UnitInstance): BattleState {
    const sk = this.skill;

    if (sk.type === 'heal') {
      const bonus = caster.trait === 'divine_grace' ? 1.3 : 1.0;
      const amount = Math.round((sk.healVal ?? 20) * bonus);
      Logger.log(`💚 ${caster.name} → ${sk.name} → ${target.name} +${amount} HP`, 'heal');
      EventBus.emit('unitHealed', { unit: target, amount });

      return produce(state, draft => {
        const t = draft.units[target.instanceId]!;
        t.hp = MathUtils.clamp(t.hp + amount, 0, t.maxHp);
      });
    }

    if (sk.type === 'buff') {
      if (!sk.buffStat || sk.buffVal === undefined) return state;
      // Cleric divine_bless cannot target self
      if (sk.id === 'c_bless' && target.instanceId === caster.instanceId) return state;

      Logger.log(
        `🛡 ${caster.name} → ${sk.name} → ${target.name} ${sk.buffStat}+${sk.buffVal}`,
        'skill',
      );
      EventBus.emit('unitBuffed', {
        unit: target,
        stat: sk.buffStat,
        val: sk.buffVal,
        dur: sk.buffDur ?? 2,
      });

      const buffed = BuffSystem.apply(
        state.units[target.instanceId]!,
        sk.buffStat,
        sk.buffVal,
        sk.buffDur ?? 2,
      );
      return produce(state, draft => {
        draft.units[target.instanceId] = buffed;
      });
    }

    if (sk.type === 'debuff') {
      if (!sk.buffStat || sk.buffVal === undefined) return state;

      Logger.log(
        `📣 ${caster.name} → ${sk.name} → ${target.name} ${sk.buffStat}${sk.buffVal}`,
        'skill',
      );
      EventBus.emit('unitDebuffed', {
        unit: target,
        stat: sk.buffStat,
        val: sk.buffVal,
        dur: sk.buffDur ?? 2,
      });

      const debuffed = BuffSystem.apply(
        state.units[target.instanceId]!,
        sk.buffStat,
        sk.buffVal,
        sk.buffDur ?? 2,
      );
      return produce(state, draft => {
        draft.units[target.instanceId] = debuffed;
      });
    }

    // Damage skills
    const atkTerrain = getTerrain(state.mapData.terrain[caster.y]?.[caster.x] ?? 'plain');
    const defTerrain = getTerrain(state.mapData.terrain[target.y]?.[target.x] ?? 'plain');
    const crit = CritSystem.roll(caster);
    const result = DamageCalc.calc(caster, target, sk, atkTerrain, defTerrain, crit);

    let msg = `  → ${target.name}: ${result.dmg}`;
    if (result.crit) msg += ' <b>CRIT!</b>';
    if (result.affMult > 1.05) msg += ` ×${result.affMult.toFixed(1)}`;
    Logger.log(msg, result.crit ? 'critical' : 'action');

    EventBus.emit('unitDamaged', {
      unit: target,
      dmg: result.dmg,
      crit: result.crit,
      affMult: result.affMult,
    });

    let next = produce(state, draft => {
      const t = draft.units[target.instanceId]!;
      t.hp = Math.max(0, t.hp - result.dmg);
    });

    // Secondary debuff on hit (e.g. Frost Bolt → SPD-2)
    if (sk.debuff && next.units[target.instanceId]!.hp > 0) {
      const { stat, val, dur } = sk.debuff;
      const debuffed = BuffSystem.apply(next.units[target.instanceId]!, stat, val, dur);
      next = produce(next, draft => {
        draft.units[target.instanceId] = debuffed;
      });
    }

    if (next.units[target.instanceId]!.hp <= 0) {
      Logger.log(`💀 ${target.name} defeated!`, 'critical');
      EventBus.emit('unitDefeated', { unit: next.units[target.instanceId]! });
    }

    return next;
  }
}
