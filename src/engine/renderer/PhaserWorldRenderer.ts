// ─────────────────────────────────────────────
//  PhaserWorldRenderer — Phaser 3 implementation of IWorldRenderer
//  Renders strategic world map: background, edges, nodes, armies, HUD.
//  Composes WorldCameraController + WorldMinimapDisplay.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import type { IWorldRenderer, WorldHighlightMode } from './IWorldRenderer';
import type { WorldMapData, WorldNode, WorldEdge, TerritoryType, WorldTerrain } from '@/engine/strategic/data/types/World';
import type { WorldState } from '@/engine/strategic/state/WorldState';
import { WorldStateQuery } from '@/engine/strategic/state/WorldState';
import { WorldCameraController } from './WorldCameraController';
import { WorldMinimapDisplay } from './WorldMinimapDisplay';

// ── Depth constants ──
const DEPTH_BG = 1;
const DEPTH_EDGE = 10;
const DEPTH_EDGE_HIGHLIGHT = 15;
const DEPTH_NODE = 20;
const DEPTH_NODE_LABEL = 22;
const DEPTH_NODE_HIGHLIGHT = 25;
const DEPTH_SELECTION = 30;
const DEPTH_ARMY = 50;
const DEPTH_HUD = 100_000;
const DEPTH_INFO_PANEL = 1_000_001;

export class PhaserWorldRenderer implements IWorldRenderer {
  private scene: Phaser.Scene;

  // Graphics layers
  private bgLayer: Phaser.GameObjects.Graphics;
  private edgeLayer: Phaser.GameObjects.Graphics;
  private edgeHighlightLayer: Phaser.GameObjects.Graphics;
  private nodeLayer: Phaser.GameObjects.Graphics;
  private nodeHighlightLayer: Phaser.GameObjects.Graphics;
  private selectionLayer: Phaser.GameObjects.Graphics;

  // Text labels
  private nodeLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  // Army containers
  private armySprites: Map<string, Phaser.GameObjects.Container> = new Map();

  // HUD (fixed, scrollFactor 0)
  private hudContainer: Phaser.GameObjects.Container;
  private turnText: Phaser.GameObjects.Text;
  private resourceText: Phaser.GameObjects.Text;

  // Info panels
  private infoPanelContainer: Phaser.GameObjects.Container | null = null;

  // Selection pulse tween
  private selectionTween: Phaser.Tweens.Tween | null = null;

  // Composed systems
  private cameraCtrl: WorldCameraController;
  private minimap: WorldMinimapDisplay;

  // Cached data
  private worldMap: WorldMapData | null = null;
  private nodePositions: Record<string, { x: number; y: number }> = {};
  private factionColors: Record<string, number> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create graphics layers
    this.bgLayer = scene.add.graphics().setDepth(DEPTH_BG);
    this.edgeLayer = scene.add.graphics().setDepth(DEPTH_EDGE);
    this.edgeHighlightLayer = scene.add.graphics().setDepth(DEPTH_EDGE_HIGHLIGHT);
    this.nodeLayer = scene.add.graphics().setDepth(DEPTH_NODE);
    this.nodeHighlightLayer = scene.add.graphics().setDepth(DEPTH_NODE_HIGHLIGHT);
    this.selectionLayer = scene.add.graphics().setDepth(DEPTH_SELECTION);

    // Camera
    this.cameraCtrl = new WorldCameraController(scene);

    // Minimap
    this.minimap = new WorldMinimapDisplay(scene, this.cameraCtrl);

    // HUD container (fixed to screen)
    this.hudContainer = scene.add.container(0, 0).setDepth(DEPTH_HUD).setScrollFactor(0);

    this.turnText = scene.add.text(16, 16, '', {
      fontFamily: 'serif', fontSize: '18px', color: '#c9a84c',
      stroke: '#000000', strokeThickness: 3,
    });

    this.resourceText = scene.add.text(scene.cameras.main.width - 16, 16, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8dcc8',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0);

    this.hudContainer.add([this.turnText, this.resourceText]);
  }

  // ════════════════════════════════════════════
  //  renderMap
  // ════════════════════════════════════════════

