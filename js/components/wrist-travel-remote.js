/* global AFRAME, CONFIG, THREE */

/**
 * wrist-travel-remote — пульт на #rightHand (Фаза 4+).
 *
 * Grip/trigger **левой** рукой у пульта → openTravelMenu / close (toggle).
 * Открывается в любой момент игры (выход / wireframe), не только после travel-ready.
 * Пульс ярче, когда есть доступный прыжок (hasAnyTravelTarget).
 */
AFRAME.registerComponent('wrist-travel-remote', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.wristTravelRemote) || {};
    this._anchorEl = null;
    this._visualEl = null;
    this._handPos = new THREE.Vector3();
    this._remotePos = new THREE.Vector3();
    this._handsBound = false;
    this._pulseUntil = 0;
    this._nearHand = false;

    this._uiVisible = false;
    this._onLeftPress = this._onLeftPress.bind(this);
    this._onUnlock = this._onUnlock.bind(this);
    this._onAvailability = this._onAvailability.bind(this);
    this._onGameStarted = this._onGameStarted.bind(this);
    this._onReturnToMenu = this._onReturnToMenu.bind(this);

    this.el.sceneEl.addEventListener('location-unlocked', this._onUnlock);
    this.el.sceneEl.addEventListener('travel-availability-changed', this._onAvailability);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnToMenu);

    this._buildRemote();
    // Как руки за чёрным veil: пульт не светится в стартовом меню.
    this._setUiVisible(false);
  },

  play: function () {
    this._bindHandListeners();
  },

  pause: function () {
    this._unbindHandListeners();
  },

  remove: function () {
    this._unbindHandListeners();
    this.el.sceneEl.removeEventListener('location-unlocked', this._onUnlock);
    this.el.sceneEl.removeEventListener('travel-availability-changed', this._onAvailability);
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnToMenu);
  },

  tick: function (time) {
    if (!this._uiVisible) return;
    this._updateVisual(time);
  },

  _readCfg: function () {
    var c = this.cfg || {};
    return {
      pressRadius: c.pressRadius !== undefined ? c.pressRadius : 0.09,
      idleIntensity: c.idleIntensity !== undefined ? c.idleIntensity : 0.55,
      activeIntensity: c.activeIntensity !== undefined ? c.activeIntensity : 0.95,
      nearIntensity: c.nearIntensity !== undefined ? c.nearIntensity : 1.08,
      pulseOnUnlockMs: c.pulseOnUnlockMs !== undefined ? c.pulseOnUnlockMs : 2500,
    };
  },

  _buildRemote: function () {
    var pos = (this.cfg && this.cfg.position) || { x: 0, y: 0.2, z: -0.01 };
    var anchor = document.createElement('a-entity');
    anchor.setAttribute('class', 'wrist-travel-remote-anchor');
    anchor.setAttribute('position',
      (pos.x || 0) + ' ' + (pos.y || 0) + ' ' + (pos.z || 0));
    this.el.appendChild(anchor);
    this._anchorEl = anchor;

    var vis = document.createElement('a-entity');
    vis.setAttribute('assembly-sphere-visual', {
      preset: 'travel',
      shape: 'cylinder',
    });
    anchor.appendChild(vis);
    this._visualEl = vis;
  },

  _visualComp: function () {
    return this._visualEl && this._visualEl.components['assembly-sphere-visual'];
  },

  /** Есть ли сейчас доступный прыжок (для пульса пульта). */
  _hasTravelTarget: function () {
    if (typeof window.hasAnyTravelTarget === 'function') {
      return window.hasAnyTravelTarget();
    }
    if (typeof window.getTravelMenuLocations === 'function') {
      var locs = window.getTravelMenuLocations();
      var i;
      for (i = 0; i < locs.length; i++) {
        if (locs[i].enabled) return true;
      }
    }
    return false;
  },

  _isBlocked: function () {
    if (!this._uiVisible) return true;
    if (typeof window.isVictoryFrozen === 'function' && window.isVictoryFrozen()) return true;
    var scene = this.el.sceneEl;
    var menu = scene && scene.components['game-menu'];
    if (menu && menu._visible) return true;
    var vui = scene && scene.components['victory-ui'];
    if (vui && vui._shown) return true;
    var travel = scene && scene.components['travel-ui'];
    if (travel && travel._busy) return true;
    return false;
  },

  _bindHandListeners: function () {
    if (this._handsBound) return;
    this._handsBound = true;
    var left = document.getElementById('leftHand');
    if (left) {
      left.addEventListener('gripdown', this._onLeftPress, true);
      left.addEventListener('triggerdown', this._onLeftPress, true);
    }
  },

  _unbindHandListeners: function () {
    if (!this._handsBound) return;
    this._handsBound = false;
    var left = document.getElementById('leftHand');
    if (left) {
      left.removeEventListener('gripdown', this._onLeftPress, true);
      left.removeEventListener('triggerdown', this._onLeftPress, true);
    }
  },

  _leftHandColliderWorldPos: function (out) {
    var col = document.getElementById('leftHandCollider');
    if (col && col.object3D) {
      col.object3D.updateMatrixWorld(true);
      return col.object3D.getWorldPosition(out);
    }
    var hand = document.getElementById('leftHand');
    if (hand && hand.object3D) {
      hand.object3D.updateMatrixWorld(true);
      return hand.object3D.getWorldPosition(out);
    }
    return out.set(0, 0, 0);
  },

  _remoteWorldPos: function (out) {
    if (!this._anchorEl || !this._anchorEl.object3D) return out.set(0, 0, 0);
    this._anchorEl.object3D.updateMatrixWorld(true);
    return this._anchorEl.object3D.getWorldPosition(out);
  },

  _isLeftHandNearRemote: function () {
    var cfg = this._readCfg();
    this._remoteWorldPos(this._remotePos);
    this._leftHandColliderWorldPos(this._handPos);
    return this._handPos.distanceTo(this._remotePos) <= cfg.pressRadius;
  },

  _onLeftPress: function () {
    if (this._isBlocked()) return;
    if (!this._isLeftHandNearRemote()) return;

    if (typeof window.isTravelMenuOpen === 'function' && window.isTravelMenuOpen()) {
      if (typeof window.closeTravelMenu === 'function') window.closeTravelMenu();
      return;
    }

    // Всегда открываем в игре: выход / wireframe; эпохи disabled если нельзя прыгнуть.
    if (typeof window.openTravelMenu === 'function') {
      window.openTravelMenu({ source: 'wrist' });
    }
  },

  _onUnlock: function () {
    var cfg = this._readCfg();
    this._pulseUntil = performance.now() + cfg.pulseOnUnlockMs;
  },

  _onAvailability: function () {
    if (this._hasTravelTarget()) {
      var cfg = this._readCfg();
      var remain = this._pulseUntil - performance.now();
      if (remain < 400) {
        this._pulseUntil = performance.now() + Math.min(cfg.pulseOnUnlockMs, 1200);
      }
    }
  },

  _setUiVisible: function (on) {
    this._uiVisible = !!on;
    if (this._anchorEl) this._anchorEl.setAttribute('visible', on);
  },

  _onGameStarted: function () {
    this._pulseUntil = 0;
    this._nearHand = false;
    this._setUiVisible(true);
  },

  _onReturnToMenu: function () {
    this._pulseUntil = 0;
    this._nearHand = false;
    this._setUiVisible(false);
  },

  _updateVisual: function (time) {
    var comp = this._visualComp();
    if (!comp) return;
    var cfg = this._readCfg();
    var blocked = this._isBlocked();
    var hasTravel = this._hasTravelTarget();
    var near = !blocked && this._isLeftHandNearRemote();
    this._nearHand = near;

    var intensity = cfg.activeIntensity;
    if (blocked) {
      intensity = cfg.idleIntensity * 0.35;
    } else if (near) {
      intensity = cfg.nearIntensity;
    } else if (hasTravel && this._pulseUntil > performance.now()) {
      var pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
      intensity = cfg.activeIntensity + pulse * 0.25;
    } else if (!hasTravel) {
      // Меню всё равно открывается; чуть спокойнее, пока прыгать некуда.
      intensity = cfg.idleIntensity;
    }

    if (typeof comp.setIntensity === 'function') comp.setIntensity(intensity);
  },
});
