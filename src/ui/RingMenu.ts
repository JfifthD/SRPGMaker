import Phaser from 'phaser';
import { EventBus } from '@/engine/utils/EventBus';
import type { ActionPayload } from '@/engine/coordinator/BattleCoordinator';
import type { UnitInstance } from '@/engine/data/types/Unit';
import { TILE_SIZE, MAP_OFFSET_X, MAP_OFFSET_Y } from '@/config';

const RADIUS = 60; // Radius of the ring menu

export class RingMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private buttons: Phaser.GameObjects.Container[] = [];
  private activeUnitId: string | null = null;
  private currentPayload: ActionPayload[] = [];
  private viewMode: 'main' | 'skills' = 'main';
  private cachedMainPayload: ActionPayload[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Layer it extremely high so it renders above all tiles, UI grids, and move highlights (which are at 99999)
    this.container = this.scene.add.container(0, 0).setDepth(999999).setVisible(false);

    EventBus.on('actionMenuUpdate', (e) => this.onActionUpdate(e.actions));
    EventBus.on('openRingMenu', (e) => this.open(e.unit, e.tx, e.ty));
    EventBus.on('closeRingMenu', () => this.close());
    EventBus.on('unitSelected', (e) => {
        if (!e.unit) this.close();
    });
  }

  private onActionUpdate(actions: ActionPayload[]) {
    this.cachedMainPayload = actions;
    if (this.viewMode === 'main') {
        this.currentPayload = actions;
        // If the menu is currently visible, refresh its visuals.
        if (this.container.visible && this.activeUnitId) {
            this.renderButtons();
        }
    }
  }

  private open(unit: UnitInstance, tx: number, ty: number) {
    this.activeUnitId = unit.instanceId;
    this.viewMode = 'main';
    this.currentPayload = this.cachedMainPayload;
    
    // Position the menu exactly over the center of the referenced tile/unit
    // Applying the same basic ortho math from the renderer
    const sx = tx * (TILE_SIZE + 2) + MAP_OFFSET_X + (TILE_SIZE / 2);
    const sy = ty * (TILE_SIZE + 2) + MAP_OFFSET_Y + (TILE_SIZE / 2); // Ignoring elevation for the menu anchor for now
    
    this.container.setPosition(sx, sy);
    this.renderButtons();
    
    this.scene.tweens.killTweensOf(this.container);
    this.container.setAlpha(0);
    this.container.setScale(0.5);
    this.container.setVisible(true);
    
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  private close() {
    if (!this.container.visible) return;
    
    this.activeUnitId = null;
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.5,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        this.clearButtons();
      }
    });
  }

  private clearButtons() {
    this.buttons.forEach(b => b.destroy());
    this.buttons = [];
  }

  private renderButtons() {
    this.clearButtons();
    if (!this.currentPayload.length) return;

    // We fallback to auto-distribution if a preferred angle isn't defined
    const sliceAngle = 360 / this.currentPayload.length;

    this.currentPayload.forEach((action, i) => {
      // Determine angle (Start at 12 o'clock / -90 deg and spread evenly)
      const angleDeg = -90 + (i * sliceAngle);
          
      const rad = Phaser.Math.DegToRad(angleDeg);
      const bx = Math.cos(rad) * RADIUS;
      const by = Math.sin(rad) * RADIUS;

      // Build button container
      const btn = this.scene.add.container(bx, by);
      
      // Graphic
      const bg = this.scene.add.circle(0, 0, 22, action.disabled ? 0x242d3d : 0x151515);
      bg.setStrokeStyle(2, action.disabled ? 0x111111 : 0xc9a84c);
      
      // Label
      const text = this.scene.add.text(0, 0, action.label.substring(0, 4), {
          fontFamily: 'serif',
          fontSize: '10px',
          color: action.disabled ? '#7a8a9e' : '#ccc4b0',
          align: 'center'
      }).setOrigin(0.5);

      btn.add([bg, text]);
      this.container.add(btn);
      this.buttons.push(btn);

      // Interactions
      if (!action.disabled) {
          // Make interactive using a circle hit area
          const hitArea = new Phaser.Geom.Circle(0, 0, 22);
          btn.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
          
          btn.on('pointerover', () => {
              bg.setFillStyle(0x2a2a2a);
              this.scene.tweens.add({ targets: btn, scale: 1.15, duration: 100 });
              EventBus.emit('ringMenuHover', { action });
          });
          
          btn.on('pointerout', () => {
              bg.setFillStyle(0x151515);
              this.scene.tweens.add({ targets: btn, scale: 1.0, duration: 100 });
              EventBus.emit('ringMenuHoverEnd', {});
          });
          
          btn.on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => {
              event.stopPropagation();
              this.scene.tweens.add({ targets: btn, scale: 0.9, duration: 50, yoyo: true });
              this.executeAction(action.id);
          });
      }
    });
  }

  private executeAction(id: string) {
    // We delegate the click out to the BattleScene/Coordinator
    // Since we don't hold a direct reference to it, we can use the global DOM element dispatch 
    // or call the global methods on the Scene just like UIScene does.
    const battle = this.scene.scene.get('BattleScene') as any;
    
    switch (id) {
        case 'move':
            // Move is usually implicitly handled by tile clicks, but we can explicitly set mode
            // Actually, in current architecture, selecting the unit already handles idle->move mode conceptually.
            // We just close the menu so they can click the board.
            this.close();
            break;
        case 'attack':
            battle.activateAttack();
            this.close();
            break;
        case 'skill':
            this.openSkillSubMenu();
            break;
        case 'wait':
            battle.waitAction();
            this.close();
            break;
        case 'end':
            battle.endTurn();
            this.close();
            break;
        case 'back':
            // Go back to main
            this.viewMode = 'main';
            this.currentPayload = this.cachedMainPayload;
            this.scene.tweens.add({
              targets: this.container,
              scale: 0.1, alpha: 0, duration: 100,
              onComplete: () => {
                  this.renderButtons();
                  this.scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
              }
            });
            break;
        default:
            // Any unrecognized ID is treated as a skill invocation
            battle.activateSkill(id);
            this.close();
            break;
    }
  }

  private openSkillSubMenu() {
      // Build an ad-hoc payload for the unit's skills
      // Note: in a true decoupled setup, BattleCoordinator would serve this payload too.
      // But we can synthesize it here for visual purposes.
      const state = (window as any).__GameStoreState__?.(); // Not ideal, but we can access skills from the UI or emit a request.
      // Better way: we emit an event to request skills, OR BattleCoordinator pre-fills 'metadata' with skills.
      // Let's assume the cachedMainPayload's 'skill' action provides metadata if populated.
      const skillBtn = this.cachedMainPayload.find(a => a.id === 'skill');
      
      const payload: ActionPayload[] = [];
      payload.push({ id: 'back', label: 'BACK', costAP: 0, disabled: false });
      
      if (skillBtn && skillBtn.metadata && skillBtn.metadata.skills) {
          skillBtn.metadata.skills.forEach((sk: any) => {
              payload.push({ 
                  id: sk.id, 
                  label: sk.name.substring(0, 5), // Short label
                  costAP: sk.ap, 
                  disabled: !sk.canUse 
              });
          });
      } else {
          payload.push({ id: 'error', label: 'NONE', costAP: 0, disabled: true });
      }

      this.currentPayload = payload;
      this.viewMode = 'skills';
      
      // Animate the swooping transition
      this.scene.tweens.add({
          targets: this.container,
          scale: 1.2, alpha: 0, duration: 100,
          onComplete: () => {
              this.renderButtons();
              this.scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
          }
      });
  }

  public destroy() {
    EventBus.off('actionMenuUpdate', () => {}); // Needs proper reference cleanup for production
    this.container.destroy();
  }
}
