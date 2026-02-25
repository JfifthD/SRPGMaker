// ─────────────────────────────────────────────
//  Typed Event Bus
//  All game systems communicate through events.
//  No direct cross-system calls.
// ─────────────────────────────────────────────

import type { UnitInstance } from '@/engine/data/types/Unit';
import type { BattlePhase } from '@/engine/systems/turn/TurnManager';
import type { CombatPreview } from '@/engine/systems/combat/DamageCalc';

import type { Pos } from '@/engine/data/types/Map';

/** Centralised map of all game events and their payload types */
export interface GameEventMap {
  // Unit lifecycle
  unitMoved:     { unit: UnitInstance; fromX: number; fromY: number; toX: number; toY: number; path?: Pos[] };
  unitMoveUndo:  { unit: UnitInstance; fromX: number; fromY: number; toX: number; toY: number };
  unitDamaged:   { unit: UnitInstance; dmg: number; crit: boolean; affMult: number };
  unitHealed:    { unit: UnitInstance; amount: number };
  unitBuffed:    { unit: UnitInstance; stat: string; val: number; dur: number };
  unitDebuffed:  { unit: UnitInstance; stat: string; val: number; dur: number };
  unitDefeated:  { unit: UnitInstance };
  unitSelected:  { unit: UnitInstance | null };

  // Combat UI
  combatPreview: { preview: CombatPreview | null; target?: UnitInstance };
  actionMenuUpdate: { actions: import('@/engine/coordinator/BattleCoordinator').ActionPayload[] };
  openRingMenu:  { unit: UnitInstance; tx: number; ty: number };
  closeRingMenu: Record<string, never>;
  ringMenuHover: { action: import('@/engine/coordinator/BattleCoordinator').ActionPayload };
  ringMenuHoverEnd: Record<string, never>;

  // Skill
  skillCast:     { caster: UnitInstance; skillId: string; tx: number; ty: number };

  // Phase / turn
  phaseChanged:  { phase: BattlePhase };
  turnStarted:   { turn: number; phase: 'player' | 'enemy'; activeUnitId: string | null };
  turnEnded:     { turn: number; phase: 'player' | 'enemy' };

  // Game outcome
  victory:       { turn: number };
  defeat:        { turn: number };

  // Animation sync
  animStart:     { id: string };
  animComplete:  { id: string };

  // UI
  logMessage:    { text: string; cls: string };
  cancelAction:  Record<string, never>;

  // Terrain
  terrainChanged:    { x: number; y: number; from: string; to: string };

  // Danger Zone
  dangerZoneToggled: { visible: boolean };
}

type Listener<T> = (payload: T) => void;

class TypedEventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<string, Listener<any>[]> = new Map();

  on<K extends keyof GameEventMap>(
    event: K,
    listener: Listener<GameEventMap[K]>,
    // Optional context for removal
    _context?: object,
  ): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
  }

  off<K extends keyof GameEventMap>(
    event: K,
    listener: Listener<GameEventMap[K]>,
  ): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    const idx = arr.indexOf(listener);
    if (idx !== -1) arr.splice(idx, 1);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    // Iterate a copy so listeners can safely remove themselves
    [...arr].forEach(fn => fn(payload));
  }

  /** Remove all listeners (useful for scene teardown) */
  clear(): void {
    this.listeners.clear();
  }
}

/** Singleton event bus — import this directly in any system */
export const EventBus = new TypedEventBus();
