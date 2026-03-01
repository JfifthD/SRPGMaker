// ─────────────────────────────────────────────
//  World Event Bus — Strategic layer events
//  Separate from tactical EventBus to prevent
//  event collision between layers.
// ─────────────────────────────────────────────

import type { DiplomaticStatus } from './data/types/Diplomacy';
import type { ResourcePool } from './data/types/Faction';

export interface WorldEventMap {
  armyMoved:         { armyId: string; fromNode: string; toNode: string };
  armyCreated:       { armyId: string; factionId: string };
  armyDisbanded:     { armyId: string };
  territoryCapture:  { territoryId: string; oldOwner: string | null; newOwner: string };
  battleStarted:     { battleId: string };
  battleEnded:       { battleId: string; winnerId: string };
  generalHired:      { generalId: string; factionId: string };
  generalDied:       { generalId: string };
  generalInjured:    { generalId: string; turns: number };
  generalDeserted:   { generalId: string };
  diplomacyChanged:  { faction1: string; faction2: string; newStatus: DiplomaticStatus };
  turnAdvanced:      { turn: number; day: number };
  resourceCollected: { factionId: string; resources: ResourcePool };
  gameOver:          { reason: string };
}

type Listener<T> = (payload: T) => void;

class TypedWorldEventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<string, Listener<any>[]> = new Map();

  on<K extends keyof WorldEventMap>(
    event: K,
    listener: Listener<WorldEventMap[K]>,
  ): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
  }

  off<K extends keyof WorldEventMap>(
    event: K,
    listener: Listener<WorldEventMap[K]>,
  ): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    const idx = arr.indexOf(listener);
    if (idx !== -1) arr.splice(idx, 1);
  }

  emit<K extends keyof WorldEventMap>(event: K, payload: WorldEventMap[K]): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    [...arr].forEach(fn => fn(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const WorldEventBus = new TypedWorldEventBus();
