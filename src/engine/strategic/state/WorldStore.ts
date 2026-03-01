// ─────────────────────────────────────────────
//  World Store — Strategic layer state management
//  Mirrors GameStore pattern: immer produce + dispatch + history
// ─────────────────────────────────────────────

import type { WorldState } from './WorldState';
import type { WorldAction } from './WorldAction';
import type { WorldMapData } from '../data/types/World';
import type { FactionData, ResourcePool } from '../data/types/Faction';
import type { GeneralData } from '../data/types/General';
import type { DiplomacyState } from '../data/types/Diplomacy';
import type { Draft } from 'immer';
import { produce } from 'immer';
import { FactionSystem } from '../systems/FactionSystem';

type StoreListener = (state: WorldState) => void;

const MAX_HISTORY = 100;

export class WorldStore {
  private state!: WorldState;
  private listeners: StoreListener[] = [];

  init(
    worldMap: WorldMapData,
    factions: FactionData[],
    generals: GeneralData[],
    diplomacy: DiplomacyState,
    playerFactionId: string,
    protagonistId: string,
  ): void {
    this.state = FactionSystem.initWorldState(
      worldMap, factions, generals, diplomacy, playerFactionId, protagonistId,
    );
  }

  getState(): WorldState {
    return this.state;
  }

  dispatch(action: WorldAction): void {
    if (!action.validate(this.state)) return;

    const nextState = action.execute(this.state);

    if (nextState !== this.state) {
      this.state = produce(nextState, (draft: Draft<WorldState>) => {
        draft.stateHistory.push(this.state);
        if (draft.stateHistory.length > MAX_HISTORY) {
          draft.stateHistory.shift();
        }
      });
    }

    this.notify();
  }

  /** Direct state mutation for system-level operations (phase transitions, etc.) */
  apply(recipe: (draft: Draft<WorldState>) => void): void {
    this.state = produce(this.state, recipe);
    this.notify();
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
}
