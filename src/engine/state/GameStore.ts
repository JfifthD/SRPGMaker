// ─────────────────────────────────────────────
//  Game Store — single source of truth
//  Holds BattleState and provides a dispatch API.
// ─────────────────────────────────────────────

import type { BattleState, UnitMap } from './BattleState';
import type { GameAction } from './actions/MoveAction';
import type { MapData } from '@/engine/data/types/Map';
import type { UnitData, UnitInstance } from '@/engine/data/types/Unit';
import { createUnit } from '@/engine/data/types/Unit';
import type { GameProject } from '@/engine/data/types/GameProject';
import type { Draft } from 'immer';
import { produce } from 'immer';
import { TurnManager } from '@/engine/systems/turn/TurnManager';
import { BuffSystem } from '@/engine/systems/skill/BuffSystem';
import { EventBus } from '@/engine/utils/EventBus';
import { StateQuery } from './BattleState';
import { Logger } from '@/engine/utils/Logger';
import { StageConditionSystem } from '@/engine/systems/stage/StageConditionSystem';
import { SaveManager } from '@/engine/systems/save/SaveManager';

type StoreListener = (state: BattleState) => void;

export class GameStore {
  private state!: BattleState;
  private listeners: StoreListener[] = [];
  readonly turnManager = new TurnManager();

  /** Initialise store from a MapData definition and a loaded GameProject */
  init(mapData: MapData, gameProject: GameProject): void {
    const dataById = Object.fromEntries(gameProject.units.map(u => [u.id, u]));

    const units: UnitMap = {};

    for (const spawn of mapData.allySpawns) {
      const data = dataById[spawn.unitDataId];
      if (!data) continue;
      const unit = createUnit(data, spawn.x, spawn.y);
      units[unit.instanceId] = unit;
    }

    let enemyIdx = 0;
    for (const spawn of mapData.enemySpawns) {
      const data = dataById[spawn.unitDataId];
      if (!data) continue;
      const unit = createUnit(data, spawn.x, spawn.y);
      // Give enemies unique instance IDs
      unit.instanceId = `${unit.dataId}_${enemyIdx++}`;
      units[unit.instanceId] = unit;
    }

    this.state = {
      gameProject,
      mapData,
      units,
      turn: 1,
      phase: 'PLAYER_IDLE',
      selectedUnitId: null,
      activeUnitId: null,
      inputMode: 'idle',
      activeSkillId: null,
      busy: false,
      actionLog: [],
      stateHistory: [],
    };

    this.turnManager.reset();
    this._gameId = gameProject.manifest.id;
    Logger.log('⚔ Chronicle of Shadows', 'system');
    Logger.log('Turn 1 — Player Phase', 'system');
  }

  getState(): BattleState { return this.state; }

  /**
   * Restore a previously saved BattleState snapshot.
   * Requires the GameProject to reconstruct the full state.
   */
  restore(snapshot: Parameters<typeof SaveManager.restoreState>[0], gameProject: GameProject): void {
    this.state = SaveManager.restoreState(snapshot, gameProject);
    this.turnManager.reset();
    // Sync TurnManager to the restored phase
    if (this.state.phase === 'PLAYER_IDLE' || this.state.phase === 'VICTORY' || this.state.phase === 'DEFEAT') {
      this.turnManager.transition(this.state.phase);
    } else if (this.state.phase === 'ENEMY_PHASE') {
      this.turnManager.transition('ENEMY_PHASE');
    }
    Logger.log(`🔄 Save restored — Turn ${this.state.turn}`, 'system');
    this.notify();
  }

  /** Auto-save game ID for persistence (set during init) */
  private _gameId: string = 'unknown';

  /** Dispatch a Command action and notify listeners */
  dispatch(action: GameAction): void {
    const nextState = action.execute(this.state);
    
    // If the state changed, push the old state to history (limit to 50 for memory)
    if (nextState !== this.state) {
        this.state = produce(nextState, (draft: Draft<BattleState>) => {
            draft.stateHistory.push(this.state);
            if (draft.stateHistory.length > 50) {
                draft.stateHistory.shift();
            }
        });
    }

    this.notify();
    this.checkWin();
    this.scheduleAutoSave();
  }

  /** Advance time until the next unit's turn (CT >= 100) */
  nextTurn(): void {
    if (this.state.phase === 'VICTORY' || this.state.phase === 'DEFEAT') return;
    this.state = produce(this.state, (draft: Draft<BattleState>) => {
      // Find unit with CT >= 100
      let readyUnitId = this.findReadyUnit(draft.units);

      // If no unit is ready, tick everyone
      while (!readyUnitId) {
        for (const id in draft.units) {
          const u = draft.units[id]!;
          if (u.hp <= 0) continue;
          u.ct += u.spd;
        }
        readyUnitId = this.findReadyUnit(draft.units);
      }

      const activeUnit = draft.units[readyUnitId]!;
      draft.activeUnitId = readyUnitId;
      draft.selectedUnitId = readyUnitId; // Auto-select

      // Reset turn state
      activeUnit.moved = false;
      activeUnit.acted = false;
      activeUnit.ct -= 100;

      // AP Refresh: Full AP restoration at the start of the turn (No carryover)
      activeUnit.currentAP = activeUnit.maxAP;

      // Tick buffs for this unit only now
      draft.units[readyUnitId] = BuffSystem.tick(activeUnit);

      if (activeUnit.team === 'ally') {
        draft.phase = 'PLAYER_IDLE';
        draft.inputMode = 'idle';
      } else {
        draft.phase = 'ENEMY_PHASE';
        draft.inputMode = 'idle';
      }
      draft.turn += 1;
    });

    const activeTeam = this.state.units[this.state.activeUnitId!]?.team || 'ally';
    
    // Sync external TurnManager FSM
    if (activeTeam === 'ally') {
        this.turnManager.transition('PLAYER_IDLE');
    } else {
        this.turnManager.transition('ENEMY_PHASE');
    }

    EventBus.emit('turnStarted', { turn: this.state.turn, phase: activeTeam === 'ally' ? 'player' : 'enemy', activeUnitId: this.state.activeUnitId });
    Logger.log(`─── Action ${this.state.turn} — ${this.state.units[this.state.activeUnitId!]?.name}'s Turn ───`, 'system');
    
    this.notify();
  }

