// ─────────────────────────────────────────────
//  UI Scene — HUD overlay above BattleScene
//  Uses Phaser DOM elements so we can keep CSS styling.
// ─────────────────────────────────────────────

import Phaser from 'phaser';
import { EventBus } from '@/engine/utils/EventBus';
import { store } from '@/engine/state/GameStore';
import { StateQuery } from '@/engine/state/BattleState';
import type { BattleState } from '@/engine/state/BattleState';
import type { UnitInstance } from '@/engine/data/types/Unit';
import type { CombatPreview } from '@/engine/systems/combat/DamageCalc';
import { predictTurnOrder } from '@/engine/utils/TurnOrderPredictor';
import skillsJson from '@/assets/data/skills.json';
import terrainJson from '@/assets/data/terrains.json';
import type { SkillData } from '@/engine/data/types/Skill';

const ALL_SKILLS: Record<string, SkillData> = skillsJson as Record<string, SkillData>;

export class UIScene extends Phaser.Scene {
  private logEl!: HTMLElement;
  private allyPanelEl!: HTMLElement;
  private enemyPanelEl!: HTMLElement;
  private skillAreaEl!: HTMLElement;
  private infoBoxEl!: HTMLElement;
  private turnEl!: HTMLElement;
  private phaseEl!: HTMLElement;
  private previewBoxEl!: HTMLElement;
  private timelineEl!: HTMLElement;
  private selectedUnit: UnitInstance | null = null;

  constructor() { super({ key: 'UIScene' }); }

  create(): void {
    this.buildDOMOverlay();

    store.subscribe(state => this.onStateChange(state));

    EventBus.on('logMessage',    ({ text, cls }) => this.appendLog(text, cls), this);
    EventBus.on('unitSelected',  ({ unit }) => { this.selectedUnit = unit; }, this);
    EventBus.on('cancelAction',  () => { this.selectedUnit = null; this.renderSkills(null); this.hidePreview(); }, this);
    EventBus.on('phaseChanged',  ({ phase }) => this.onPhaseChange(phase), this);
    EventBus.on('combatPreview', ({ preview, target }) => this.onCombatPreview(preview, target), this);
    EventBus.on('ringMenuHover', ({ action }) => this.onRingMenuHover(action), this);
    EventBus.on('ringMenuHoverEnd', () => this.onRingMenuHoverEnd(), this);

    this.onStateChange(store.getState());
  }

  // ─────────────────────── DOM Construction ───────────────────────

