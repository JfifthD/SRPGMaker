// ─────────────────────────────────────────────
//  Affinity (elemental) multiplier table
// ─────────────────────────────────────────────

import type { AffinityType } from '@/engine/data/types/Unit';

type AffinityMatrix = Record<AffinityType, Record<AffinityType, number>>;

const TABLE: AffinityMatrix = {
  //           phys   magic  holy   dark   nature
  phys:   { phys: 1.0, magic: 1.4,  holy: 0.75, dark: 1.0,  nature: 1.0  },
  magic:  { phys: 0.75,magic: 1.0,  holy: 1.4,  dark: 1.2,  nature: 0.9  },
  holy:   { phys: 1.4, magic: 0.7,  holy: 1.0,  dark: 2.0,  nature: 1.2  },
  dark:   { phys: 1.0, magic: 1.4,  holy: 0.5,  dark: 1.0,  nature: 1.3  },
  nature: { phys: 1.0, magic: 0.9,  holy: 1.1,  dark: 1.2,  nature: 1.0  },
};

export const AffinityTable = {
  /**
   * Returns the damage multiplier when an attack of `atkAffinity`
   * hits a unit with `defAffinity`.
   */
  get(atkAffinity: AffinityType, defAffinity: AffinityType): number {
    return TABLE[atkAffinity]?.[defAffinity] ?? 1.0;
  },
};
