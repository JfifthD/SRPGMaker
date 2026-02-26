// ─────────────────────────────────────────────
//  GameProject Types
//  Defines the game.json manifest and the runtime
//  GameProject object used throughout the engine.
// ─────────────────────────────────────────────

import type { UnitData } from './Unit';
import type { SkillData } from './Skill';
import type { TerrainData } from './Terrain';
import type { EquipmentData } from './Equipment';
import type { JobData } from './Job';

/** Represents the game.json manifest file at the root of every game project */
export interface GameManifest {
  id: string;              // "chronicle-of-shadows"
  name: string;            // "The Chronicle of Shadows"
  version: string;         // "0.1.0"
  engineVersion: string;   // ">=0.1.0" (semver constraint)
  entryMap: string;        // "stage_01" (first map to load)
  data: {
    units: string;         // "data/units.json"
    skills: string;        // "data/skills.json"
    terrains: string;      // "data/terrains.json"
    mapsDir: string;       // "data/maps/"
  };
  assets?: {
    imagesDir?: string;    // "assets/images/"
    audioDir?: string;     // "assets/audio/"
  };
  meta?: {
    author?: string;
    description?: string;
    thumbnail?: string;
  };
}

/** Fully loaded game project with all data resolved */
export interface GameProject {
  manifest: GameManifest;
  units: UnitData[];
  skillsMap: Record<string, SkillData>;
  terrainMap: Record<string, TerrainData>;
  equipmentMap: Record<string, EquipmentData>;
  jobsMap: Record<string, JobData>;
}
