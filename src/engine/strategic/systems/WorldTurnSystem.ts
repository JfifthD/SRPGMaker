// ─────────────────────────────────────────────
//  World Turn System — Phase transitions + turn cycle orchestration
//  Uses WorldStore.apply() for phase changes.
//  Zero Phaser imports.
// ─────────────────────────────────────────────

import { produce } from 'immer';
import type { WorldMapData } from '../data/types/World';
import type { WorldState, WorldPhase, BattleContext } from '../state/WorldState';
import type { WorldStore } from '../state/WorldStore';
import { advanceArmyMovement, detectCollisions } from './ArmySystem';
import { FactionSystem } from './FactionSystem';
import { WorldEventBus } from '../WorldEventBus';

/** Valid phase transitions. */
const TRANSITIONS: Record<WorldPhase, WorldPhase[]> = {
  player_actions: ['ai_actions'],
  ai_actions: ['resolution'],
  resolution: ['battle_selection', 'advance'],
  battle_selection: ['battle_active'],
  battle_active: ['results', 'battle_selection'],
  results: ['advance'],
  advance: ['player_actions'],
};

export const WorldTurnSystem = {
  /**
   * Transition to a new phase. Returns false if invalid.
   */
  transition(store: WorldStore, nextPhase: WorldPhase): boolean {
    const current = store.getState().phase;
    const allowed = TRANSITIONS[current];
    if (!allowed?.includes(nextPhase)) {
      console.error(`[WorldTurnSystem] Invalid transition: ${current} → ${nextPhase}`);
      return false;
    }
    store.apply(draft => { draft.phase = nextPhase; });
    return true;
  },

  /**
   * Execute resolution phase: advance all moving armies, detect collisions.
   * Sets pendingBattles on state if collisions found.
   * Returns the detected battles.
   */
  executeResolution(store: WorldStore, worldMap: WorldMapData): BattleContext[] {
    // Advance all moving armies by one edge
    let state = store.getState();
    const movingArmyIds = Object.values(state.armies)
      .filter(a => a.status === 'moving')
      .map(a => a.id);

    for (const armyId of movingArmyIds) {
      const newState = advanceArmyMovement(store.getState(), armyId);
      if (newState !== store.getState()) {
        store.apply(draft => {
          const army = newState.armies[armyId];
          if (army) {
            draft.armies[armyId] = army as any;
          }
        });
      }
    }

    // Detect collisions
    state = store.getState();
    const battles = detectCollisions(state, worldMap);

    if (battles.length > 0) {
      // Mark colliding armies as in_battle
      store.apply(draft => {
        draft.pendingBattles = battles as any;
        for (const b of battles) {
          if (draft.armies[b.attacker.armyId]) {
            draft.armies[b.attacker.armyId]!.status = 'in_battle';
          }
          if (draft.armies[b.defender.armyId]) {
            draft.armies[b.defender.armyId]!.status = 'in_battle';
          }
        }
      });
    }

    return battles;
  },

  /**
   * Advance the world turn. Increments counter, ticks injuries, checks game over.
   */
  advanceTurn(store: WorldStore): { gameOver: boolean; reason?: string } {
    // Increment turn
    store.apply(draft => {
      draft.turn += 1;
      draft.day = draft.turn * 30;
      draft.pendingBattles = [];
    });

    // Tick injuries
    const tickedState = WorldTurnSystem.tickInjuries(store.getState());
    if (tickedState !== store.getState()) {
      store.apply(draft => {
        for (const [gId, gen] of Object.entries(tickedState.generals)) {
          if (draft.generals[gId]) {
            draft.generals[gId]!.injuryTurns = gen.injuryTurns;
            draft.generals[gId]!.status = gen.status;
          }
        }
      });
    }

    // Check faction elimination
    const elimState = FactionSystem.checkFactionElimination(store.getState());
    if (elimState !== store.getState()) {
      store.apply(draft => {
        for (const [fId, faction] of Object.entries(elimState.factions)) {
          draft.factions[fId] = faction as any;
        }
        draft.generals = elimState.generals as any;
        draft.armies = elimState.armies as any;
        draft.availableGenerals = elimState.availableGenerals as any;
      });
    }

    // Check game over
    const result = FactionSystem.isGameOver(store.getState());

    // Emit turn event
    const state = store.getState();
    WorldEventBus.emit('turnAdvanced', { turn: state.turn, day: state.day });

    // Transition back to player_actions
    store.apply(draft => { draft.phase = 'player_actions'; });

    const ret: { gameOver: boolean; reason?: string } = { gameOver: result.gameOver };
    if (result.reason) ret.reason = result.reason;
    return ret;
  },

  /**
   * Tick down injury counters for all generals. Returns new state if changed.
   */
  tickInjuries(state: WorldState): WorldState {
    let changed = false;
    for (const gen of Object.values(state.generals)) {
      if (gen.injuryTurns > 0) {
        changed = true;
        break;
      }
    }
    if (!changed) return state;

    return produce(state, draft => {
      for (const gen of Object.values(draft.generals)) {
        if (gen.injuryTurns > 0) {
          gen.injuryTurns -= 1;
          if (gen.injuryTurns === 0 && gen.status === 'injured') {
            gen.status = 'idle';
          }
        }
      }
    });
  },
};
