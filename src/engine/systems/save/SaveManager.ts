// ─────────────────────────────────────────────
//  SaveManager — IndexedDB persistence for BattleState
//  Pure TypeScript — no Phaser dependency.
// ─────────────────────────────────────────────

import type { BattleState, UnitMap, InputMode } from '@/engine/state/BattleState';
import type { MapData } from '@/engine/data/types/Map';
import type { GameProject } from '@/engine/data/types/GameProject';
import type { BattlePhase } from '@/engine/systems/turn/TurnManager';
import type { UnitInstance } from '@/engine/data/types/Unit';

// ── Save Slot Types ──

/**
 * Serializable snapshot of BattleState.
 * Excludes `gameProject` (static, loaded separately) and `stateHistory` (too large).
 */
export interface BattleStateSnapshot {
  mapData: MapData;
  units: UnitMap;
  turn: number;
  phase: BattlePhase;
  selectedUnitId: string | null;
  activeUnitId: string | null;
  inputMode: InputMode;
  activeSkillId: string | null;
  busy: boolean;
  actionLog: string[];
}

export interface SaveSlot {
  id: string;            // 'autosave' or 'manual_1', etc.
  timestamp: number;
  gameId: string;        // From GameProject manifest — ensures cross-game safety
  mapId: string;         // For UI display and correct map loading
  turnNumber: number;
  snapshot: BattleStateSnapshot;
}

// ── IndexedDB Helpers ──

const DB_NAME = 'srpgmaker_saves';
const DB_VERSION = 1;
const STORE_NAME = 'save_slots';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Public API ──

/**
 * Create a serializable snapshot from a live BattleState.
 * Strips `gameProject` and `stateHistory` to keep the payload small.
 */
export function createSnapshot(state: BattleState): BattleStateSnapshot {
  return {
    mapData: state.mapData,
    units: state.units,
    turn: state.turn,
    phase: state.phase,
    selectedUnitId: state.selectedUnitId,
    activeUnitId: state.activeUnitId,
    inputMode: state.inputMode,
    activeSkillId: state.activeSkillId,
    busy: false,        // Never restore into a "busy" (animating) state
    actionLog: state.actionLog,
  };
}

/**
 * Reconstruct a full BattleState from a snapshot + the loaded GameProject.
 */
export function restoreState(
  snapshot: BattleStateSnapshot,
  gameProject: GameProject,
): BattleState {
  return {
    gameProject,
    mapData: snapshot.mapData,
    units: snapshot.units,
    turn: snapshot.turn,
    phase: snapshot.phase,
    selectedUnitId: snapshot.selectedUnitId,
    activeUnitId: snapshot.activeUnitId,
    inputMode: snapshot.inputMode,
    activeSkillId: snapshot.activeSkillId,
    busy: false,
    actionLog: snapshot.actionLog,
    stateHistory: [],    // History is not persisted — starts fresh after load
  };
}

/**
 * Save a BattleState to IndexedDB.
 * Non-blocking — errors are silently logged (save failures should never block gameplay).
 */
export async function save(
  slotId: string,
  state: BattleState,
  gameId: string,
): Promise<void> {
  try {
    const slot: SaveSlot = {
      id: slotId,
      timestamp: Date.now(),
      gameId,
      mapId: state.mapData.id,
      turnNumber: state.turn,
      snapshot: createSnapshot(state),
    };
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(slot);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[SaveManager] Auto-save failed:', err);
  }
}

/**
 * Load a save slot from IndexedDB. Returns null if not found.
 */
export async function load(slotId: string): Promise<SaveSlot | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(slotId);
    const result = await new Promise<SaveSlot | null>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (err) {
    console.warn('[SaveManager] Load failed:', err);
    return null;
  }
}

/**
 * Check if a save slot exists (without loading the full data).
 */
export async function hasSave(slotId: string): Promise<boolean> {
  const slot = await load(slotId);
  return slot !== null;
}

/**
 * Delete a save slot.
 */
export async function deleteSave(slotId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(slotId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[SaveManager] Delete failed:', err);
  }
}

/** Convenience namespace export */
export const SaveManager = {
  save,
  load,
  hasSave,
  deleteSave,
  createSnapshot,
  restoreState,
};
