// ─────────────────────────────────────────────
//  Army State — Spec 21 §5
//  Constraint: generals.length === 0 → auto-disband
//  Constraint: 1 general belongs to exactly 1 army
// ─────────────────────────────────────────────

export type ArmyStatus = 'idle' | 'moving' | 'in_battle' | 'retreating';

export interface ArmyState {
  id: string;
  factionId: string;
  generals: string[];             // General ids (unique per army)
  locationNodeId: string;         // Current graph node
  status: ArmyStatus;
  movementPath?: string[];        // Remaining path node ids
  movementProgress?: number;      // Days progressed on current edge
  targetNodeId?: string;          // Final destination
}
