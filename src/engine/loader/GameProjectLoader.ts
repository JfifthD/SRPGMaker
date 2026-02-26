// ─────────────────────────────────────────────
//  GameProjectLoader
//  Loads the active game project at startup via the @game alias.
//  GAME_ID env var selects which project to load (default: chronicle-of-shadows).
//  Call loadGameProject() once in main.ts before launching Phaser.
// ─────────────────────────────────────────────

import type { GameProject, GameManifest } from '@/engine/data/types/GameProject';
import type { UnitData } from '@/engine/data/types/Unit';
import type { SkillData } from '@/engine/data/types/Skill';
import type { TerrainData } from '@/engine/data/types/Terrain';
import type { EquipmentData } from '@/engine/data/types/Equipment';
import type { JobData } from '@/engine/data/types/Job';

// These imports resolve to games/${GAME_ID}/ via the @game Vite/TS alias.
// Switching GAME_ID env var at build time loads a different game's data.
import gameManifestJson from '@game/game.json';
import unitsJson from '@game/data/units.json';
import skillsJson from '@game/data/skills.json';
import terrainsJson from '@game/data/terrains.json';
import equipmentJson from '@game/data/equipment.json';
import jobsJson from '@game/data/jobs.json';

let _skillsMap: Record<string, SkillData> = {};
let _terrainMap: Record<string, TerrainData> = {};
let _equipmentMap: Record<string, EquipmentData> = {};
let _jobsMap: Record<string, JobData> = {};
let _units: UnitData[] = [];
let _manifest: GameManifest | null = null;

/**
 * Loads the game project from the @game alias (resolved at build time via GAME_ID).
 * Must be called once before initialising GameStore or any AI systems.
 */
export function loadGameProject(): GameProject {
  _manifest = gameManifestJson as unknown as GameManifest;
  _units = unitsJson as unknown as UnitData[];
  _skillsMap = skillsJson as unknown as Record<string, SkillData>;
  const terrainList = terrainsJson as unknown as TerrainData[];
  _terrainMap = Object.fromEntries(terrainList.map(t => [t.key, t]));
  _equipmentMap = equipmentJson as unknown as Record<string, EquipmentData>;
  _jobsMap = jobsJson as unknown as Record<string, JobData>;

  return {
    manifest: _manifest,
    units: _units,
    skillsMap: _skillsMap,
    terrainMap: _terrainMap,
    equipmentMap: _equipmentMap,
    jobsMap: _jobsMap,
  };
}

/** Returns the skill map loaded by loadGameProject(). */
export function getSkillsMap(): Record<string, SkillData> {
  return _skillsMap;
}

/** Returns the terrain map loaded by loadGameProject(). */
export function getTerrainMap(): Record<string, TerrainData> {
  return _terrainMap;
}

/**
 * For tests: inject mock context without loading from the @game alias.
 * Call this in vitest beforeEach when testing systems that read game data.
 */
export function setGameContext(
  skillsMap: Record<string, SkillData>,
  terrainMap: Record<string, TerrainData>,
  units: UnitData[] = [],
  equipmentMap: Record<string, EquipmentData> = {},
  jobsMap: Record<string, JobData> = {},
): void {
  _skillsMap = skillsMap;
  _terrainMap = terrainMap;
  _units = units;
  _equipmentMap = equipmentMap;
  _jobsMap = jobsMap;
}
