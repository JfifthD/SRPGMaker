// ─────────────────────────────────────────────
//  TurnOrderPredictor
//  Simulates CT ticks from current state to predict
//  the next N units to act, in order.
// ─────────────────────────────────────────────

import type { UnitInstance } from '@/engine/data/types/Unit';

export interface TurnOrderEntry {
  unit: UnitInstance;
  /** 0 = first to act next, 1 = second, ... */
  index: number;
}

/**
 * Predicts the next `count` acting units by simulating CT tick accumulation.
 *
 * Starts from each unit's CURRENT ct value.
 * The active unit has already had ct -= 100 applied by GameStore.nextTurn(),
 * so this correctly produces the future order after the current turn.
 *
 * @param units - All live units (hp > 0) to include in the simulation
 * @param count - How many upcoming turns to predict
 */
export function predictTurnOrder(units: UnitInstance[], count: number = 7): TurnOrderEntry[] {
  const live = units.filter(u => u.hp > 0 && u.spd > 0);
  if (live.length === 0) return [];

  // Work with a lightweight copy — only track id, ct, spd
  const sim = live.map(u => ({ id: u.instanceId, ct: u.ct, spd: u.spd }));
  const result: string[] = [];

  let guard = 0;
  while (result.length < count && guard < 20000) {
    guard++;

    // Find the unit with highest CT >= 100
    let maxCt = -1;
    let readyId: string | null = null;
    for (const u of sim) {
      if (u.ct >= 100 && u.ct > maxCt) {
        maxCt = u.ct;
        readyId = u.id;
      }
    }

    if (readyId) {
      result.push(readyId);
      const winner = sim.find(u => u.id === readyId)!;
      winner.ct -= 100;
    } else {
      // Tick all units by their SPD
      for (const u of sim) {
        u.ct += u.spd;
      }
    }
  }

  return result.map((id, i) => ({
    unit: units.find(u => u.instanceId === id)!,
    index: i,
  }));
}
