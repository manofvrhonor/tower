/* global AFRAME, CONFIG, THREE */

/**
 * comic-slides — PNG-слайды (start / travel / victory).
 *
 * CONFIG.comic.slideDurationMs — единое время смены.
 * sequences[].files — список PNG в папке (01.png…).
 * API: playSequence(id, onDone), playSequenceChain([ids], onDone).
 * Boot до меню — boot-intro.js (не этот компонент).
 * Плоскость в мире как game-menu (не на камере). Не называть метод play().
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
    this._handEls = [];
    this._ignoreTriggerUntil = 0;
    this._chain = null;
    this._chainIdx = 0;
    this._renderOrder = 55;

    this._onTrigger = this._onTrigger.bind(this);
    this._onCancel = this._onCancel.bind(this);

    this._build();
    this._bindHands();
    this._exposeApi();

    this.el.sceneEl.addEventListener('return-to-menu', this._onCancel);
  },

  remove: function () {
    this.hide(true);
    this._unbindHands();
    this.el.sceneEl.removeEventListener('return-to-menu', this._onCancel);
    delete window.playComicSlides;
    delete window.playComicChain;
    delete window.hideComicSlides;
    delete window.isComicSlidesOpen;
  },

  _cfg: function () {
    return (typeof CONFIG !== 'undefined' && CONFIG.comic) || {};
  },

  _durationMs: function () {
    var ms = this._cfg().slideDurationMs;
    return ms !== undefined ? ms : 8000;
  },

  _seqCfg: function (id) {
    return (this._cfg().sequences || {})[id] || null;
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

    this._plane = document.createElement('a-plane');
    this._plane.setAttribute('width', w);
    this._plane.setAttribute('height', h);
    this._plane.setAttribute('position', '0 0 0');
    this._plane.setAttribute('material', {
      color: '#111111',
      transparent: true,
      alphaTest: 0.05,
      shader: 'flat',
      side: 'double',
      depthTest: false,
      depthWrite: false,
      renderOrder: this._renderOrder,
    });
    this._applyDrawOrder(this._plane);
    this._root.appendChild(this._plane);
  },

  _menuPos: function () {
    var menuCfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    return menuCfg.worldPosition || { x: 0, y: 1.55, z: -0.65 };
  },

  _applyDrawOrder: function (el) {
    var ro = this._renderOrder;
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

  _setSlideSrc: function (url) {
    if (!this._plane || !url) return;
    // color: #fff — иначе текстура может затемняться; flat = без освещения сцены.
    this._plane.setAttribute('material', {
      src: url,
      color: '#ffffff',
      transparent: true,
      alphaTest: 0.02,
      shader: 'flat',
      side: 'double',
      depthTest: false,
      depthWrite: false,
      renderOrder: this._renderOrder,
    });
    this._applyDrawOrder(this._plane);
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

  _setSlowMo: function (on) {
    var sys = this.el.sceneEl && this.el.sceneEl.systems['time-scale'];
    if (sys && typeof sys.setTravelMenuSlowMo === 'function') {
      sys.setTravelMenuSlowMo(on);
    }
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

  _onTrigger: function () {
    if (!this._shown) return;
    if (performance.now() < this._ignoreTriggerUntil) return;
    this._advance();
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
    this._setSlideSrc(urls[0]);
    this._root.setAttribute('visible', true);
    this._setSlowMo(true);
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
    if (!this._chain) this._onDone = null;
    if (this._root) this._root.setAttribute('visible', false);
    if (clearSlowMo !== false) this._setSlowMo(false);
  },

  sequenceForTravel: function (fromId, toId) {
    var map = (this._cfg().travelRoutes) || {};
    return map[(fromId || '') + '>' + (toId || '')] || null;
  },
});
