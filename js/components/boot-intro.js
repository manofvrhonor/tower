/* global AFRAME, CONFIG, THREE */

/**
 * boot-intro — заставка до меню сложности.
 *
 * Таймлайн (CONFIG.comic.boot): dark → sparks fade → logo_bg + backL/R →
 * сфера → logo scale + sway → hold → game-menu.showFromBoot().
 * Задние: logo_bg_back / logo_bg_back2, 70%, половинки слева/справа.
 * Принципы: slow-in/out, arcs, overshoot, follow-through, overlapping, secondary action.
 * Trigger / Space / click — скип всей заставки в меню.
 * Не называть метод play() (lifecycle A-Frame).
 */
AFRAME.registerComponent('boot-intro', {
  schema: {},

  init: function () {
    this._running = false;
    this._done = false;
    this._phase = 'idle';
    this._t = 0;
    this._ignoreTriggerUntil = 0;
    this._root = null;
    this._bg = null;
    this._bgBackL = null;
    this._bgBackR = null;
    this._logo = null;
    this._sphereEl = null;
    this._sphereComp = null;
    this._sphereBaseScale = 0;
    this._sphereBaseRadius = 0.001;
    this._sphereShown = false;
    this._bgScale = 1;
    this._bgRotZ = 0;
    this._bgBaseRotX = 0;
    this._bgBaseRotY = 0;
    this._bgBaseRotZ = 0;
    this._bgBaseZ = 0;
    this._bgBackBaseXL = 0;
    this._bgBackBaseXR = 0;
    this._bgBackBaseYL = 0;
    this._bgBackBaseYR = 0;
    this._bgBackBaseZ = -0.06;
    this._bgBackBaseRotXL = 0;
    this._bgBackBaseRotXR = 0;
    this._bgBackBaseRotYL = 0;
    this._bgBackBaseRotYR = 0;
    this._bgBackBaseRotZL = 0;
    this._bgBackBaseRotZR = 0;
    this._bgBackScale = 0.84;
    this._bgSwayT = 0;
    this._bgElapsed = 0;
    this._logoSwayT = 0;
    this._handEls = [];

    this._onTrigger = this._onTrigger.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onClick = this._onClick.bind(this);

    this._build();
    this._bindSkip();

    var self = this;
    var start = function () {
      if (self._done || self._running) return;
      self.startIntro();
    };
    if (this.el.sceneEl.hasLoaded) setTimeout(start, 200);
    else {
      this.el.sceneEl.addEventListener('loaded', function () {
        setTimeout(start, 200);
      });
    }
  },

  remove: function () {
    this._unbindSkip();
    this._teardownVisuals(true);
  },

  tick: function (time, delta) {
    if (!this._running) return;
    var dt = (delta || 16) / 1000;
    this._t += dt;
    this._tickPhase(dt, time);
  },

  _cfg: function () {
    return (typeof CONFIG !== 'undefined' && CONFIG.comic && CONFIG.comic.boot) || {};
  },

  _menuPos: function () {
    var menuCfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    return menuCfg.worldPosition || { x: 0, y: 1.55, z: -0.65 };
  },

  _vfx: function () {
    return this.el.sceneEl && this.el.sceneEl.components['menu-backdrop-vfx'];
  },

  _setSlowMo: function (on) {
    var sys = this.el.sceneEl && this.el.sceneEl.systems['time-scale'];
    if (sys && typeof sys.setTravelMenuSlowMo === 'function') {
      sys.setTravelMenuSlowMo(on);
    }
  },

  _build: function () {
    var c = this._cfg();
    var pos = this._menuPos();
    var pw = c.panelWidth !== undefined ? c.panelWidth : 2.4;
    var ph = c.panelHeight !== undefined ? c.panelHeight : 1.6;
    var lw = c.logoWidth !== undefined ? c.logoWidth : 1.35;
    var lh = c.logoHeight !== undefined ? c.logoHeight : 1.35;
    var folder = c.folder || 'assets/ui/comic/boot/logo/';
    var bgUrl = folder + (c.bgFile || 'logo_bg.png');
    var bgBackUrl = folder + (c.bgBackFile || 'logo_bg_back.png');
    var bgBackUrl2 = folder + (c.bgBackFile2 || 'logo_bg_back2.png');
    var logoUrl = folder + (c.logoFile || '01.png');
    var logoZ = c.logoZ !== undefined ? c.logoZ : 0.01;
    var energyZ = c.sphereZ !== undefined ? c.sphereZ : 0.02;
    var backScale = c.bgBackScale !== undefined ? c.bgBackScale : 0.84;
    var backZ = c.bgBackZ !== undefined ? c.bgBackZ : -0.06;
    var backW = pw * backScale;
    var backH = ph * backScale;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'boot-intro-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', false);
    this.el.sceneEl.appendChild(this._root);

    // Задние комиксы — за основным (depthTest; основной пишет depth → не просвечивают).
    this._bgBackL = this._makeBgPlane(backW, backH, bgBackUrl, 52, false);
    this._bgBackR = this._makeBgPlane(backW, backH, bgBackUrl2, 52, false);
    this._bgBackL.setAttribute('position', '0 0 ' + backZ);
    this._bgBackR.setAttribute('position', '0 0 ' + backZ);
    this._root.appendChild(this._bgBackL);
    this._root.appendChild(this._bgBackR);
    this._bgBackScale = backScale;
    this._bgBackBaseZ = backZ;

    // Основной комикс — depthWrite, чтобы закрывать задние.
    this._bg = this._makeBgPlane(pw, ph, bgUrl, 54, true);
    this._bg.setAttribute('position', '0 0 0');
    this._root.appendChild(this._bg);

    this._logo = document.createElement('a-plane');
    this._logo.setAttribute('width', lw);
    this._logo.setAttribute('height', lh);
    this._logo.setAttribute('position', '0 0 ' + logoZ);
    this._logo.setAttribute('scale', '0.001 0.001 0.001');
    this._logo.setAttribute('visible', false);
    this._logo.setAttribute('material', {
      src: logoUrl,
      color: '#ffffff',
      transparent: true,
      opacity: 1,
      alphaTest: 0.02,
      shader: 'flat',
      side: 'double',
      depthTest: false,
      depthWrite: false,
    });
    this._applyDrawOrder(this._logo, 55, false, false);
    this._bg.appendChild(this._logo);

    this._sphereEl = document.createElement('a-entity');
    this._sphereEl.setAttribute('position', '0 0 ' + energyZ);
    this._sphereEl.setAttribute('scale', '1 1 1');
    this._sphereEl.setAttribute('visible', false);
    this._sphereEl.setAttribute('boot-energy-sphere', {
      width: pw,
      height: ph,
    });
    this._bg.appendChild(this._sphereEl);
  },

  _makeBgPlane: function (w, h, src, order, depthWrite) {
    var el = document.createElement('a-plane');
    el.setAttribute('width', w);
    el.setAttribute('height', h);
    el.setAttribute('material', {
      src: src,
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      alphaTest: 0.05,
      shader: 'flat',
      side: 'front',
      depthTest: true,
      depthWrite: !!depthWrite,
    });
    this._applyDrawOrder(el, order, !!depthWrite);
    return el;
  },

  _applyDrawOrder: function (el, order, depthWrite, depthTest) {
    var write = !!depthWrite;
    // depthTest по умолчанию true; для лого/оверлеев — false, иначе обрезается о depth основного.
    var test = (depthTest !== undefined) ? !!depthTest : true;
    var apply = function () {
      var mesh = el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      mesh.material.depthTest = test;
      mesh.material.depthWrite = write;
      mesh.material.transparent = true;
      mesh.renderOrder = order;
    };
    if (el.hasLoaded) apply();
    else el.addEventListener('loaded', apply, { once: true });
  },

  _bindSkip: function () {
    var ids = ['leftHand', 'rightHand'];
    this._handEls = [];
    var i;
    for (i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      this._handEls.push(el);
      el.addEventListener('triggerdown', this._onTrigger);
    }
    window.addEventListener('keydown', this._onKey);
    this.el.sceneEl.addEventListener('click', this._onClick);
  },

  _unbindSkip: function () {
    var i;
    for (i = 0; i < this._handEls.length; i++) {
      this._handEls[i].removeEventListener('triggerdown', this._onTrigger);
    }
    this._handEls = [];
    window.removeEventListener('keydown', this._onKey);
    this.el.sceneEl.removeEventListener('click', this._onClick);
  },

  _onTrigger: function () {
    this._trySkip();
  },

  _onKey: function (ev) {
    if (!this._running) return;
    if (ev.code === 'Space' || ev.code === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this._trySkip();
    }
  },

  _onClick: function () {
    this._trySkip();
  },

  _trySkip: function () {
    if (!this._running || this._done) return;
    if (performance.now() < this._ignoreTriggerUntil) return;
    console.log('[boot-intro] skip → menu');
    this._finish(true);
  },

  _syncPose: function () {
    var pos = this._menuPos();
    var menu = this.el.sceneEl.components['game-menu'];
    if (menu && menu._root && typeof menu._facePlayer === 'function') {
      menu._facePlayer();
      var p = menu._root.getAttribute('position');
      var r = menu._root.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
      if (p) {
        this._root.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
        this._root.setAttribute('rotation', (r.x || 0) + ' ' + (r.y || 0) + ' ' + (r.z || 0));
        return;
      }
    }
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('rotation', '0 0 0');
  },

  startIntro: function () {
    if (this._running || this._done) return;
    this._running = true;
    this._done = false;
    this._t = 0;
    this._phase = 'dark';
    this._bgSwayT = 0;
    this._bgElapsed = 0;
    this._logoSwayT = 0;
    this._bgBaseRotX = 0;
    this._bgBaseRotY = 0;
    this._bgBaseRotZ = 0;
    this._bgBaseZ = 0;
    this._ignoreTriggerUntil = performance.now() + 400;
    this._syncPose();
    this._setSlowMo(true);
    this._root.setAttribute('visible', false);
    this._setPlaneOpacity(this._bg, 0);
    if (this._bgBackL) this._setPlaneOpacity(this._bgBackL, 0);
    if (this._bgBackR) this._setPlaneOpacity(this._bgBackR, 0);
    var c0 = this._cfg();
    var startSc0 = c0.bgStartScale !== undefined ? c0.bgStartScale : 0.08;
    var arcZ0 = c0.bgArcRotZ !== undefined ? c0.bgArcRotZ : -22;
    var arcY0 = c0.bgArcRotY !== undefined ? c0.bgArcRotY : 14;
    var turns0 = c0.bgSpinTurns !== undefined ? c0.bgSpinTurns : 1;
    var sphStart = c0.sphereStartScale !== undefined ? c0.sphereStartScale : 0;
    var zStart0 = c0.bgStartZ !== undefined ? c0.bgStartZ : 0.35;
    var pw0 = c0.panelWidth !== undefined ? c0.panelWidth : 2.4;
    var backSc0 = c0.bgBackScale !== undefined ? c0.bgBackScale : 0.84;
    var backZ0 = c0.bgBackZ !== undefined ? c0.bgBackZ : -0.06;
    var zExtra0 = c0.bgBackStartZExtra !== undefined ? c0.bgBackStartZExtra : 1;
    var endX0 = pw0 * 0.5;
    var endYL0 = c0.bgBackEndYL !== undefined ? c0.bgBackEndYL : 0.18;
    var endYR0 = c0.bgBackEndYR !== undefined ? c0.bgBackEndYR : -0.18;
    this._bgBackScale = backSc0;
    this._bgBackBaseZ = backZ0;
    this._bgBackBaseXL = -endX0;
    this._bgBackBaseXR = endX0;
    this._bgBackBaseYL = endYL0;
    this._bgBackBaseYR = endYR0;
    this._bg.setAttribute('scale', startSc0 + ' ' + startSc0 + ' ' + startSc0);
    this._bg.setAttribute('rotation', '0 ' + arcY0 + ' ' + (arcZ0 + turns0 * 360));
    this._bg.setAttribute('position', '0 0 ' + zStart0);
    this._bgBaseZ = zStart0;
    // Задние: старт в центре, +1м по Z, ребром 90°.
    var backStartZ0 = backZ0 + zStart0 + zExtra0;
    var startRYL0 = c0.bgBackStartRotYL !== undefined ? c0.bgBackStartRotYL : 90;
    var startRYR0 = c0.bgBackStartRotYR !== undefined ? c0.bgBackStartRotYR : -90;
    if (this._bgBackL) {
      this._bgBackL.setAttribute('scale', (startSc0 * backSc0) + ' ' + (startSc0 * backSc0) + ' ' + (startSc0 * backSc0));
      this._bgBackL.setAttribute('rotation', '0 ' + startRYL0 + ' 0');
      this._bgBackL.setAttribute('position', '0 0 ' + backStartZ0);
    }
    if (this._bgBackR) {
      this._bgBackR.setAttribute('scale', (startSc0 * backSc0) + ' ' + (startSc0 * backSc0) + ' ' + (startSc0 * backSc0));
      this._bgBackR.setAttribute('rotation', '0 ' + startRYR0 + ' 0');
      this._bgBackR.setAttribute('position', '0 0 ' + backStartZ0);
    }
    this._logo.setAttribute('visible', false);
    this._logo.setAttribute('scale', '0.001 0.001 0.001');
    this._logo.setAttribute('rotation', '0 0 0');
    this._logo.setAttribute('position', '0 0 ' + (c0.logoZ !== undefined ? c0.logoZ : 0.01));
    this._sphereEl.setAttribute('visible', false);
    this._sphereEl.setAttribute('scale', '1 1 1');
    this._sphereBaseScale = sphStart;
    this._sphereBaseRadius = 0.001;
    this._sphereShown = false;
    this._sphereComp = this._sphereEl.components['boot-energy-sphere'] || null;
    if (this._sphereComp && typeof this._sphereComp.setOrbRadius === 'function') {
      this._sphereComp.setOrbRadius(0.001);
    }
    console.log('[boot-intro] start');
  },

  _ms: function (key, fallback) {
    var c = this._cfg();
    return ((c[key] !== undefined ? c[key] : fallback) || 0) / 1000;
  },

  _tickPhase: function (dt, time) {
    var dark = this._ms('darkMs', 2000);
    var sparks = this._ms('sparksFadeMs', 5000);
    var bgFly = this._ms('bgFlyMs', 2000);
    var charge = this._ms('sphereChargeMs', 1000);
    var logoSc = this._ms('logoScaleMs', 1000);
    var hold = this._ms('holdMs', 2000);
    var early = this._ms('sphereAppearEarlyMs', 1000);

    var t0 = 0;
    var t1 = t0 + dark;
    var t2 = t1 + sparks;
    var t3 = t2 + bgFly;
    var t4 = t3 + charge;
    var t5 = t4 + logoSc;
    var t6 = t5 + hold;
    var sphereAt = Math.max(t2, t3 - early);
    var growDur = Math.max(0.001, (t4 - sphereAt));

    if (this._t < t1) {
      this._phase = 'dark';
      return;
    }
    if (this._t < t2) {
      if (this._phase !== 'sparks') {
        this._phase = 'sparks';
        var vfx = this._vfx();
        if (vfx && typeof vfx.fadeMenuSparks === 'function') {
          vfx.fadeMenuSparks(1, this._cfg().sparksFadeMs || 5000);
        } else if (vfx) {
          vfx.setMenuActive(true);
        }
        console.log('[boot-intro] sparks');
      }
      return;
    }
    if (this._t < t3) {
      if (this._phase !== 'bg') {
        this._phase = 'bg';
        this._root.setAttribute('visible', true);
        this._sphereEl.setAttribute('visible', false);
        console.log('[boot-intro] bg fly');
      }
      var uBg = (this._t - t2) / Math.max(0.001, bgFly);
      this._bgSwayT += dt;
      this._bgElapsed = this._t - t2;
      this._animBgFly(uBg);
      this._animBgBackFly(this._bgElapsed, bgFly);
      // Сфера чуть раньше конца влёта фона.
      if (this._t >= sphereAt) {
        if (!this._sphereShown) {
          this._sphereShown = true;
          this._sphereEl.setAttribute('visible', true);
          this._sphereComp = this._sphereEl.components['boot-energy-sphere'] || null;
          this._growSphere(0);
          console.log('[boot-intro] sphere early appear');
        }
        this._growSphere((this._t - sphereAt) / growDur);
        this._pulseSphere(time, 1.2);
      }
      return;
    }
    if (this._t < t4) {
      if (this._phase !== 'charge') {
        this._phase = 'charge';
        this._animBgFly(1);
        if (!this._sphereShown) {
          this._sphereShown = true;
          this._sphereEl.setAttribute('visible', true);
          this._sphereComp = this._sphereEl.components['boot-energy-sphere'] || null;
        }
        console.log('[boot-intro] sphere grow');
      }
      this._bgSwayT += dt;
      this._bgElapsed = this._t - t2;
      this._animBgBackFly(this._bgElapsed, bgFly);
      this._animBgSway(this._bgSwayT, 1);
      this._growSphere((this._t - sphereAt) / growDur);
      this._pulseSphere(time, 1.55);
      return;
    }
    if (this._t < t5) {
      if (this._phase !== 'logo') {
        this._phase = 'logo';
        this._logo.setAttribute('visible', true);
        this._logoSwayT = 0;
        this._growSphere(1);
        console.log('[boot-intro] logo scale');
      }
      this._bgSwayT += dt;
      this._logoSwayT += dt;
      this._bgElapsed = this._t - t2;
      this._animBgBackFly(this._bgElapsed, bgFly);
      this._animBgSway(this._bgSwayT, 1);
      this._animLogoScale((this._t - t4) / Math.max(0.001, logoSc));
      this._animLogoSway(this._logoSwayT, (this._t - t4) / Math.max(0.001, logoSc));
      this._pulseSphere(time, 1.25);
      return;
    }
    if (this._t < t6) {
      if (this._phase !== 'hold') {
        this._phase = 'hold';
        this._animLogoScale(1);
      }
      this._bgSwayT += dt;
      this._logoSwayT += dt;
      this._bgElapsed = this._t - t2;
      this._animBgBackFly(this._bgElapsed, bgFly);
      this._animBgSway(this._bgSwayT, 1);
      this._animLogoSway(this._logoSwayT, 1);
      this._pulseSphere(time, 1.4);
      return;
    }
    this._finish(false);
  },

  _animBgFly: function (u) {
    var c = this._cfg();
    var t = Math.max(0, Math.min(1, u));
    // Один easing на scale+поворот — иначе scale доезжает раньше и «крутится на месте».
    var e = this._easeOutCubic(t);
    var startSc = c.bgStartScale !== undefined ? c.bgStartScale : 0.08;
    var arcZ = c.bgArcRotZ !== undefined ? c.bgArcRotZ : -22;
    var arcY = c.bgArcRotY !== undefined ? c.bgArcRotY : 14;
    var turns = c.bgSpinTurns !== undefined ? c.bgSpinTurns : 1;
    // Лёгкий overshoot scale в самом конце (exaggeration), без раннего «уже 100%».
    var scE = e < 0.85 ? e / 0.85 : 1 + 0.06 * Math.sin(((e - 0.85) / 0.15) * Math.PI);
    var sc = startSc + (1 - startSc) * scE;
    // Arc + обороты сходятся вместе с ростом.
    var rotY = arcY * (1 - e);
    var rotZ = (arcZ + turns * 360) * (1 - e);
    // Чуть спереди → на место (ощущение влёта, не только spin).
    var zStart = c.bgStartZ !== undefined ? c.bgStartZ : 0.35;
    var z = zStart * (1 - e);
    this._bg.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
    this._setPlaneOpacity(this._bg, Math.min(1, e * 1.25));
    this._bgScale = sc;
    this._bgRotZ = rotZ;
    this._bgBaseRotX = 0;
    this._bgBaseRotY = rotY;
    this._bgBaseRotZ = rotZ;
    this._bgBaseZ = z;
    // Sway нарастает к концу влёта (не спорит с большими оборотами).
    var swayU = Math.max(0, Math.min(1, (t - 0.55) / 0.45));
    this._animBgSway(this._bgSwayT, swayU);
  },

  /**
   * Влёт одного заднего комикса.
   * Старт ребром (90°), небольшой проворот к финальному углу. u 0..1.
   */
  _animOneBgBack: function (el, u, side) {
    if (!el) return;
    var c = this._cfg();
    var pw = c.panelWidth !== undefined ? c.panelWidth : 2.4;
    var backSc = c.bgBackScale !== undefined ? c.bgBackScale : 0.84;
    var backZ = c.bgBackZ !== undefined ? c.bgBackZ : -0.06;
    var zExtra = c.bgBackStartZExtra !== undefined ? c.bgBackStartZExtra : 1;
    var endX = pw * 0.5;
    var endY = side < 0
      ? (c.bgBackEndYL !== undefined ? c.bgBackEndYL : 0.18)
      : (c.bgBackEndYR !== undefined ? c.bgBackEndYR : -0.18);
    var endRX = side < 0
      ? (c.bgBackEndRotXL !== undefined ? c.bgBackEndRotXL : -8)
      : (c.bgBackEndRotXR !== undefined ? c.bgBackEndRotXR : 8);
    var endRY = side < 0
      ? (c.bgBackEndRotYL !== undefined ? c.bgBackEndRotYL : 12)
      : (c.bgBackEndRotYR !== undefined ? c.bgBackEndRotYR : -12);
    var endRZ = side < 0
      ? (c.bgBackEndRotZL !== undefined ? c.bgBackEndRotZL : 6)
      : (c.bgBackEndRotZR !== undefined ? c.bgBackEndRotZR : -6);
    var startRY = side < 0
      ? (c.bgBackStartRotYL !== undefined ? c.bgBackStartRotYL : 90)
      : (c.bgBackStartRotYR !== undefined ? c.bgBackStartRotYR : -90);
    var startSc = c.bgStartScale !== undefined ? c.bgStartScale : 0.08;
    var zStart = c.bgStartZ !== undefined ? c.bgStartZ : 0.35;
    var tClamped = Math.max(0, Math.min(1, u));
    if (tClamped <= 0) {
      el.setAttribute('visible', false);
      this._setPlaneOpacity(el, 0);
      return;
    }
    el.setAttribute('visible', true);
    var eLin = this._easeOutCubic(tClamped);
    var scE = eLin < 0.85 ? eLin / 0.85 : 1 + 0.06 * Math.sin(((eLin - 0.85) / 0.15) * Math.PI);
    var sc = (startSc + (1 - startSc) * scE) * backSc;
    var z = backZ + (zStart + zExtra) * (1 - eLin);
    var op = Math.min(1, eLin * 1.25);
    var x = side * endX * eLin;
    var y = endY * eLin;
    // Проворот: 90° → финальный лёгкий угол (без полных оборотов).
    var rx = endRX * eLin;
    var ry = startRY + (endRY - startRY) * eLin;
    var rz = endRZ * eLin;
    el.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
    el.setAttribute('rotation', rx + ' ' + ry + ' ' + rz);
    el.setAttribute('position', x + ' ' + y + ' ' + z);
    this._setPlaneOpacity(el, op);
  },

  /** Задние: L +0.5с, R +1с; после прилёта — плавный fade-in качки (без рывка). */
  _animBgBackFly: function (elapsedSec, bgFlySec) {
    if (!this._bgBackL && !this._bgBackR) return;
    var c = this._cfg();
    var delayL = ((c.bgBackDelayLMs !== undefined ? c.bgBackDelayLMs : 500) || 0) / 1000;
    var delayR = ((c.bgBackDelayRMs !== undefined ? c.bgBackDelayRMs : 1000) || 0) / 1000;
    var dur = Math.max(0.001, bgFlySec || 2);
    var uL = (elapsedSec - delayL) / dur;
    var uR = (elapsedSec - delayR) / dur;
    var pw = c.panelWidth !== undefined ? c.panelWidth : 2.4;
    var endX = pw * 0.5;
    this._bgBackScale = c.bgBackScale !== undefined ? c.bgBackScale : 0.84;
    this._bgBackBaseZ = c.bgBackZ !== undefined ? c.bgBackZ : -0.06;
    this._bgBackBaseXL = -endX;
    this._bgBackBaseXR = endX;
    this._bgBackBaseYL = c.bgBackEndYL !== undefined ? c.bgBackEndYL : 0.18;
    this._bgBackBaseYR = c.bgBackEndYR !== undefined ? c.bgBackEndYR : -0.18;
    this._bgBackBaseRotXL = c.bgBackEndRotXL !== undefined ? c.bgBackEndRotXL : -8;
    this._bgBackBaseRotXR = c.bgBackEndRotXR !== undefined ? c.bgBackEndRotXR : 8;
    this._bgBackBaseRotYL = c.bgBackEndRotYL !== undefined ? c.bgBackEndRotYL : 12;
    this._bgBackBaseRotYR = c.bgBackEndRotYR !== undefined ? c.bgBackEndRotYR : -12;
    this._bgBackBaseRotZL = c.bgBackEndRotZL !== undefined ? c.bgBackEndRotZL : 6;
    this._bgBackBaseRotZR = c.bgBackEndRotZR !== undefined ? c.bgBackEndRotZR : -6;

    if (uL < 1) {
      this._animOneBgBack(this._bgBackL, uL, -1);
    } else {
      this._animOneBgBack(this._bgBackL, 1, -1);
      this._animBgBackSwayOne(this._bgBackL, -1, elapsedSec - delayL - dur);
    }
    if (uR < 1) {
      this._animOneBgBack(this._bgBackR, uR, 1);
    } else {
      this._animOneBgBack(this._bgBackR, 1, 1);
      this._animBgBackSwayOne(this._bgBackR, 1, elapsedSec - delayR - dur);
    }
  },

  /**
   * Тихое покачивание комикса (secondary action) поверх базового поворота влёта.
   * Амплитуды меньше, чем у лого. Задние — ещё тише, со сдвигом фазы.
   */
  _animBgSway: function (swayT, settleU) {
    var c = this._cfg();
    var fadeIn = this._easeOutCubic(Math.max(0, Math.min(1, settleU)));
    var ax = (c.bgSwayRotX !== undefined ? c.bgSwayRotX : 2.5) * fadeIn;
    var ay = (c.bgSwayRotY !== undefined ? c.bgSwayRotY : 3.5) * fadeIn;
    var az = (c.bgSwayRotZ !== undefined ? c.bgSwayRotZ : 2) * fadeIn;
    var px = (c.bgSwayPosX !== undefined ? c.bgSwayPosX : 0.008) * fadeIn;
    var py = (c.bgSwayPosY !== undefined ? c.bgSwayPosY : 0.006) * fadeIn;
    var baseZ = this._bgBaseZ !== undefined ? this._bgBaseZ : 0;
    var rx = (this._bgBaseRotX || 0) + ax * Math.sin(swayT * 0.9);
    var ry = (this._bgBaseRotY || 0) + ay * Math.sin(swayT * 0.7 + 0.9);
    var rz = (this._bgBaseRotZ || 0) + az * Math.sin(swayT * 1.05 + 0.4);
    var ox = px * Math.sin(swayT * 0.65 + 0.5);
    var oy = py * Math.sin(swayT * 0.8 + 1.2);
    this._bg.setAttribute('rotation', rx + ' ' + ry + ' ' + rz);
    this._bg.setAttribute('position', ox + ' ' + oy + ' ' + baseZ);
    // Задние качает _animBgBackFly → _animBgBackSwayOne (не здесь — иначе рывок).
  },

  /** Idle-качка одной задней карточки; ampFade 0→1 убирает рывок в момент прилёта. */
  _animBgBackSwayOne: function (el, side, idleT) {
    if (!el) return;
    var c = this._cfg();
    var fadeSec = (c.bgBackSwayFadeMs !== undefined ? c.bgBackSwayFadeMs : 700) / 1000;
    var ampFade = this._easeOutCubic(Math.max(0, Math.min(1, idleT / Math.max(0.001, fadeSec))));
    if (ampFade <= 0.001) {
      // Ещё на финале влёта — не трогаем (уже выставил _animOneBgBack).
      return;
    }
    var swayT = idleT;
    var ax = (c.bgBackSwayRotX !== undefined ? c.bgBackSwayRotX : 4.5) * ampFade;
    var ay = (c.bgBackSwayRotY !== undefined ? c.bgBackSwayRotY : 6) * ampFade;
    var az = (c.bgBackSwayRotZ !== undefined ? c.bgBackSwayRotZ : 3.5) * ampFade;
    var px = (c.bgBackSwayPosX !== undefined ? c.bgBackSwayPosX : 0.014) * ampFade;
    var py = (c.bgBackSwayPosY !== undefined ? c.bgBackSwayPosY : 0.02) * ampFade;
    var driftSp = c.bgBackDriftSpeed !== undefined ? c.bgBackDriftSpeed : 0.035;
    var driftMax = c.bgBackDriftMax !== undefined ? c.bgBackDriftMax : 0.16;
    var drift = Math.min(driftMax, idleT * driftSp) * ampFade;

    var sc = this._bgBackScale || 0.84;
    var z = this._bgBackBaseZ !== undefined ? this._bgBackBaseZ : -0.06;
    var x0 = side < 0
      ? (this._bgBackBaseXL !== undefined ? this._bgBackBaseXL : -1.2)
      : (this._bgBackBaseXR !== undefined ? this._bgBackBaseXR : 1.2);
    var y0 = side < 0
      ? (this._bgBackBaseYL !== undefined ? this._bgBackBaseYL : 0.18)
      : (this._bgBackBaseYR !== undefined ? this._bgBackBaseYR : -0.18);
    var brx = side < 0 ? (this._bgBackBaseRotXL || 0) : (this._bgBackBaseRotXR || 0);
    var bry = side < 0 ? (this._bgBackBaseRotYL || 0) : (this._bgBackBaseRotYR || 0);
    var brz = side < 0 ? (this._bgBackBaseRotZL || 0) : (this._bgBackBaseRotZR || 0);
    var phase = side < 0 ? 0.4 : 2.1;

    var rx = brx + ax * Math.sin(swayT * 0.85 + phase);
    var ry = bry + ay * Math.sin(swayT * 0.65 + phase + 0.9);
    var rz = brz + az * Math.sin(swayT * 1.05 + phase + 0.3);
    var ox = x0 + px * Math.sin(swayT * 0.55 + phase + 0.5);
    var oy = y0 + (side < 0 ? drift : -drift) + py * Math.sin(swayT * 0.75 + phase + 0.4);

    el.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
    el.setAttribute('rotation', rx + ' ' + ry + ' ' + rz);
    el.setAttribute('position', ox + ' ' + oy + ' ' + z);
  },

  _animBgBackSway: function () {
    // legacy no-op — качка идёт через _animBgBackSwayOne из _animBgBackFly
  },

  /**
   * Рост орба через радиус в UV (не scale mesh).
   * Пока R ≤ высоты панели — полный круг; дальше — обрезка краем картинки.
   */
  _growSphere: function (u) {
    var c = this._cfg();
    var sph = c.sphere || {};
    var baseR = sph.circleRadius !== undefined ? sph.circleRadius : 0.98;
    var startMul = c.sphereStartScale !== undefined ? c.sphereStartScale : 0;
    var endMul = c.sphereOrbScale !== undefined ? c.sphereOrbScale
      : (c.sphereEndScale !== undefined ? c.sphereEndScale : 1.15);
    var e = this._easeOutCubic(Math.max(0, Math.min(1, u)));
    var startR = Math.max(0.001, startMul * baseR);
    var endR = Math.max(0.001, endMul * baseR);
    this._sphereBaseRadius = startR + (endR - startR) * e;
    this._sphereBaseScale = this._sphereBaseRadius;
    this._sphereEl.setAttribute('scale', '1 1 1');
    if (this._sphereComp && typeof this._sphereComp.setOrbRadius === 'function') {
      this._sphereComp.setOrbRadius(this._sphereBaseRadius);
    }
  },

  _animLogoScale: function (u) {
    // Anticipation: чуть дольше мелкий, потом overshoot (exaggeration).
    var t = Math.max(0, Math.min(1, u));
    var e;
    if (t < 0.12) {
      e = this._easeInCubic(t / 0.12) * 0.08;
    } else {
      e = 0.08 + 0.92 * this._easeOutBack((t - 0.12) / 0.88);
    }
    // Squash & stretch на влёте.
    var stretch = 1 + 0.08 * Math.sin(Math.min(1, e) * Math.PI);
    var squash = 1 / Math.sqrt(stretch);
    var sx = Math.max(0.001, e * squash);
    var sy = Math.max(0.001, e * stretch);
    this._logo.setAttribute('scale', sx + ' ' + sy + ' ' + sx);
  },

  /**
   * Secondary action / follow-through: покачивание и поворот в пространстве
   * после появления лого.
   */
  _animLogoSway: function (swayT, settleU) {
    var c = this._cfg();
    var logoZ = c.logoZ !== undefined ? c.logoZ : 0.01;
    var amp = Math.min(1, Math.max(0, settleU));
    // Амплитуда нарастает к концу scale (follow-through), потом держится.
    var fadeIn = this._easeOutCubic(amp);
    var ax = (c.logoSwayRotX !== undefined ? c.logoSwayRotX : 7) * fadeIn;
    var ay = (c.logoSwayRotY !== undefined ? c.logoSwayRotY : 10) * fadeIn;
    var az = (c.logoSwayRotZ !== undefined ? c.logoSwayRotZ : 5) * fadeIn;
    var px = (c.logoSwayPosX !== undefined ? c.logoSwayPosX : 0.012) * fadeIn;
    var py = (c.logoSwayPosY !== undefined ? c.logoSwayPosY : 0.01) * fadeIn;
    // Разные частоты → живой, не механический ритм (appeal).
    var rx = ax * Math.sin(swayT * 1.35);
    var ry = ay * Math.sin(swayT * 0.95 + 0.7);
    var rz = az * Math.sin(swayT * 1.15 + 1.4);
    var ox = px * Math.sin(swayT * 0.85 + 0.3);
    var oy = py * Math.sin(swayT * 1.05 + 1.1);
    this._logo.setAttribute('rotation', rx + ' ' + ry + ' ' + rz);
    this._logo.setAttribute('position', ox + ' ' + oy + ' ' + logoZ);
  },

  _easeInCubic: function (t) {
    return t * t * t;
  },

  _easeOutCubic: function (t) {
    return 1 - Math.pow(1 - t, 3);
  },

  _easeInOutCubic: function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },

  _easeOutBack: function (t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  _setPlaneOpacity: function (el, opacity) {
    if (!el) return;
    var mesh = el.getObject3D('mesh');
    if (mesh && mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = opacity;
      // Основной пишет depth при почти полной непрозрачности — задние не просвечивают.
      if (el === this._bg) {
        mesh.material.depthTest = true;
        mesh.material.depthWrite = opacity >= 0.95;
      }
      mesh.material.needsUpdate = true;
    }
    el.setAttribute('material', 'opacity', opacity);
  },

  _pulseSphere: function (time, intensity) {
    var t = time * 0.001;
    // Два синуса разной частоты — органичный пульс (secondary action).
    var pulse = 0.78 + 0.28 * Math.sin(t * 1.73) + 0.14 * Math.sin(t * 4.5);
    var flicker = 0.94 + 0.06 * Math.sin(t * 9.0);
    var amp = intensity * pulse * flicker;

    if (this._sphereComp) {
      if (typeof this._sphereComp.setIntensity === 'function') {
        this._sphereComp.setIntensity(amp);
      }
      if (typeof this._sphereComp.setPulseDrive === 'function') {
        this._sphereComp.setPulseDrive(pulse * flicker);
      }
      if (this._sphereComp._uniforms) {
        var u = this._sphereComp._uniforms;
        var baseScroll = (this._cfg().sphere && this._cfg().sphere.scrollSpeed) || 1.25;
        if (u.uScrollSpeed) u.uScrollSpeed.value = baseScroll * (0.88 + 0.35 * pulse);
        if (u.uBandOpacity) {
          u.uBandOpacity.value = Math.min(1, 0.72 + 0.28 * amp);
        }
        if (u.uFresnelStrength) {
          var baseFr = (this._cfg().sphere && this._cfg().sphere.fresnelStrength) || 1.25;
          u.uFresnelStrength.value = baseFr * (0.85 + 0.25 * pulse * intensity);
        }
        if (u.uSparkleStrength) {
          var baseSp = (this._cfg().sphere && this._cfg().sphere.sparkleStrength) || 0.45;
          u.uSparkleStrength.value = baseSp * (0.8 + 0.4 * pulse * intensity);
        }
      }
    }
    // Пульс радиуса в UV; mesh остаётся = панель (маска).
    var rPulse = this._sphereBaseRadius * (0.97 + 0.05 * pulse * Math.min(intensity, 1.4));
    if (this._sphereComp && typeof this._sphereComp.setOrbRadius === 'function') {
      this._sphereComp.setOrbRadius(rPulse);
    }
    this._sphereEl.setAttribute('scale', '1 1 1');
  },

  _hideBootVisuals: function () {
    if (this._root) this._root.setAttribute('visible', false);
    if (this._sphereEl) this._sphereEl.setAttribute('visible', false);
  },

  _teardownVisuals: function (full) {
    this._hideBootVisuals();
    if (!full) return;
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    this._root = null;
  },

  _finish: function (skipped) {
    if (this._done) return;
    this._done = true;
    this._running = false;
    this._phase = 'done';
    this._hideBootVisuals();
    this._setSlowMo(false);

    // Искры не гасим — меню подхватит через showFromBoot (без затемнения).
    var menu = this.el.sceneEl.components['game-menu'];
    if (menu && typeof menu.showFromBoot === 'function') {
      menu.showFromBoot();
    } else {
      var vfx = this._vfx();
      if (vfx) vfx.setMenuActive(false);
    }
    console.log('[boot-intro] done → menu', skipped ? '(skip)' : '');
  },
});
