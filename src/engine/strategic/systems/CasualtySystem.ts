// ─────────────────────────────────────────────
//  Casualty System — Post-battle outcome resolution
//  Converts tactical HP results → strategic troop losses, death/injury.
//  Pure functions. Zero Phaser imports.
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldState } from '../state/WorldState';
import type { WorldMapData } from '../data/types/World';
import type { GeneralState } from '../data/types/General';
import type {
  BattleResult,
  CasualtyReport,
  GeneralCasualtyDetail,
  GeneralBattleResult,
} from '../data/types/BattleResult';
import { WorldEventBus } from '../WorldEventBus';
import { findNearestFriendly, transferTerritory } from './TerritorySystem';
import { disbandArmy } from './ArmySystem';

const DEATH_CHANCE_WINNER = 0.03;
const DEATH_CHANCE_LOSER = 0.08;
const INJURY_CHANCE_WINNER = 0.15;
const INJURY_CHANCE_LOSER = 0.35;
const SEVERE_INJURY_MIN = 7;
const SEVERE_INJURY_MAX = 10;

export const CasualtySystem = {
  /**
   * Calculate troop losses from battle results.
   * Formula: troopsLost = leadership * 1000 * (1 - finalHp/maxHp)
   */
  calculateCasualties(
    generalResults: GeneralBattleResult[],
    generals: Record<string, GeneralState>,
  ): CasualtyReport {
    let totalTroopsLost = 0;
    const generalReports: GeneralCasualtyDetail[] = [];

    for (const gr of generalResults) {
      const gen = generals[gr.generalId];
      if (!gen) continue;

      const maxTroops = gen.leadership * 1000;
      const hpPercent = gr.maxHp > 0 ? gr.finalHp / gr.maxHp : 0;
      const troopsLost = Math.floor(maxTroops * (1 - hpPercent));

      totalTroopsLost += troopsLost;
      const detail: GeneralCasualtyDetail = {
        generalId: gr.generalId,
        troopsLost,
        hpPercent,
        wasDefeated: gr.wasDefeated,
        died: false,
      };
      generalReports.push(detail);
    }

    return { totalTroopsLost, generalReports };
  },

  /**
   * Roll for death and injury for each general post-battle.
   * Mutates the generalReports in-place and returns the updated array.
   */
  rollDeathAndInjury(
    reports: GeneralCasualtyDetail[],
    isWinningSide: boolean,
    excludeIds: string[] = [],
    rng: () => number = Math.random,
  ): GeneralCasualtyDetail[] {
    const deathChance = isWinningSide ? DEATH_CHANCE_WINNER : DEATH_CHANCE_LOSER;
    const injuryChance = isWinningSide ? INJURY_CHANCE_WINNER : INJURY_CHANCE_LOSER;

    for (const report of reports) {
      if (report.wasDefeated) {
        // HP reached 0 — roll for death
        if (!excludeIds.includes(report.generalId) && rng() < deathChance) {
          report.died = true;
        } else {
          // Survived — severe injury (7-10 turns)
          const turns = SEVERE_INJURY_MIN + Math.floor(rng() * (SEVERE_INJURY_MAX - SEVERE_INJURY_MIN + 1));
          report.injury = { turns };
        }
      } else if (report.hpPercent < 0.5) {
        // Damaged but not defeated — chance of injury
        if (rng() < injuryChance) {
          const turns = Math.max(1, Math.ceil((1 - report.hpPercent) * 10));
          report.injury = { turns };
        }
      }
      // Healthy generals (>=50% HP) get no consequences
    }

    return reports;
  },

  /**
   * Apply a full BattleResult to WorldState.
   * Handles: troop updates, death removal, injury assignment, territory transfer, retreat.
   */
  applyBattleResult(
    state: WorldState,
    battle: { type: 'siege' | 'field'; territoryId: string | null; attacker: { factionId: string; armyId: string }; defender: { factionId: string; armyId: string } },
    result: BattleResult,
    worldMap: WorldMapData,
  ): WorldState {
    let s = state;

    // Apply attacker casualties
    s = applyFactionCasualties(s, result.attackerCasualties, battle.attacker.armyId);
    // Apply defender casualties
    s = applyFactionCasualties(s, result.defenderCasualties, battle.defender.armyId);

    // Territory capture: attacker wins siege
    if (result.territoryCaptured && battle.territoryId && battle.type === 'siege') {
      s = transferTerritory(s, battle.territoryId, result.winnerId);
      WorldEventBus.emit('territoryCapture', {
        territoryId: battle.territoryId,
        oldOwner: battle.defender.factionId,
        newOwner: result.winnerId,
      });
    }

    // Retreat losing army to nearest friendly
    const loserArmyId = result.winnerId === battle.attacker.factionId
      ? battle.defender.armyId
      : battle.attacker.armyId;
    const loserArmy = s.armies[loserArmyId];
    if (loserArmy && loserArmy.generals.length > 0) {
      const retreatNode = findNearestFriendly(worldMap, s, loserArmy.locationNodeId, loserArmy.factionId);
      if (retreatNode) {
        s = produce(s, draft => {
          const army = draft.armies[loserArmyId];
          if (army) {
            army.locationNodeId = retreatNode;
            army.status = 'idle';
            delete army.movementPath;
            delete army.targetNodeId;
            delete army.movementProgress;
          }
        });
      } else {
        // No friendly territory — disband, generals become wandering
        s = disbandArmy(s, loserArmyId);
        s = produce(s, draft => {
          for (const gId of loserArmy.generals) {
            if (draft.generals[gId]) {
              draft.generals[gId]!.faction = null;
              draft.generals[gId]!.status = 'idle';
              draft.generals[gId]!.location = '';
              draft.availableGenerals.push(draft.generals[gId]!);
            }
          }
        });
      }
    }

    // Reset winner army status
    const winnerArmyId = result.winnerId === battle.attacker.factionId
      ? battle.attacker.armyId
      : battle.defender.armyId;
    s = produce(s, draft => {
      const army = draft.armies[winnerArmyId];
      if (army) {
        army.status = 'idle';
        delete army.movementPath;
        delete army.targetNodeId;
        delete army.movementProgress;
      }
    });

    return s;
  },
};

