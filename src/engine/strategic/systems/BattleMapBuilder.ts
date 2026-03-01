// ─────────────────────────────────────────────
//  Battle Map Builder — Converts strategic generals → tactical MapData
//  Creates UnitSpawns from generals' unitDataId + commander buff info.
//  Zero Phaser imports.
// ─────────────────────────────────────────────

import type { MapData, UnitSpawn } from '@/engine/data/types/Map';
import type { TerrainKey } from '@/engine/data/types/Terrain';
import type { WorldState, BattleContext } from '../state/WorldState';
import type { GeneralState } from '../data/types/General';

/** Result of building a battle map from strategic context. */
export interface BattleMapBuildResult {
  mapData: MapData;
  /** General → unitDataId mapping for post-battle result extraction */
  allyGeneralIds: string[];
  enemyGeneralIds: string[];
  /** Commander buff percentage (0-20) per side */
  allyCommanderBuff: number;
  enemyCommanderBuff: number;
}

// Default auto-battle map dimensions
const DEFAULT_WIDTH = 12;
const DEFAULT_HEIGHT = 10;
const DEFAULT_TERRAIN: TerrainKey = 'plain';

export const BattleMapBuilder = {
  /**
   * Build a MapData from a BattleContext + WorldState.
   * Attacker generals → allySpawns, Defender generals → enemySpawns.
   * The "player" in auto-battle is always the attacker side.
   */
  build(
    battle: BattleContext,
    state: WorldState,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
  ): BattleMapBuildResult {
    const attackerArmy = state.armies[battle.attacker.armyId];
    const defenderArmy = state.armies[battle.defender.armyId];

    const attackerGenerals = attackerArmy
      ? attackerArmy.generals.map(id => state.generals[id]).filter(Boolean) as GeneralState[]
      : [];
    const defenderGenerals = defenderArmy
      ? defenderArmy.generals.map(id => state.generals[id]).filter(Boolean) as GeneralState[]
      : [];

    // Build spawns — attacker on left (x=1), defender on right (x=width-2)
    const allySpawns = BattleMapBuilder.createSpawns(attackerGenerals, 1, height);
    const enemySpawns = BattleMapBuilder.createSpawns(defenderGenerals, width - 2, height);

    // Build terrain grid (plain for now; future: territory terrain type)
    const terrain: TerrainKey[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TerrainKey[] = [];
      for (let x = 0; x < width; x++) {
        row.push(DEFAULT_TERRAIN);
      }
      terrain.push(row);
    }

    const mapData: MapData = {
      id: battle.battleMapId,
      name: `Battle at ${battle.territoryId ?? 'field'}`,
      width,
      height,
      terrain,
      allySpawns,
      enemySpawns,
      winConditions: [{ type: 'defeat_all' }],
      lossConditions: [{ type: 'all_allies_dead' }],
    };

    return {
      mapData,
      allyGeneralIds: attackerGenerals.map(g => g.id),
      enemyGeneralIds: defenderGenerals.map(g => g.id),
      allyCommanderBuff: BattleMapBuilder.getCommanderBuff(attackerGenerals),
      enemyCommanderBuff: BattleMapBuilder.getCommanderBuff(defenderGenerals),
    };
  },

  /**
   * Create UnitSpawns for a list of generals.
   * Generals are placed vertically centered at the given x column.
   */
  createSpawns(generals: GeneralState[], x: number, mapHeight: number): UnitSpawn[] {
    const spawns: UnitSpawn[] = [];
    const startY = Math.max(0, Math.floor((mapHeight - generals.length) / 2));

    for (let i = 0; i < generals.length; i++) {
      const gen = generals[i]!;
      spawns.push({
        unitDataId: gen.unitDataId,
        x,
        y: startY + i,
      });
    }

    return spawns;
  },

  /**
   * Get the commander buff percentage for a group of generals.
   * Highest leadership general gives min(leadership, 20)% buff.
   */
  getCommanderBuff(generals: GeneralState[]): number {
    if (generals.length === 0) return 0;
    const maxLeadership = Math.max(...generals.map(g => g.leadership));
    return Math.min(maxLeadership, 20);
  },
};