  renderMap(worldMap: WorldMapData, state: WorldState, factionColors: Record<string, number>): void {
    this.worldMap = worldMap;
    this.factionColors = factionColors;

    // Build node position lookup
    this.nodePositions = {};
    for (const node of worldMap.nodes) {
      this.nodePositions[node.id] = { x: node.x, y: node.y };
    }

    // Camera bounds
    this.cameraCtrl.setMapBounds(worldMap.mapWidth, worldMap.mapHeight);
    this.cameraCtrl.setNodePositions(this.nodePositions);

    // Background
    this.drawBackground(worldMap);

    // Edges
    this.edgeLayer.clear();
    for (const edge of worldMap.edges) {
      this.drawEdge(edge);
    }

    // Nodes
    this.nodeLayer.clear();
    this.clearNodeLabels();
    for (const node of worldMap.nodes) {
      const territory = state.territories[node.id];
      const ownerColor = territory?.owner ? (factionColors[territory.owner] ?? null) : null;
      this.drawNode(node, ownerColor);
      this.createNodeLabel(node);
    }

    // Minimap
    this.minimap.init(worldMap, factionColors, state);
  }

  // ════════════════════════════════════════════
  //  syncArmies
  // ════════════════════════════════════════════

  syncArmies(state: WorldState, factionColors: Record<string, number>): void {
    // Destroy existing army sprites
    for (const container of this.armySprites.values()) {
      container.destroy();
    }
    this.armySprites.clear();

    // Recreate all
    for (const army of Object.values(state.armies)) {
      this.createArmySprite(army.id, army, state, factionColors);
    }

    // Update minimap
    this.minimap.updateArmies(state, factionColors);
  }

  // ════════════════════════════════════════════
  //  Highlights
  // ════════════════════════════════════════════

  highlightNodes(nodeIds: string[], mode: WorldHighlightMode): void {
    const color = this.getHighlightColor(mode);
    const alpha = mode === 'movement' ? 0.3 : 0.5;

    for (const nodeId of nodeIds) {
      const pos = this.nodePositions[nodeId];
      if (!pos) continue;

      if (mode === 'movement') {
        this.nodeHighlightLayer.fillStyle(color, alpha);
        this.nodeHighlightLayer.fillCircle(pos.x, pos.y, 22);
      } else {
        this.nodeHighlightLayer.lineStyle(3, color, alpha + 0.3);
        this.nodeHighlightLayer.strokeCircle(pos.x, pos.y, 24);
      }
    }
  }

  clearHighlights(): void {
    this.nodeHighlightLayer.clear();
  }