  private buildDOMOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'hud-overlay';
    overlay.innerHTML = `
      <style>
        #hud-overlay {
          position: fixed; inset: 0; pointer-events: none;
          font-family: 'Georgia', serif; color: #ccc4b0; font-size: 13px;
          display: grid;
          grid-template-areas:
            "top    top    top"
            "left   .      right"
            "bottom bottom bottom";
          grid-template-columns: 200px 1fr 200px;
          grid-template-rows: auto 1fr auto;
          gap: 6px; padding: 8px;
        }
        /* ── Top bar ── */
        #hud-top         { grid-area: top; display:flex; flex-direction:column; gap:4px; }
        #hud-top-bar     { display:flex; justify-content:space-between; align-items:center; pointer-events:all; }
        /* ── Timeline ── */
        #timeline        { display:flex; gap:3px; align-items:stretch; overflow-x:auto; padding-bottom:2px; }
        #timeline::-webkit-scrollbar { height:3px; }
        #timeline::-webkit-scrollbar-thumb { background:#242d3d; border-radius:2px; }
        .tl-card         { background:rgba(12,15,22,.93); border:1px solid #242d3d; border-radius:3px;
                           padding:4px 6px; min-width:54px; max-width:54px; text-align:center; flex-shrink:0; }
        .tl-card.tl-active { border-color:#c9a84c; background:rgba(201,168,76,.12); }
        .tl-card.tl-enemy  { border-color:#6b2020; }
        .tl-dot          { width:8px; height:8px; border-radius:50%; margin:0 auto 2px; }
        .tl-name         { font-size:9px; color:#9aa5b4; white-space:nowrap; overflow:hidden;
                           text-overflow:ellipsis; line-height:1.2; }
        .tl-card.tl-active .tl-name { color:#e8cc78; }
        .tl-ct-track     { height:2px; background:#0d1017; border-radius:1px; margin-top:3px; }
        .tl-ct-fill      { height:100%; border-radius:1px; background:#4a5568; }
        .tl-card.tl-active .tl-ct-fill { background:#c9a84c; }
        /* ── Panels ── */
        #hud-left        { grid-area: left; overflow-y:auto; }
        #hud-right       { grid-area: right; overflow-y:auto; }
        #hud-bottom      { grid-area: bottom; display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .panel           { background:rgba(12,15,22,.93); border:1px solid #242d3d; border-radius:4px; padding:8px; }
        .panel-title     { font-size:10px; color:#c9a84c; letter-spacing:3px; text-transform:uppercase;
                           border-bottom:1px solid #242d3d; padding-bottom:5px; margin-bottom:7px; }
        .unit-card       { background:#151a22; border:1px solid #242d3d; border-radius:3px; padding:7px;
                           margin-bottom:4px; cursor:pointer; pointer-events:all; transition:border-color .15s; }
        .unit-card:hover { border-color:#c9a84c; }
        .unit-card.dead  { opacity:.25; pointer-events:none; }
        .unit-card.active-unit { border-color:#c9a84c; background:#1a1f2a; }
        .unit-name       { font-size:11px; color:#e8cc78; margin-bottom:3px; }
        .unit-name.en    { color:#e74c3c; }
        .bar-wrap        { height:4px; background:#0d1017; border-radius:2px; overflow:hidden; margin:2px 0; }
        .bar-fill        { height:100%; border-radius:2px; }
        .bar-hp          { background: linear-gradient(90deg,#1e8a4c,#2ecc71); }
        .bar-hpe         { background: linear-gradient(90deg,#c0392b,#e74c3c); }
        .bar-mp          { background: linear-gradient(90deg,#1a3a6e,#4ab3e0); }
        .bar-ap          { background: linear-gradient(90deg,#6c3483,#c39bd3); }
        .stat-row        { display:flex; justify-content:space-between; font-size:10px; color:#7a8a9e; }
        .stat-row span:last-child { color:#ccc4b0; }
        /* ── Battle Log ── */
        #battle-log      { height:84px; overflow-y:auto; font-size:11px; line-height:1.65; padding:4px 8px; }
        #battle-log::-webkit-scrollbar { width:2px; }
        #battle-log::-webkit-scrollbar-thumb { background:#242d3d; }
        .le { color:#7a8a9e; } .la { color:#c9a84c; } .lae { color:#e74c3c; }
        .lsk { color:#a569bd; } .lh { color:#2ecc71; } .lc { color:#fff; font-weight:bold; } .ls { color:#4ab3e0; font-style:italic; }
        /* ── Skill area ── */
        .skill-area      { display:flex; gap:4px; flex-wrap:wrap; padding:5px 7px; }
        .skill-btn       { background:#151a22; border:1px solid #242d3d; border-radius:3px; padding:5px 8px;
                           cursor:pointer; pointer-events:all; font-size:11px; color:#ccc4b0; text-align:left;
                           transition:border-color .15s,background .15s; }
        .skill-btn:hover:not(:disabled) { border-color:#4ab3e0; background:#0f1820; }
        .skill-btn:disabled { opacity:.35; cursor:not-allowed; }
        .sk-name         { font-size:9px; color:#4ab3e0; display:block; letter-spacing:1px; margin-bottom:2px; }
        /* ── Control buttons ── */
        .ctrl-btn        { background:#151a22; border:1px solid #242d3d; border-radius:3px; padding:4px 10px;
                           color:#ccc4b0; font-size:10px; letter-spacing:1px; cursor:pointer;
                           pointer-events:all; transition:all .15s; }
        .ctrl-btn:hover:not(:disabled) { border-color:#c9a84c; color:#c9a84c; }
        .ctrl-btn:disabled { opacity:.4; cursor:not-allowed; }
        .ctrl-btn.danger { border-color:#c0392b; color:#e74c3c; }
        .ctrl-btn.danger:hover:not(:disabled) { background:#180808; }
        #turn-label      { font-size:11px; color:#7a8a9e; letter-spacing:2px; }
        #phase-label     { font-size:12px; color:#c9a84c; letter-spacing:2px; }
        #phase-label.ep  { color:#e74c3c; }
        /* ── Combat preview ── */
        #preview-box     { position:absolute; bottom:120px; left:50%; transform:translateX(-50%);
                           background:rgba(20,25,35,.98); border:1px solid #c9a84c; border-radius:4px;
                           padding:10px; display:none; pointer-events:none; min-width:180px;
                           box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:100; text-align:center; }
        #preview-box.show { display:block; }
        .pv-title        { font-size:11px; color:#e8cc78; font-weight:bold; letter-spacing:1px;
                           margin-bottom:6px; border-bottom:1px solid #3c4656; padding-bottom:4px; }
        .pv-row          { display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px; }
        .pv-dmg          { color:#e74c3c; font-weight:bold; font-size:13px; }
        .pv-crit         { color:#a569bd; font-size:10px; }
        .pv-kill         { color:#2ecc71; font-weight:bold; letter-spacing:1px; margin-top:4px; }
      </style>

      <div id="preview-box"></div>

      <div id="hud-top">
        <div id="hud-top-bar">
          <span style="font-size:17px;color:#c9a84c;letter-spacing:4px;font-family:serif;">⚔ CHRONICLE OF SHADOWS</span>
          <div style="display:flex;align-items:center;gap:12px;">
            <span id="turn-label">TURN 1</span>
            <span id="phase-label">PLAYER PHASE</span>
          </div>
          <div id="action-hint" style="font-size:11px;color:#7a8a9e;">유닛을 눌러 메뉴 호출</div>
        </div>
        <div id="timeline"></div>
      </div>

      <div id="hud-left">
        <div class="panel">
          <div class="panel-title">🛡 Allies</div>
          <div id="ally-panel"></div>
        </div>
        <div class="panel" style="margin-top:6px;">
          <div class="panel-title">📋 Info</div>
          <div id="info-box" style="font-size:11px;color:#7a8a9e;line-height:1.7;">유닛을 선택하세요.</div>
        </div>
      </div>

      <div id="hud-right">
        <div class="panel">
          <div class="panel-title">💀 Enemies</div>
          <div id="enemy-panel"></div>
        </div>
      </div>

      <div id="hud-bottom">
        <div class="panel"><div id="battle-log"></div></div>
        <div class="panel"><div class="skill-area" id="skill-area"><span style="color:#7a8a9e;font-size:11px;">유닛을 선택하면 스킬이 표시됩니다.</span></div></div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.logEl        = document.getElementById('battle-log')!;
    this.allyPanelEl  = document.getElementById('ally-panel')!;
    this.enemyPanelEl = document.getElementById('enemy-panel')!;
    this.skillAreaEl  = document.getElementById('skill-area')!;
    this.infoBoxEl    = document.getElementById('info-box')!;
    this.turnEl       = document.getElementById('turn-label')!;
    this.phaseEl      = document.getElementById('phase-label')!;
    this.previewBoxEl = document.getElementById('preview-box')!;
    this.timelineEl   = document.getElementById('timeline')!;
  }

  // ─────────────────────── Updates ───────────────────────

  private onStateChange(state: BattleState): void {
    this.turnEl.textContent = `TURN ${state.turn}`;
    this.renderAllyPanel(state);
    this.renderEnemyPanel(state);
    this.renderTimeline(state);
    if (this.selectedUnit) {
      const fresh = StateQuery.unit(state, this.selectedUnit.instanceId) ?? null;
      this.renderSkills(fresh);
      if (fresh) this.renderInfo(state, fresh.instanceId);
    }
  }

  private onPhaseChange(phase: string): void {
    if (phase === 'ENEMY_PHASE') {
      this.phaseEl.textContent = 'ENEMY PHASE';
      this.phaseEl.className = 'ep';
    } else if (phase === 'PLAYER_IDLE') {
      this.phaseEl.textContent = 'PLAYER PHASE';
      this.phaseEl.className = '';
    }
    this.hidePreview();
  }

  // ─────────────────────── Timeline ───────────────────────

  private renderTimeline(state: BattleState): void {
    const liveUnits = Object.values(state.units).filter(u => u.hp > 0);
    const activeUnit = state.activeUnitId ? state.units[state.activeUnitId] : null;

    // Predict next 6 turns after the current active unit
    const upcoming = predictTurnOrder(liveUnits, 6);

    let html = '';

    // Slot 0: current active unit (always shown if exists)
    if (activeUnit) {
      html += this.timelineCardHTML(activeUnit, true);
    }

    // Slots 1-6: predicted upcoming units
    for (const entry of upcoming) {
      if (entry.unit) {
        html += this.timelineCardHTML(entry.unit, false);
      }
    }

    this.timelineEl.innerHTML = html;
  }

  private timelineCardHTML(u: UnitInstance, isActive: boolean): string {
    const isEnemy  = u.team === 'enemy';
    const dotColor = isEnemy ? '#e74c3c' : '#2ecc71';
    const ctPct    = isActive ? 100 : Math.min(99, Math.floor((u.ct / 100) * 100));
    const cardCls  = isActive ? 'tl-card tl-active' : `tl-card${isEnemy ? ' tl-enemy' : ''}`;
    return `
      <div class="${cardCls}" title="${u.name} (${u.job}) SPD:${u.spd}">
        <div class="tl-dot" style="background:${dotColor}"></div>
        <div class="tl-name">${u.name}</div>
        <div class="tl-ct-track"><div class="tl-ct-fill" style="width:${ctPct}%"></div></div>
      </div>`;
  }

  // ─────────────────────── Panels ───────────────────────

  private renderAllyPanel(state: BattleState): void {
    this.allyPanelEl.innerHTML = StateQuery.allies(state)
      .map(u => this.unitCardHTML(u, state.activeUnitId)).join('');
    this.allyPanelEl.querySelectorAll('.unit-card').forEach((el, i) => {
      const units = StateQuery.allies(state);
      (el as HTMLElement).onclick = () => {
        const u = units[i];
        if (u) {
          // Sync store selection so coordinator.activateSkill() reads the correct unit
          store.setSelectedUnit(u.instanceId);
        }
      };
    });
  }

  private renderEnemyPanel(state: BattleState): void {
    this.enemyPanelEl.innerHTML = StateQuery.enemies(state)
      .map(u => this.unitCardHTML(u, state.activeUnitId)).join('');
  }

  private unitCardHTML(u: UnitInstance, activeUnitId: string | null): string {
    const dead    = u.hp <= 0 ? ' dead' : '';
    const active  = u.instanceId === activeUnitId ? ' active-unit' : '';
    const barCls  = u.team === 'ally' ? 'bar-hp' : 'bar-hpe';
    const apPct   = u.maxAP > 0 ? Math.min(100, (u.currentAP / u.maxAP) * 100).toFixed(1) : '0';
    return `
      <div class="unit-card${dead}${active}">
        <div class="unit-name ${u.team === 'enemy' ? 'en' : ''}">${u.name} <span style="font-size:9px;opacity:.7">${u.job}</span></div>
        <div class="stat-row"><span>HP</span><span>${Math.max(0, u.hp)}/${u.maxHp}</span></div>
        <div class="bar-wrap"><div class="bar-fill ${barCls}" style="width:${Math.max(0, u.hp / u.maxHp * 100).toFixed(1)}%"></div></div>
        ${u.team === 'ally' ? `
          <div class="bar-wrap"><div class="bar-fill bar-mp" style="width:${(u.mp / u.maxMp * 100).toFixed(1)}%"></div></div>
          <div class="stat-row"><span>AP</span><span style="color:${u.currentAP > 0 ? '#c39bd3' : '#4a5568'}">${u.currentAP}/${u.maxAP}</span></div>
          <div class="bar-wrap"><div class="bar-fill bar-ap" style="width:${apPct}%"></div></div>
        ` : ''}
        <div class="stat-row"><span>ATK ${u.atk}</span><span>DEF ${u.def}</span><span>SPD ${u.spd}</span></div>
        ${u.buffs.length ? `<div style="font-size:9px;color:#4ab3e0">⬆ buffs×${u.buffs.length}</div>` : ''}
      </div>`;
  }

  // ─────────────────────── Skills ───────────────────────

  private renderSkills(unit: UnitInstance | null): void {
    if (!unit || unit.team !== 'ally' || unit.hp <= 0) {
      this.skillAreaEl.innerHTML = '<span style="color:#7a8a9e;font-size:11px;">아군을 선택하세요.</span>';
      return;
    }

    const state        = store.getState();
    const isPlayerPhase = state.phase === 'PLAYER_IDLE';
    // Skills and attacks are only usable by the active unit
    const isActiveUnit  = unit.instanceId === state.activeUnitId;

    this.skillAreaEl.innerHTML = '';

    // Don't auto-render skill buttons; they appear via Ring Menu hover now.
    // Only keep the ATTACK button for quick reference.
    const atkBtn = document.createElement('button');
    atkBtn.className = 'skill-btn';
    atkBtn.disabled = !isPlayerPhase || !isActiveUnit || unit.acted || unit.currentAP < 3;
    atkBtn.innerHTML = '<span class="sk-name">ATTACK</span><span style="font-size:10px;color:#7a8a9e">기본 공격</span><br><span style="font-size:9px;color:#e74c3c">MP:0 AP:3</span>';
    atkBtn.onclick = () => {
      const battle = this.scene.get('BattleScene') as unknown as { activateAttack(): void };
      battle.activateAttack();
    };
    this.skillAreaEl.appendChild(atkBtn);
  }

  // ─────────────────────── Ring Menu Hover ───────────────────────

  private onRingMenuHover(action: import('@/engine/coordinator/BattleCoordinator').ActionPayload): void {
    // If action has metadata with skill info, show it in the skill panel
    if (action.metadata?.skills) {
      // This is the SKILLS parent button — show all skills as a preview list
      this.skillAreaEl.innerHTML = '';
      for (const sk of action.metadata.skills) {
        const skData = ALL_SKILLS[sk.id];
        if (!skData) continue;
        const el = document.createElement('div');
        el.className = 'skill-btn';
        el.style.pointerEvents = 'none';
        el.style.opacity = sk.canUse ? '1' : '0.4';
        el.innerHTML = `<span class="sk-name">${skData.name}</span><span style="font-size:10px;color:#7a8a9e">${skData.desc}</span><br><span style="font-size:9px;color:#a569bd">MP:${skData.mp} AP:${(skData as any).ap ?? 3}</span>`;
        this.skillAreaEl.appendChild(el);
      }
    } else {
      // Show a single tooltip for the hovered action
      this.skillAreaEl.innerHTML = `<div style="padding:6px;font-size:11px;color:#ccc4b0">${action.label} ${action.disabled ? '(사용 불가)' : ''}<br><span style="color:#a569bd">AP: ${action.costAP}</span></div>`;
    }
  }

  private onRingMenuHoverEnd(): void {
    this.skillAreaEl.innerHTML = '';
  }

  // ─────────────────────── Info box ───────────────────────

  private renderInfo(state: BattleState, unitId: string): void {
    const u = StateQuery.unit(state, unitId);
    if (!u) { this.infoBoxEl.innerHTML = '유닛을 선택하세요.'; return; }
    const terKey  = state.mapData.terrain[u.y]?.[u.x] ?? 'plain';
    const terData = (terrainJson as Array<{ key: string; name: string; defBonus: number; atkBonus: number }>)
      .find(t => t.key === terKey);

    const hasActed = u.moved || u.acted;

    this.infoBoxEl.innerHTML = `
      <div style="color:#e8cc78;font-size:12px;margin-bottom:3px">${u.name} <span style="font-size:9px;opacity:.7">${u.job}</span></div>
      <div class="stat-row"><span>HP</span><span>${Math.max(0, u.hp)}/${u.maxHp}</span></div>
      <div class="stat-row"><span>MP</span><span>${u.mp}/${u.maxMp}</span></div>
      <div class="stat-row"><span>AP</span><span style="color:#c39bd3">${u.currentAP}/${u.maxAP}</span></div>
      <div class="stat-row"><span>CT</span><span style="color:#4ab3e0">${u.ct}</span></div>
      <div class="stat-row"><span>ATK/DEF/SPD/SKL</span><span>${u.atk}/${u.def}/${u.spd}/${u.skl}</span></div>
      <div class="stat-row"><span>지형: ${terData?.name ?? terKey}</span><span>DEF+${terData?.defBonus ?? 0}</span></div>
      ${u.buffs.length ? `<div style="color:#4ab3e0;font-size:9px">Buffs: ${u.buffs.map(b => `${b.stat}${b.val > 0 ? '+' : ''}${b.val}(${b.dur}턴)`).join(', ')}</div>` : ''}
    `;
  }

  // ─────────────────────── Log ───────────────────────

  appendLog(text: string, cls: string): void {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = text;
    this.logEl.appendChild(d);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    while (this.logEl.children.length > 80) this.logEl.removeChild(this.logEl.firstChild!);
  }

  // ─────────────────────── Combat Preview ───────────────────────

  private onCombatPreview(preview: CombatPreview | null, target?: UnitInstance): void {
    if (!preview || !target) { this.hidePreview(); return; }

    const { baseDmg, critChance, affMult } = preview;
    const expectedHp = Math.max(0, target.hp - baseDmg);
    const kill = expectedHp <= 0;

    let affText = '';
    if (affMult > 1.05) affText = ' <span style="color:#2ecc71;font-size:9px">(상성 우위)</span>';
    else if (affMult < 1) affText = ' <span style="color:#e74c3c;font-size:9px">(상성 열위)</span>';

    this.previewBoxEl.innerHTML = `
      <div class="pv-title">🎯 ${target.name} 공격 예상</div>
      <div class="pv-row"><span style="color:#7a8a9e">예상 피해</span><span class="pv-dmg">${baseDmg}${affText}</span></div>
      <div class="pv-row"><span style="color:#7a8a9e">치명타 확률</span><span class="pv-crit">${Math.round(critChance * 100)}%</span></div>
      <div class="pv-row" style="margin-top:6px;padding-top:6px;border-top:1px solid #242d3d;">
        <span style="color:#7a8a9e">예상 HP</span>
        <span style="color:#ccc4b0">${target.hp} → <span style="color:${kill ? '#e74c3c' : '#ccc4b0'}">${expectedHp}</span></span>
      </div>
      ${kill ? '<div class="pv-kill">💀 처치 가능</div>' : ''}
    `;
    this.previewBoxEl.classList.add('show');
  }

  private hidePreview(): void {
    this.previewBoxEl.classList.remove('show');
  }
}