// --- Internal helpers ---

function applyFactionCasualties(
  state: WorldState,
  report: CasualtyReport,
  armyId: string,
): WorldState {
  let s = state;

  for (const detail of report.generalReports) {
    if (detail.died) {
      // Remove dead general
      s = produce(s, draft => {
        const gen = draft.generals[detail.generalId];
        if (!gen) return;

        // Remove from army
        const army = draft.armies[armyId];
        if (army) {
          const idx = army.generals.indexOf(detail.generalId);
          if (idx !== -1) army.generals.splice(idx, 1);
        }

        // Remove from faction
        if (gen.faction) {
          const faction = draft.factions[gen.faction];
          if (faction) {
            const idx = faction.generals.indexOf(detail.generalId);
            if (idx !== -1) faction.generals.splice(idx, 1);
          }
        }

        delete draft.generals[detail.generalId];
      });

      WorldEventBus.emit('generalDied', { generalId: detail.generalId });
    } else {
      // Apply troop loss + injury
      s = produce(s, draft => {
        const gen = draft.generals[detail.generalId];
        if (!gen) return;

        gen.currentTroops = Math.max(0, gen.currentTroops - detail.troopsLost);

        if (detail.injury) {
          gen.status = 'injured';
          gen.injuryTurns = detail.injury.turns;
          WorldEventBus.emit('generalInjured', {
            generalId: detail.generalId,
            turns: detail.injury.turns,
          });
        }
      });
    }
  }

  // Auto-disband army if no generals remain
  const army = s.armies[armyId];
  if (army && army.generals.length === 0) {
    s = disbandArmy(s, armyId);
  }

  return s;
}