  private findReadyUnit(units: Record<string, UnitInstance>): string | null {
    let maxCt = -1;
    let readyId: string | null = null;
    for (const id in units) {
      const u = units[id]!;
      if (u.hp > 0 && u.ct >= 100) {
        if (u.ct > maxCt) {
          maxCt = u.ct;
          readyId = id;
        }
      }
    }
    return readyId;
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  /**
   * Undoes ALL moves for the given unit back to the start of their turn.
   * Does NOT go through dispatch() — bypasses history re-insertion entirely,
   * preventing the bounce bug where each undo pushes the pre-undo state back.
   */
  undoUnitMoves(unitId: string): void {
    const history = this.state.stateHistory;

    // Walk backwards to find the most recent snapshot where this unit had NOT yet moved
    let targetIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      const u = history[i]!.units[unitId];
      if (u && !u.moved) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx === -1) return; // No pre-move state in history — nothing to undo

    const targetState = history[targetIdx]!;
    // Restore to that snapshot; discard all intermediate history entries
    this.state = {
      ...targetState,
      stateHistory: history.slice(0, targetIdx),
    };

    this.notify();
  }

  /** Clear the selection manually. */
  clearSelection(): void {
    this.state = produce(this.state, draft => {
      draft.inputMode = 'idle';
      draft.selectedUnitId = null;
      draft.activeSkillId = null;
    });
    this.notify();
  }

  /** Select a specific unit natively. */
  setSelectedUnit(unitId: string): void {
    this.state = produce(this.state, draft => {
      draft.selectedUnitId = unitId;
      const unit = draft.units[unitId];
      if (unit && unit.team === 'ally' && unit.currentAP > 0 && unit.instanceId === draft.activeUnitId) {
        draft.inputMode = 'move';
      } else {
        draft.inputMode = 'idle';
      }
    });
    EventBus.emit('unitSelected', { unit: this.state.units[unitId] ?? null });
    this.notify();
  }

  /** Run a direct manual mutation against state inside an action queue format */
  dispatchAsync(action: GameAction | null, recipe?: (draft: Draft<BattleState>) => void): void {
     if (action) {
         this.dispatch(action);
         return;
     }
     
     if (recipe) {
         this.state = produce(this.state, recipe);
         this.notify();
     }
  }

  /** Get a compatible BFSContext representing the current grid snapshot. */
  getBFSContext() {
    const terrainMap = this.state.gameProject.terrainMap;
    const defaultTerrain = terrainMap['plain'];
    return {
      width: this.state.mapData.width,
      height: this.state.mapData.height,
      getTerrain: (x: number, y: number) => {
         const key = this.state.mapData.terrain[y]?.[x] ?? 'plain';
         return terrainMap[key] ?? defaultTerrain ?? { moveCost: 1, passable: true } as any;
      },
      getUnit: (x: number, y: number) => StateQuery.at(this.state, x, y),
    };
  }

  /**
   * Schedule a non-blocking auto-save after a state change.
   * Uses requestIdleCallback where available, setTimeout(0) as fallback.
   */
  private scheduleAutoSave(): void {
    // Don't save terminal states or during animation
    if (this.state.phase === 'VICTORY' || this.state.phase === 'DEFEAT') return;
    const doSave = () => {
      SaveManager.save('autosave', this.state, this._gameId);
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(doSave);
    } else {
      setTimeout(doSave, 0);
    }
  }

  private checkWin(): void {
    const result = StageConditionSystem.evaluate(this.state);

    if (result === 'VICTORY') {
      this.state = produce(this.state, draft => { draft.phase = 'VICTORY'; });
      this.turnManager.transition('VICTORY');
      EventBus.emit('victory', { turn: this.state.turn });
      Logger.log(`✨ VICTORY — Turn ${this.state.turn}`, 'critical');
      this.notify();
    } else if (result === 'DEFEAT') {
      this.state = produce(this.state, draft => { draft.phase = 'DEFEAT'; });
      this.turnManager.transition('DEFEAT');
      EventBus.emit('defeat', { turn: this.state.turn });
      Logger.log('💀 DEFEAT', 'critical');
      this.notify();
    }
  }
}

/** Module-level singleton — import across scenes */
export const store = new GameStore();