  highlightEdges(edgeKeys: string[]): void {
    this.edgeHighlightLayer.clear();
    this.edgeHighlightLayer.lineStyle(3, 0x4aeeee, 0.8);

    for (const key of edgeKeys) {
      const [fromId, toId] = key.split(':');
      if (!fromId || !toId) continue;
      const from = this.nodePositions[fromId];
      const to = this.nodePositions[toId];
      if (!from || !to) continue;
      this.edgeHighlightLayer.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  clearEdgeHighlights(): void {
    this.edgeHighlightLayer.clear();
  }

  // ════════════════════════════════════════════
  //  Selection
  // ════════════════════════════════════════════

  showNodeSelection(nodeId: string): void {
    this.hideNodeSelection();

    const pos = this.nodePositions[nodeId];
    if (!pos) return;

    this.selectionLayer.lineStyle(3, 0xc9a84c, 1.0);
    this.selectionLayer.strokeCircle(pos.x, pos.y, 26);

    // Pulsing effect
    this.selectionTween = this.scene.tweens.add({
      targets: this.selectionLayer,
      alpha: { from: 1.0, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  hideNodeSelection(): void {
    if (this.selectionTween) {
      this.selectionTween.destroy();
      this.selectionTween = null;
    }
    this.selectionLayer.clear();
    this.selectionLayer.setAlpha(1);
  }

  // ════════════════════════════════════════════
  //  Animations
  // ════════════════════════════════════════════

  async animateArmyMove(
    armyId: string,
    path: string[],
    nodePositions: Record<string, { x: number; y: number }>,
  ): Promise<void> {
    const container = this.armySprites.get(armyId);
    if (!container || path.length < 2) return;

    for (let i = 1; i < path.length; i++) {
      const target = nodePositions[path[i]!];
      if (!target) continue;

      await new Promise<void>(resolve => {
        this.scene.tweens.add({
          targets: container,
          x: target.x,
          y: target.y - 24,
          duration: 400,
          ease: 'Cubic.easeInOut',
          onComplete: () => resolve(),
        });
      });
    }
  }

  async animateNodeCapture(nodeId: string, newOwnerColor: number): Promise<void> {
    const pos = this.nodePositions[nodeId];
    if (!pos) return;

    const flash = this.scene.add.graphics().setDepth(DEPTH_SELECTION + 1);
    flash.fillStyle(newOwnerColor, 0.6);
    flash.fillCircle(pos.x, pos.y, 30);

    await new Promise<void>(resolve => {
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          flash.destroy();
          resolve();
        },
      });
    });
  }

  // ════════════════════════════════════════════
  //  Camera
  // ════════════════════════════════════════════

  focusNode(nodeId: string): void {
    this.cameraCtrl.focusOnNode(nodeId);
  }

  // ════════════════════════════════════════════
  //  HUD
  // ════════════════════════════════════════════

  updateTurnDisplay(turn: number, day: number): void {
    this.turnText.setText(`Turn ${turn} — Day ${day}`);
  }

  updateResourcePanel(gold: number, food: number, troops: number): void {
    this.resourceText.setText(`Gold: ${gold}  Food: ${food}  Troops: ${troops}`);
  }

  showTerritoryInfo(nodeId: string, state: WorldState): void {
    this.hideTerritoryInfo();

    const node = this.worldMap?.nodes.find(n => n.id === nodeId);
    const territory = state.territories[nodeId];
    if (!node || !territory) return;

    const cam = this.scene.cameras.main;
    const panelX = 10;
    const panelY = cam.height - 160;
    const panelW = 240;
    const panelH = 150;

    const container = this.scene.add.container(0, 0).setDepth(DEPTH_INFO_PANEL).setScrollFactor(0);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0c0f16, 0.92);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    bg.lineStyle(1, 0x444466, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);
    container.add(bg);

    const baseX = panelX + 12;
    const baseY = panelY + 10;
    const textStyle = { fontSize: '12px', fontFamily: 'monospace', color: '#7a8a9e' };

    const ownerFaction = territory.owner ? state.factions[territory.owner] : null;
    const ownerName = ownerFaction ? ownerFaction.id : 'Neutral';

    const lines = [
      { text: node.name, style: { fontSize: '16px', fontFamily: 'serif', color: '#c9a84c' } },
      { text: `${node.type.toUpperCase()} — ${node.terrain}`, style: textStyle },
      { text: `Owner: ${ownerName}`, style: { ...textStyle, color: '#e8dcc8' } },
      { text: `Defense: ${node.defenseBonus}   Pop: ${territory.population}`, style: textStyle },
      { text: `Morale: ${territory.morale}   Siege: ${territory.underSiege ? 'YES' : 'No'}`, style: textStyle },
      { text: `Upgrades: ${territory.upgrades.length}/${node.maxUpgradeSlots}`, style: textStyle },
    ];

    let yOff = 0;
    for (const line of lines) {
      const t = this.scene.add.text(baseX, baseY + yOff, line.text, line.style);
      container.add(t);
      yOff += parseInt(line.style.fontSize) + 6;
    }

    this.infoPanelContainer = container;
  }

  hideTerritoryInfo(): void {
    if (this.infoPanelContainer) {
      this.infoPanelContainer.destroy();
      this.infoPanelContainer = null;
    }
  }

  showArmyInfo(armyId: string, state: WorldState): void {
    this.hideTerritoryInfo(); // Reuse the same panel area

    const army = state.armies[armyId];
    if (!army) return;

    const cam = this.scene.cameras.main;
    const panelX = 10;
    const panelY = cam.height - 145;
    const panelW = 240;
    const panelH = 135;

    const container = this.scene.add.container(0, 0).setDepth(DEPTH_INFO_PANEL).setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0c0f16, 0.92);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    bg.lineStyle(1, 0x444466, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);
    container.add(bg);

    const baseX = panelX + 12;
    const baseY = panelY + 10;
    const textStyle = { fontSize: '12px', fontFamily: 'monospace', color: '#7a8a9e' };

    const faction = state.factions[army.factionId];
    const generals = army.generals.map(gId => state.generals[gId]?.name ?? gId);
    const totalTroops = army.generals.reduce((sum, gId) => sum + (state.generals[gId]?.currentTroops ?? 0), 0);

    const lines = [
      { text: `Army — ${faction?.id ?? army.factionId}`, style: { fontSize: '16px', fontFamily: 'serif', color: '#c9a84c' } },
      { text: `Status: ${army.status}`, style: { ...textStyle, color: '#e8dcc8' } },
      { text: `Generals: ${generals.join(', ')}`, style: textStyle },
      { text: `Total Troops: ${totalTroops.toLocaleString()}`, style: textStyle },
      { text: `Location: ${army.locationNodeId}`, style: textStyle },
    ];

    let yOff = 0;
    for (const line of lines) {
      const t = this.scene.add.text(baseX, baseY + yOff, line.text, line.style);
      container.add(t);
      yOff += parseInt(line.style.fontSize) + 6;
    }

    this.infoPanelContainer = container;
  }

  hideArmyInfo(): void {
    this.hideTerritoryInfo(); // Same panel
  }

  // ════════════════════════════════════════════
  //  Phase / Battle HUD
  // ════════════════════════════════════════════

  private phaseOverlay: Phaser.GameObjects.Container | null = null;
  private battlePreview: Phaser.GameObjects.Container | null = null;
  private battleResultPanel: Phaser.GameObjects.Container | null = null;

  showPhaseOverlay(text: string): void {
    this.hidePhaseOverlay();
    const cam = this.scene.cameras.main;
    const container = this.scene.add.container(0, 0).setDepth(DEPTH_HUD + 10).setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, cam.height / 2 - 30, cam.width, 60);
    container.add(bg);

    const label = this.scene.add.text(cam.width / 2, cam.height / 2, text, {
      fontFamily: 'serif', fontSize: '28px', color: '#c9a84c',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(label);

    this.phaseOverlay = container;
  }

  hidePhaseOverlay(): void {
    if (this.phaseOverlay) {
      this.phaseOverlay.destroy();
      this.phaseOverlay = null;
    }
  }

  showBattlePreview(battleId: string, attackerName: string, defenderName: string, territoryName: string): void {
    this.hideBattlePreview();
    const cam = this.scene.cameras.main;
    const container = this.scene.add.container(0, 0).setDepth(DEPTH_HUD + 20).setScrollFactor(0);

    const panelW = 320;
    const panelH = 100;
    const panelX = (cam.width - panelW) / 2;
    const panelY = cam.height / 2 - panelH / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(2, 0xc9a84c, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    container.add(bg);

    const title = this.scene.add.text(cam.width / 2, panelY + 16, `⚔ BATTLE at ${territoryName}`, {
      fontFamily: 'serif', fontSize: '18px', color: '#c9a84c',
    }).setOrigin(0.5, 0);
    container.add(title);

    const vs = this.scene.add.text(cam.width / 2, panelY + 50, `${attackerName}  VS  ${defenderName}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8dcc8',
    }).setOrigin(0.5, 0);
    container.add(vs);

    this.battlePreview = container;
  }

  hideBattlePreview(): void {
    if (this.battlePreview) {
      this.battlePreview.destroy();
      this.battlePreview = null;
    }
  }

  showBattleResultSummary(winnerName: string, loserName: string, captured: boolean): void {
    this.hideBattleResultSummary();
    const cam = this.scene.cameras.main;
    const container = this.scene.add.container(0, 0).setDepth(DEPTH_HUD + 20).setScrollFactor(0);

    const panelW = 280;
    const panelH = 80;
    const panelX = (cam.width - panelW) / 2;
    const panelY = cam.height / 2 - panelH / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a2e1a, 0.95);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    container.add(bg);

    const text = captured
      ? `${winnerName} WINS — Territory captured!`
      : `${winnerName} WINS vs ${loserName}`;

    const label = this.scene.add.text(cam.width / 2, cam.height / 2, text, {
      fontFamily: 'serif', fontSize: '16px', color: '#8aea8a',
    }).setOrigin(0.5);
    container.add(label);

    this.battleResultPanel = container;
  }

  hideBattleResultSummary(): void {
    if (this.battleResultPanel) {
      this.battleResultPanel.destroy();
      this.battleResultPanel = null;
    }
  }

  // ════════════════════════════════════════════
  //  Lifecycle
  // ════════════════════════════════════════════

  update(_time: number, delta: number): void {
    this.cameraCtrl.update(delta);
  }

  destroy(): void {
    this.bgLayer.destroy();
    this.edgeLayer.destroy();
    this.edgeHighlightLayer.destroy();
    this.nodeLayer.destroy();
    this.nodeHighlightLayer.destroy();
    this.selectionLayer.destroy();
    this.hudContainer.destroy();
    this.hideTerritoryInfo();
    this.clearNodeLabels();
    for (const c of this.armySprites.values()) c.destroy();
    this.armySprites.clear();
    this.minimap.destroy();
    this.cameraCtrl.destroy();
    if (this.selectionTween) this.selectionTween.destroy();
  }

  /** Expose camera controller for input handler drag detection. */
  getCameraController(): WorldCameraController {
    return this.cameraCtrl;
  }

  // ════════════════════════════════════════════
  //  Private — Drawing helpers
  // ════════════════════════════════════════════

  private drawBackground(worldMap: WorldMapData): void {
    this.bgLayer.clear();

    if (this.scene.textures.exists('world_map_bg')) {
      this.scene.add.image(worldMap.mapWidth / 2, worldMap.mapHeight / 2, 'world_map_bg').setDepth(DEPTH_BG);
    } else {
      this.bgLayer.fillStyle(0x0c0f16, 1);
      this.bgLayer.fillRect(-100, -100, worldMap.mapWidth + 200, worldMap.mapHeight + 200);
    }
  }

  private drawEdge(edge: WorldEdge): void {
    const from = this.nodePositions[edge.from];
    const to = this.nodePositions[edge.to];
    if (!from || !to) return;

    const color = getEdgeTerrainColor(edge.terrain);
    const width = (edge.width ?? 1) * 2;

    this.edgeLayer.lineStyle(width, color, 0.6);
    this.edgeLayer.lineBetween(from.x, from.y, to.x, to.y);
  }

  private drawNode(node: WorldNode, ownerColor: number | null): void {
    const radius = getNodeRadius(node.type);
    const fillColor = getNodeTypeColor(node.type);

    // Base circle
    this.nodeLayer.fillStyle(fillColor, 0.9);
    this.nodeLayer.fillCircle(node.x, node.y, radius);

    // Faction border ring
    if (ownerColor !== null) {
      this.nodeLayer.lineStyle(3, ownerColor, 1.0);
      this.nodeLayer.strokeCircle(node.x, node.y, radius + 2);
    } else {
      this.nodeLayer.lineStyle(1, 0x555555, 0.5);
      this.nodeLayer.strokeCircle(node.x, node.y, radius + 2);
    }

    // Type indicator (inner shape)
    this.drawTypeIndicator(node.type, node.x, node.y, radius);
  }

  private drawTypeIndicator(type: TerritoryType, x: number, y: number, radius: number): void {
    const inner = radius * 0.45;
    this.nodeLayer.fillStyle(0xffffff, 0.5);

    switch (type) {
      case 'city': // Small square
        this.nodeLayer.fillRect(x - inner, y - inner, inner * 2, inner * 2);
        break;
      case 'fortress': // Diamond
        this.nodeLayer.fillTriangle(x, y - inner, x + inner, y, x, y + inner);
        this.nodeLayer.fillTriangle(x, y - inner, x - inner, y, x, y + inner);
        break;
      case 'village': // Triangle
        this.nodeLayer.fillTriangle(x, y - inner, x + inner, y + inner, x - inner, y + inner);
        break;
      case 'port': // Small circle
        this.nodeLayer.fillCircle(x, y, inner * 0.7);
        break;
      case 'pass': // X shape (two small lines)
        this.nodeLayer.lineStyle(2, 0xffffff, 0.5);
        this.nodeLayer.lineBetween(x - inner, y - inner, x + inner, y + inner);
        this.nodeLayer.lineBetween(x + inner, y - inner, x - inner, y + inner);
        break;
      case 'camp': // Small triangle (tent)
        this.nodeLayer.fillTriangle(x, y - inner * 0.8, x + inner, y + inner * 0.5, x - inner, y + inner * 0.5);
        break;
    }
  }

  private createNodeLabel(node: WorldNode): void {
    const radius = getNodeRadius(node.type);
    const label = this.scene.add.text(node.x, node.y + radius + 8, node.name, {
      fontSize: '11px', fontFamily: 'serif', color: '#c8d0e0',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(DEPTH_NODE_LABEL);

    this.nodeLabels.set(node.id, label);
  }

  private clearNodeLabels(): void {
    for (const label of this.nodeLabels.values()) {
      label.destroy();
    }
    this.nodeLabels.clear();
  }

  private createArmySprite(
    armyId: string,
    army: { factionId: string; generals: string[]; locationNodeId: string },
    state: WorldState,
    factionColors: Record<string, number>,
  ): void {
    const nodePos = this.nodePositions[army.locationNodeId];
    if (!nodePos) return;

    const factionColor = factionColors[army.factionId] ?? 0xffffff;

    // Stack offset for multiple armies at same node
    const armiesAtNode = WorldStateQuery.armiesAtNode(state, army.locationNodeId);
    const idx = armiesAtNode.findIndex(a => a.id === armyId);
    const offset = idx * 14 - (armiesAtNode.length - 1) * 7;

    const container = this.scene.add.container(nodePos.x, nodePos.y - 24 + offset);

    // Shield shape
    const shield = this.scene.add.graphics();
    shield.fillStyle(factionColor, 0.9);
    shield.fillRoundedRect(-8, -8, 16, 16, 3);
    shield.lineStyle(1, 0xffffff, 0.6);
    shield.strokeRoundedRect(-8, -8, 16, 16, 3);
    container.add(shield);

    // General count badge
    const badge = this.scene.add.text(6, -10, `${army.generals.length}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#fff',
      backgroundColor: '#000000aa', padding: { x: 2, y: 1 },
    }).setOrigin(0.5);
    container.add(badge);

    container.setDepth(DEPTH_ARMY);
    this.armySprites.set(armyId, container);
  }

  private getHighlightColor(mode: WorldHighlightMode): number {
    switch (mode) {
      case 'selection':  return 0xc9a84c;
      case 'movement':   return 0x4a8a4a;
      case 'attack':     return 0xaa3333;
      case 'path':       return 0x4aeeee;
      default:           return 0xffffff;
    }
  }
}

// ── Pure helper functions ──

function getNodeRadius(type: TerritoryType): number {
  switch (type) {
    case 'city':     return 18;
    case 'fortress': return 16;
    case 'port':     return 14;
    case 'village':  return 12;
    case 'pass':     return 10;
    case 'camp':     return 8;
    default:         return 12;
  }
}

function getNodeTypeColor(type: TerritoryType): number {
  switch (type) {
    case 'city':     return 0x4a6a8a;
    case 'fortress': return 0x6a5a4a;
    case 'village':  return 0x5a7a5a;
    case 'port':     return 0x4a7a9a;
    case 'pass':     return 0x7a7a6a;
    case 'camp':     return 0x8a7a5a;
    default:         return 0x555555;
  }
}

function getEdgeTerrainColor(terrain: WorldTerrain): number {
  switch (terrain) {
    case 'plains':   return 0x4a8a4a;
    case 'forest':   return 0x2a5a2a;
    case 'mountain': return 0x7a7a7a;
    case 'desert':   return 0xc8a870;
    case 'coastal':  return 0x4a7aaa;
    case 'swamp':    return 0x6a4a8a;
    case 'snow':     return 0xc8c8d8;
    default:         return 0x666666;
  }
}
