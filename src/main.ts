// ─────────────────────────────────────────────
//  Entry point — SRPGMaker
//
//  MODE=editor  → launch EditorScene + embedded game preview
//  MODE=game    → launch standalone game (no editor code; default)
//
//  GAME_ID env var selects which game project to load.
//  See docs/game_project_format.md for game project spec.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import { PhaserConfig } from './config';
import { BootScene }     from './scenes/BootScene';
import { TitleScene }    from './scenes/TitleScene';
import { BattleScene }  from './scenes/BattleScene';
import { UIScene }       from './scenes/UIScene';
import { ResultScene }  from './scenes/ResultScene';
import { DialogueScene } from './scenes/DialogueScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { WorldMapScene } from './scenes/WorldMapScene';

const isEditorMode = import.meta.env['MODE'] === 'editor';

let scenes: (typeof Phaser.Scene)[];

if (isEditorMode) {
  // Dynamically import editor scene only in editor mode — excluded from game builds
  const { EditorScene } = await import('./editor/scenes/EditorScene');
  scenes = [BootScene, EditorScene, BattleScene, UIScene, ResultScene, DialogueScene, StageSelectScene, WorldMapScene];
} else {
  scenes = [BootScene, TitleScene, BattleScene, UIScene, ResultScene, DialogueScene, StageSelectScene, WorldMapScene];
}

const config: Phaser.Types.Core.GameConfig = {
  ...PhaserConfig,
  scene: scenes,
};

new Phaser.Game(config);
