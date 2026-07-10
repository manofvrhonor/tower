/* global AFRAME, CONFIG, THREE */

/**
 * comic-slides — PNG-слайды (start / travel / victory).
 *
 * CONFIG.comic.slideDurationMs — смена для travel/victory.
 * sequences[].files — список PNG; start + animated → startAnim (пояс → слот → улёт).
 * Смена кадров: улёт и влёт следующей параллельно (без паузы).
 * API: playSequence(id, onDone), playSequenceChain([ids], onDone).
 * Boot до меню — boot-intro.js. Не называть метод play().
 */
AFRAME.registerComponent('comic-slides', {
  schema: {},

  init: function () {
    this._shown = false;
    this._slideIndex = 0;
    this._slideUrls = [];
    this._onDone = null;
    this._timerId = null;
    this._root = null;
    this._plane = null;
    this._planeOut = null;
    this._handEls = [];
    this._ignoreTriggerUntil = 0;
    this._chain = null;
    this._chainIdx = 0;
    this._renderOrder = 55;

    this._animMode = false;
    this._phase = null;
    this._phaseT = 0;
    this._swayT = 0;
    this._crossDoneIn = false;
    this._crossDoneOut = false;
    this._waistLocal = new THREE.Vector3();
    this._flyOutLocal = new THREE.Vector3();
    this._tmpWorld = new THREE.Vector3();
    this._basePos = new THREE.Vector3(0, 0, 0);
    this._baseRot = { x: 0, y: 0, z: 0 };

    this._onTrigger = this._onTrigger.bind(this);
    this._onCancel = this._onCancel.bind(this);
    this._onKey = this._onKey.bind(this);

    this._build();
    this._bindHands();
    this._exposeApi();

    this.el.sceneEl.addEventListener('return-to-menu', this._onCancel);
  },

  remove: function () {
    this.hide(true);
    this._unbindHands();
    this._unbindKeys();
    this.el.sceneEl.removeEventListener('return-to-menu', this._onCancel);
    delete window.playComicSlides;
    delete window.playComicChain;
    delete window.hideComicSlides;
    delete window.isComicSlidesOpen;
  },

  _cfg: function () {
    return (typeof CONFIG !== 'undefined' && CONFIG.comic) || {};
  },

  _startAnimCfg: function () {
    return this._cfg().startAnim || {};
  },

  _durationMs: function () {
    var ms = this._cfg().slideDurationMs;
    return ms !== undefined ? ms : 8000;
  },

  _seqCfg: function (id) {
    return (this._cfg().sequences || {})[id] || null;
  },

  _isAnimatedSeq: function (seqId) {
    var sc = this._seqCfg(seqId);
    if (sc && sc.animated) return true;
    return seqId === 'start';
  },

  isShowing: function () {
    return this._shown;
  },

  _exposeApi: function () {
    var self = this;
    window.playComicSlides = function (id, cb) { self.playSequence(id, cb); };
    window.playComicChain = function (ids, cb) { self.playSequenceChain(ids, cb); };
    window.hideComicSlides = function () { self.hide(true); };
    window.isComicSlidesOpen = function () { return self._shown; };
  },

  _build: function () {
    var c = this._cfg();
    var w = c.panelWidth !== undefined ? c.panelWidth : 2.4;
    var h = c.panelHeight !== undefined ? c.panelHeight : 1.6;
    var pos = this._menuPos();

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'comic-slides-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('rotation', '0 0 0');
    this._root.setAttribute('visible', false);
    this.el.sceneEl.appendChild(this._root);

    this._plane = this._makePlane(w, h, this._renderOrder);
    this._planeOut = this._makePlane(w, h, this._renderOrder - 1);
    this._planeOut.setAttribute('visible', false);
    this._root.appendChild(this._plane);
    this._root.appendChild(this._planeOut);
  },

  _makePlane: function (w, h, renderOrder) {
    var plane = document.createElement('a-plane');
    plane.setAttribute('width', w);
    plane.setAttribute('height', h);
    plane.setAttribute('position', '0 0 0');
    plane.setAttribute('material', {
      color: '#111111',
      transparent: true,
      alphaTest: 0.05,
      shader: 'flat',
      side: 'double',
      depthTest: false,
      depthWrite: false,
      renderOrder: renderOrder,
    });
    this._applyDrawOrder(plane, renderOrder);
    return plane;
  },

  _menuPos: function () {
    var menuCfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    return menuCfg.worldPosition || { x: 0, y: 1.55, z: -0.65 };
  },

  _applyDrawOrder: function (el, renderOrder) {
    var ro = renderOrder !== undefined ? renderOrder : this._renderOrder;
    var apply = function () {
      var mesh = el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      mesh.material.depthTest = false;
      mesh.material.depthWrite = false;
      mesh.renderOrder = ro;
    };
    if (el.hasLoaded) apply();
    else el.addEventListener('loaded', apply, { once: true });
  },

  _setSlideSrc: function (url, plane) {
    var el = plane || this._plane;
    if (!el || !url) return;
    var ro = el === this._planeOut ? this._renderOrder - 1 : this._renderOrder;
    el.setAttribute('material', {
      src: url,
      color: '#ffffff',
      transparent: true,
      alphaTest: 0.02,
      shader: 'flat',
      side: 'double',
      depthTest: false,
      depthWrite: false,
      renderOrder: ro,
    });
    this._applyDrawOrder(el, ro);
  },

  _urlsFor: function (seqId) {
    var sc = this._seqCfg(seqId);
    if (!sc || !sc.folder) return [];
    var files = sc.files || [];
    var out = [];
    for (var i = 0; i < files.length; i++) out.push(sc.folder + files[i]);
    return out;
  },

  _bindHands: function () {
    var ids = ['leftHand', 'rightHand'];
    this._handEls = [];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      this._handEls.push(el);
      el.addEventListener('triggerdown', this._onTrigger);
    }
  },

  _unbindHands: function () {
    for (var i = 0; i < this._handEls.length; i++) {
      this._handEls[i].removeEventListener('triggerdown', this._onTrigger);
    }
    this._handEls = [];
  },

  _bindKeys: function () {
    window.addEventListener('keydown', this._onKey);
  },

  _unbindKeys: function () {
    window.removeEventListener('keydown', this._onKey);
  },

  _onKey: function (ev) {
    if (!this._shown || !this._animMode) return;
    if (ev.code === 'Space' || ev.code === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this._onTrigger();
    }
  },

  _setSlowMo: function (on) {
    var sys = this.el.sceneEl && this.el.sceneEl.systems['time-scale'];
    if (sys && typeof sys.setTravelMenuSlowMo === 'function') {
      sys.setTravelMenuSlowMo(on);
    }
  },

  _getVfx: function () {
    return this.el.sceneEl && this.el.sceneEl.components['menu-backdrop-vfx'];
  },

  _syncPose: function () {
    var pos = this._menuPos();
    var menu = this.el.sceneEl.components['game-menu'];
    if (menu && menu._root) {
      if (typeof menu._facePlayer === 'function') menu._facePlayer();
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

  _clearTimer: function () {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  },

  _armTimer: function () {
    var self = this;
    this._clearTimer();
    this._timerId = setTimeout(function () {
      self._timerId = null;
      self._advance();
    }, this._durationMs());
  },

  _easeOutCubic: function (t) {
    var u = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - u, 3);
  },

  _setPlaneOpacity: function (plane, opacity) {
    var el = plane || this._plane;
    if (!el) return;
    var mesh = el.getObject3D('mesh');
    var op = Math.max(0, Math.min(1, opacity));
    if (mesh && mesh.material) {
      mesh.material.opacity = op;
      mesh.material.transparent = true;
      mesh.material.needsUpdate = true;
    }
    var mat = el.getAttribute('material') || {};
    mat.opacity = op;
    mat.transparent = true;
    el.setAttribute('material', mat);
  },

  _resetPlaneRest: function (plane) {
    var el = plane || this._plane;
    if (!el) return;
    el.setAttribute('position', '0 0 0');
    el.setAttribute('rotation', '0 0 0');
    el.setAttribute('scale', '1 1 1');
    this._setPlaneOpacity(el, 1);
    if (el === this._plane) {
      this._basePos.set(0, 0, 0);
      this._baseRot.x = 0;
      this._baseRot.y = 0;
      this._baseRot.z = 0;
    }
  },

  _hidePlaneOut: function () {
    if (!this._planeOut) return;
    this._planeOut.setAttribute('visible', false);
    this._resetPlaneRest(this._planeOut);
  },

  /** Пояс игрока → local coords comic-root. */
  _computeWaistLocal: function () {
    var a = this._startAnimCfg();
    var waistY = a.waistY !== undefined ? a.waistY : 0.95;
    var cam = document.querySelector('#player a-camera') || document.querySelector('[camera]');
    var player = document.getElementById('player');
    var wx = 0;
    var wz = 0;
    if (cam && cam.object3D) {
      cam.object3D.getWorldPosition(this._tmpWorld);
      wx = this._tmpWorld.x;
      wz = this._tmpWorld.z;
    } else if (player && player.object3D) {
      player.object3D.getWorldPosition(this._tmpWorld);
      wx = this._tmpWorld.x;
      wz = this._tmpWorld.z;
    }
    this._tmpWorld.set(wx, waistY, wz);
    if (this._root && this._root.object3D) {
      this._root.object3D.updateMatrixWorld(true);
      this._root.object3D.worldToLocal(this._tmpWorld);
    }
    this._waistLocal.copy(this._tmpWorld);
  },

  _computeFlyOutLocal: function () {
    var a = this._startAnimCfg();
    var dist = a.flyOutDist !== undefined ? a.flyOutDist : 2.4;
    // От слота дальше по направлению «от пояса» (вдаль от игрока).
    var dir = this._tmpWorld.copy(this._basePos).sub(this._waistLocal);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    else dir.normalize();
    this._flyOutLocal.copy(this._basePos).addScaledVector(dir, dist);
  },

  _enterPreamble: function () {
    this._phase = 'preamble';
    this._phaseT = 0;
    this._root.setAttribute('visible', true);
    if (this._plane) this._plane.setAttribute('visible', false);
    this._hidePlaneOut();
    var vfx = this._getVfx();
    var a = this._startAnimCfg();
    var sparksMs = a.sparksMs !== undefined ? a.sparksMs : 2000;
    if (vfx && typeof vfx.fadeMenuSparks === 'function') {
      vfx.fadeMenuSparks(1, sparksMs);
    } else if (vfx && typeof vfx.setMenuActive === 'function') {
      vfx.setMenuActive(true);
    }
    console.log('[comic-slides] start preamble sparks', sparksMs);
  },

  _beginSlideFlyIn: function () {
    var url = this._slideUrls[this._slideIndex];
    this._setSlideSrc(url, this._plane);
    this._syncPose();
    this._computeWaistLocal();
    this._phase = 'flyIn';
    this._phaseT = 0;
    this._swayT = 0;
    if (this._plane) this._plane.setAttribute('visible', true);
    this._applyFlyIn(0);
    console.log('[comic-slides]', this._slideIndex + 1, '/', this._slideUrls.length, 'flyIn');
  },

  _applyFlyIn: function (u) {
    var a = this._startAnimCfg();
    var e = this._easeOutCubic(u);
    var startSc = a.startScale !== undefined ? a.startScale : 0.08;
    var arcZ = a.arcRotZ !== undefined ? a.arcRotZ : -18;
    var arcY = a.arcRotY !== undefined ? a.arcRotY : 12;
    var turns = a.spinTurns !== undefined ? a.spinTurns : 0.35;
    var scE = e < 0.85 ? e / 0.85 : 1 + 0.05 * Math.sin(((e - 0.85) / 0.15) * Math.PI);
    var sc = startSc + (1 - startSc) * scE;
    var wx = this._waistLocal.x;
    var wy = this._waistLocal.y;
    var wz = this._waistLocal.z;
    var x = wx + (0 - wx) * e;
    var y = wy + (0 - wy) * e;
    var z = wz + (0 - wz) * e;
    var rotY = arcY * (1 - e);
    var rotZ = (arcZ + turns * 360) * (1 - e);
    this._plane.setAttribute('position', x + ' ' + y + ' ' + z);
    this._plane.setAttribute('rotation', '0 ' + rotY + ' ' + rotZ);
    this._plane.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
    this._setPlaneOpacity(this._plane, Math.min(1, e * 1.3));
    this._basePos.set(x, y, z);
    this._baseRot.x = 0;
    this._baseRot.y = rotY;
    this._baseRot.z = rotZ;
    var swayU = Math.max(0, Math.min(1, (u - 0.55) / 0.45));
    if (swayU > 0) this._applySway(swayU);
  },

  _applySway: function (amp) {
    var a = this._startAnimCfg();
    var fade = this._easeOutCubic(Math.max(0, Math.min(1, amp)));
    var ax = (a.swayRotX !== undefined ? a.swayRotX : 2.5) * fade;
    var ay = (a.swayRotY !== undefined ? a.swayRotY : 3.5) * fade;
    var az = (a.swayRotZ !== undefined ? a.swayRotZ : 2) * fade;
    var px = (a.swayPosX !== undefined ? a.swayPosX : 0.008) * fade;
    var py = (a.swayPosY !== undefined ? a.swayPosY : 0.006) * fade;
    var t = this._swayT;
    var rx = this._baseRot.x + ax * Math.sin(t * 0.9);
    var ry = this._baseRot.y + ay * Math.sin(t * 0.7 + 0.9);
    var rz = this._baseRot.z + az * Math.sin(t * 1.05 + 0.4);
    var ox = this._basePos.x + px * Math.sin(t * 0.65 + 0.5);
    var oy = this._basePos.y + py * Math.sin(t * 0.8 + 1.2);
    var oz = this._basePos.z;
    this._plane.setAttribute('position', ox + ' ' + oy + ' ' + oz);
    this._plane.setAttribute('rotation', rx + ' ' + ry + ' ' + rz);
  },

  _applyFlyOutOn: function (plane, u) {
    if (!plane) return;
    var a = this._startAnimCfg();
    var e = this._easeOutCubic(u);
    var endSc = a.flyOutScale !== undefined ? a.flyOutScale : 0.04;
    var sc = 1 + (endSc - 1) * e;
    var x = 0 + (this._flyOutLocal.x - 0) * e;
    var y = 0 + (this._flyOutLocal.y - 0) * e;
    var z = 0 + (this._flyOutLocal.z - 0) * e;
    var rotY = 12 * e;
    var rotZ = -25 * e;
    plane.setAttribute('position', x + ' ' + y + ' ' + z);
    plane.setAttribute('rotation', '0 ' + rotY + ' ' + rotZ);
    plane.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
    this._setPlaneOpacity(plane, 1 - e);
  },

  _enterHold: function () {
    this._phase = 'hold';
    this._phaseT = 0;
    this._hidePlaneOut();
    this._basePos.set(0, 0, 0);
    this._baseRot.x = 0;
    this._baseRot.y = 0;
    this._baseRot.z = 0;
    this._plane.setAttribute('position', '0 0 0');
    this._plane.setAttribute('rotation', '0 0 0');
    this._plane.setAttribute('scale', '1 1 1');
    this._setPlaneOpacity(this._plane, 1);
  },

  /**
   * Улёт + сразу влёт следующей (без паузы). Последний кадр — только улёт.
   */
  _enterFlyOut: function () {
    this._computeWaistLocal();
    this._basePos.set(0, 0, 0);
    this._computeFlyOutLocal();
    this._baseRot.x = 0;
    this._baseRot.y = 0;
    this._baseRot.z = 0;

    var next = this._slideIndex + 1;
    var curUrl = this._slideUrls[this._slideIndex];

    // Текущая → planeOut (улетает).
    this._setSlideSrc(curUrl, this._planeOut);
    this._planeOut.setAttribute('visible', true);
    this._planeOut.setAttribute('position', '0 0 0');
    this._planeOut.setAttribute('rotation', '0 0 0');
    this._planeOut.setAttribute('scale', '1 1 1');
    this._setPlaneOpacity(this._planeOut, 1);

    if (next >= this._slideUrls.length) {
      this._plane.setAttribute('visible', false);
      this._phase = 'flyOut';
      this._phaseT = 0;
      this._crossDoneIn = true;
      this._crossDoneOut = false;
      return;
    }

    // Следующая сразу с пояса — параллельно улёту.
    this._slideIndex = next;
    this._setSlideSrc(this._slideUrls[next], this._plane);
    this._plane.setAttribute('visible', true);
    this._phase = 'cross';
    this._phaseT = 0;
    this._swayT = 0;
    this._crossDoneIn = false;
    this._crossDoneOut = false;
    this._applyFlyIn(0);
    this._applyFlyOutOn(this._planeOut, 0);
    console.log('[comic-slides]', next + 1, '/', this._slideUrls.length, 'cross');
  },

  tick: function (time, delta) {
    if (!this._shown || !this._animMode || !this._phase) return;
    var dt = (delta || 16) / 1000;
    var a = this._startAnimCfg();
    this._phaseT += dt;
    if (this._phase === 'hold' || this._phase === 'flyIn' || this._phase === 'cross') {
      this._swayT += dt;
    }

    if (this._phase === 'preamble') {
      var sparksMs = (a.sparksMs !== undefined ? a.sparksMs : 2000) / 1000;
      if (this._phaseT >= sparksMs) this._beginSlideFlyIn();
      return;
    }

    if (this._phase === 'flyIn') {
      var flyIn = (a.flyInMs !== undefined ? a.flyInMs : 1000) / 1000;
      var uIn = Math.min(1, this._phaseT / Math.max(0.001, flyIn));
      this._applyFlyIn(uIn);
      if (uIn >= 1) this._enterHold();
      return;
    }

    if (this._phase === 'hold') {
      this._applySway(1);
      var hold = (a.holdMs !== undefined ? a.holdMs : 7000) / 1000;
      if (this._phaseT >= hold) this._enterFlyOut();
      return;
    }

    if (this._phase === 'cross') {
      var flyInC = (a.flyInMs !== undefined ? a.flyInMs : 1000) / 1000;
      var flyOutC = (a.flyOutMs !== undefined ? a.flyOutMs : 900) / 1000;
      var uInC = Math.min(1, this._phaseT / Math.max(0.001, flyInC));
      var uOutC = Math.min(1, this._phaseT / Math.max(0.001, flyOutC));
      if (uInC >= 1) {
        this._crossDoneIn = true;
        this._basePos.set(0, 0, 0);
        this._baseRot.x = 0;
        this._baseRot.y = 0;
        this._baseRot.z = 0;
        this._applySway(1);
      } else {
        this._applyFlyIn(uInC);
      }
      this._applyFlyOutOn(this._planeOut, uOutC);
      if (uOutC >= 1) {
        this._crossDoneOut = true;
        this._hidePlaneOut();
      }
      if (this._crossDoneIn && this._crossDoneOut) this._enterHold();
      return;
    }

    if (this._phase === 'flyOut') {
      var flyOut = (a.flyOutMs !== undefined ? a.flyOutMs : 900) / 1000;
      var uOut = Math.min(1, this._phaseT / Math.max(0.001, flyOut));
      this._applyFlyOutOn(this._planeOut, uOut);
      if (uOut >= 1) this._finishSequence();
    }
  },

  _onTrigger: function () {
    if (!this._shown) return;
    if (performance.now() < this._ignoreTriggerUntil) return;
    this._ignoreTriggerUntil = performance.now() + 400;

    if (this._animMode) {
      this._skipAnimStep();
      return;
    }
    this._advance();
  },

  /** Trigger: preamble→flyIn; flyIn/hold→cross/out; cross→hold; flyOut→конец. */
  _skipAnimStep: function () {
    if (this._phase === 'preamble') {
      this._beginSlideFlyIn();
      return;
    }
    if (this._phase === 'flyIn' || this._phase === 'hold') {
      this._enterFlyOut();
      return;
    }
    if (this._phase === 'cross') {
      this._applyFlyIn(1);
      this._hidePlaneOut();
      this._enterHold();
      return;
    }
    if (this._phase === 'flyOut') {
      this._finishSequence();
    }
  },

  _advance: function () {
    if (!this._shown) return;
    this._ignoreTriggerUntil = performance.now() + 400;
    this._clearTimer();
    var next = this._slideIndex + 1;
    if (next >= this._slideUrls.length) {
      this._finishSequence();
      return;
    }
    this._slideIndex = next;
    this._setSlideSrc(this._slideUrls[next]);
    this._armTimer();
    console.log('[comic-slides]', next + 1, '/', this._slideUrls.length);
  },

  _finishSequence: function () {
    var chain = this._chain;
    var idx = this._chainIdx;
    var cb = this._onDone;

    if (chain && idx + 1 < chain.length) {
      this._chainIdx = idx + 1;
      this._begin(chain[this._chainIdx], null);
      return;
    }

    this._chain = null;
    this._chainIdx = 0;
    this._onDone = null;
    this.hide(true);
    if (typeof cb === 'function') cb();
  },

  _onCancel: function () {
    if (!this._shown) return;
    this._chain = null;
    this.hide(true);
  },

  _begin: function (seqId, onDone) {
    if (!seqId) {
      if (typeof onDone === 'function') onDone();
      else this._finishSequence();
      return;
    }
    var urls = this._urlsFor(seqId);
    if (!urls.length) {
      console.warn('[comic-slides] empty:', seqId);
      if (typeof onDone === 'function') onDone();
      else this._finishSequence();
      return;
    }
    if (onDone) this._onDone = onDone;
    this._slideUrls = urls;
    this._slideIndex = 0;
    this._shown = true;
    this._ignoreTriggerUntil = performance.now() + 500;
    this._syncPose();
    this._setSlowMo(true);

    if (this._isAnimatedSeq(seqId)) {
      this._animMode = true;
      this._bindKeys();
      this._resetPlaneRest();
      this._enterPreamble();
      console.log('[comic-slides] show animated', seqId, urls.length, 'slides');
      return;
    }

    this._animMode = false;
    this._phase = null;
    this._setSlideSrc(urls[0]);
    this._resetPlaneRest();
    this._root.setAttribute('visible', true);
    if (this._plane) this._plane.setAttribute('visible', true);
    this._armTimer();
    console.log('[comic-slides] show', seqId, urls.length, 'slides');
  },

  playSequence: function (seqId, onDone) {
    if (this._shown) this.hide(true);
    this._chain = null;
    this._chainIdx = 0;
    this._begin(seqId, onDone || null);
  },

  playSequenceChain: function (ids, onDone) {
    if (!ids || !ids.length) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    if (this._shown) this.hide(true);
    this._chain = ids.slice();
    this._chainIdx = 0;
    this._onDone = onDone || null;
    this._begin(ids[0], null);
  },

  hide: function (clearSlowMo) {
    this._shown = false;
    this._slideUrls = [];
    this._clearTimer();
    this._animMode = false;
    this._phase = null;
    this._phaseT = 0;
    this._crossDoneIn = false;
    this._crossDoneOut = false;
    this._unbindKeys();
    this._resetPlaneRest(this._plane);
    this._hidePlaneOut();
    if (this._plane) this._plane.setAttribute('visible', true);
    var vfx = this._getVfx();
    if (vfx && typeof vfx.setMenuActive === 'function') {
      vfx.setMenuActive(false);
    }
    if (!this._chain) this._onDone = null;
    if (this._root) this._root.setAttribute('visible', false);
    if (clearSlowMo !== false) this._setSlowMo(false);
  },

  sequenceForTravel: function (fromId, toId) {
    var map = (this._cfg().travelRoutes) || {};
    return map[(fromId || '') + '>' + (toId || '')] || null;
  },
});
