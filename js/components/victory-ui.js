/* global AFRAME, CONFIG, THREE */

/**
 * victory-ui — плашка победы / поражения в VR (PNG из assets/ui/end/).
 *
 * 'victory' → panel_victory; 'defeat' → panel_defeat.
 * Restart / Main Menu — idle/hover PNG. Позиция = game.menu.worldPosition.
 */
AFRAME.registerComponent('victory-ui', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory && CONFIG.victory.ui) || {};
    this.assets = this.cfg.assets || {};
    this._shown = false;
    this._mode = 'victory';
    this._buttons = [];
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._panelEl = null;
    this._onVictory = this._onVictory.bind(this);
    this._onDefeat = this._onDefeat.bind(this);
    this._onHandPress = this._onHandPress.bind(this);
    this._onTick = this._onTick.bind(this);
    this._onGameStarted = this._onGameStarted.bind(this);

    this._menuRenderOrder = 50;
    this._pressRadius = this._getPressRadius();

    this.el.sceneEl.addEventListener('victory', this._onVictory);
    this.el.sceneEl.addEventListener('defeat', this._onDefeat);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);
    this._buildUI();
    this._bindHands();
  },

  play: function () {
    this.el.sceneEl.addEventListener('tick', this._onTick);
  },

  pause: function () {
    this.el.sceneEl.removeEventListener('tick', this._onTick);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('victory', this._onVictory);
    this.el.sceneEl.removeEventListener('defeat', this._onDefeat);
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.removeEventListener('tick', this._onTick);
    this._unbindHands();
  },

  _getMenuPosition: function () {
    var menuCfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    if (this.cfg.worldPosition) return this.cfg.worldPosition;
    return menuCfg.worldPosition || { x: 0, y: 1.55, z: -0.65 };
  },

  _getPressRadius: function () {
    if (this.cfg.handPressRadius !== undefined) return this.cfg.handPressRadius;
    var menuCfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    return menuCfg.handPressRadius !== undefined ? menuCfg.handPressRadius : 0.18;
  },

  _assetUrl: function (file) {
    if (!file) return null;
    var base = this.assets.basePath || 'assets/ui/end/';
    return base + file;
  },

  _bindHands: function () {
    var ids = ['leftHand', 'rightHand'];
    this._handEls = [];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      this._handEls.push(el);
      el.addEventListener('gripdown', this._onHandPress);
      el.addEventListener('triggerdown', this._onHandPress);
    }
  },

  _unbindHands: function () {
    if (!this._handEls) return;
    for (var i = 0; i < this._handEls.length; i++) {
      this._handEls[i].removeEventListener('gripdown', this._onHandPress);
      this._handEls[i].removeEventListener('triggerdown', this._onHandPress);
    }
  },

  _applyPlaneMaterial: function (el) {
    var order = this._menuRenderOrder;
    var apply = function () {
      var mesh = el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      mesh.material.depthTest = false;
      mesh.material.depthWrite = false;
      mesh.renderOrder = order;
    };
    el.addEventListener('loaded', apply);
    if (el.hasLoaded) apply();
  },

  _makeImagePlane: function (src, planeW, planeH) {
    var plane = document.createElement('a-plane');
    plane.setAttribute('width', planeW);
    plane.setAttribute('height', planeH);
    plane.setAttribute('material', {
      src: src,
      transparent: true,
      alphaTest: 0.05,
      shader: 'flat',
      side: 'double',
      depthTest: false,
      depthWrite: false,
      renderOrder: this._menuRenderOrder,
    });
    this._applyPlaneMaterial(plane);
    return plane;
  },

  _setPlaneSrc: function (el, src) {
    if (!el || !src) return;
    var mesh = el.getObject3D('mesh');
    if (mesh && mesh.material && mesh.material.map) {
      mesh.material.map.dispose();
    }
    el.setAttribute('material', 'src', src);
  },

  _registerPngButton: function (el, meta) {
    var entry = {
      data: { el: el },
      kind: meta.kind,
      normalSrc: meta.normalSrc,
      hoverSrc: meta.hoverSrc || meta.normalSrc,
      onPress: meta.onPress,
    };
    this._buttons.push(entry);

    var self = this;
    el.addEventListener('click', function () {
      if (self._shown) entry.onPress();
    });
    el.addEventListener('mouseenter', function () {
      if (self._shown && self._nearBtn !== entry) {
        self._setPlaneSrc(el, entry.hoverSrc);
      }
    });
    el.addEventListener('mouseleave', function () {
      if (self._shown && self._nearBtn !== entry) {
        self._setPlaneSrc(el, entry.normalSrc);
      }
    });
    return entry;
  },

  _buildUI: function () {
    var lay = this.cfg.layout || {};
    // Пропорции PNG: panel 1536×1024, buttons 1024×288 — без растяжения.
    var panelW = lay.panelWidth !== undefined ? lay.panelWidth : 1.20;
    var panelH = lay.panelHeight !== undefined ? lay.panelHeight : 0.80;
    var btnW = lay.btnWidth !== undefined ? lay.btnWidth : 0.40;
    var btnH = lay.btnHeight !== undefined ? lay.btnHeight : 0.09;
    var btnGap = lay.btnGap !== undefined ? lay.btnGap : 0.025;
    var btnBottomPad = lay.btnBottomPad !== undefined ? lay.btnBottomPad : 0.056;
    var pos = this._getMenuPosition();
    var self = this;

    var restartIdle = this._assetUrl(this.assets.restartIdle || 'btn_restart_idle.png');
    var restartHover = this._assetUrl(this.assets.restartHover || 'btn_restart_hover.png');
    var menuIdle = this._assetUrl(this.assets.menuIdle || 'btn_menu_idle.png');
    var menuHover = this._assetUrl(this.assets.menuHover || 'btn_menu_hover.png');
    var panelVictory = this._assetUrl(this.assets.panelVictory || 'panel_victory.png');
    var panelDefeat = this._assetUrl(this.assets.panelDefeat || 'panel_defeat.png');
    this._panelVictorySrc = panelVictory;
    this._panelDefeatSrc = panelDefeat;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'victory-ui-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', false);

    var panel = this._makeImagePlane(panelVictory, panelW, panelH);
    panel.setAttribute('position', '0 0 0');
    this._panelEl = panel;

    // Кнопки у нижнего края панели (Main Menu снизу, Restart над ним).
    var panelBottom = -panelH * 0.5;
    var btnY2 = panelBottom + btnBottomPad + btnH * 0.5;
    var btnY1 = btnY2 + btnH + btnGap;

    var restartEl = this._makeImagePlane(restartIdle, btnW, btnH);
    restartEl.setAttribute('position', '0 ' + btnY1 + ' 0.01');
    this._registerPngButton(restartEl, {
      kind: 'restart',
      normalSrc: restartIdle,
      hoverSrc: restartHover,
      onPress: function () { self._doRestart(); },
    });

    var menuEl = this._makeImagePlane(menuIdle, btnW, btnH);
    menuEl.setAttribute('position', '0 ' + btnY2 + ' 0.01');
    this._registerPngButton(menuEl, {
      kind: 'menu',
      normalSrc: menuIdle,
      hoverSrc: menuHover,
      onPress: function () { self._doMainMenu(); },
    });

    this._root.appendChild(panel);
    this._root.appendChild(restartEl);
    this._root.appendChild(menuEl);
    this.el.sceneEl.appendChild(this._root);

    this._btnPos = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
  },

  _facePlayer: function () {
    var cam = document.querySelector('#player a-camera');
    if (!cam || !this._root) return;
    var camPos = new THREE.Vector3();
    var rootPos = new THREE.Vector3();
    cam.object3D.getWorldPosition(camPos);
    this._root.object3D.getWorldPosition(rootPos);
    var dx = camPos.x - rootPos.x;
    var dz = camPos.z - rootPos.z;
    var rotY = Math.atan2(dx, dz) * (180 / Math.PI);
    this._root.setAttribute('rotation', '0 ' + rotY + ' 0');
  },

  _getHandWorldPos: function (handEl) {
    var collider = handEl.querySelector('[id$="HandCollider"]');
    var src = collider || handEl;
    src.object3D.getWorldPosition(this._handPos);
    return this._handPos;
  },

  _findNearestButton: function () {
    var nearest = null;
    var minDist = Infinity;
    for (var i = 0; i < this._buttons.length; i++) {
      var entry = this._buttons[i];
      entry.data.el.object3D.getWorldPosition(this._btnPos);
      for (var h = 0; h < this._handEls.length; h++) {
        this._getHandWorldPos(this._handEls[h]);
        var dist = this._handPos.distanceTo(this._btnPos);
        if (dist <= this._pressRadius && dist < minDist) {
          minDist = dist;
          nearest = entry;
        }
      }
    }
    return nearest;
  },

  _onTick: function () {
    if (!this._shown) return;
    var near = this._findNearestButton();
    if (near !== this._nearBtn) {
      if (this._nearBtn) {
        this._setPlaneSrc(this._nearBtn.data.el, this._nearBtn.normalSrc);
        this._nearBtn.data.el.setAttribute('scale', '1 1 1');
      }
      this._nearBtn = near;
      if (near) {
        this._setPlaneSrc(near.data.el, near.hoverSrc);
        if (!this._nearHintLogged) {
          this._nearHintLogged = true;
          console.log('[victory-ui] рука у кнопки — grip или trigger');
        }
      } else {
        this._nearHintLogged = false;
      }
    }
    if (near) near.data.el.setAttribute('scale', '1.08 1.08 1');
  },

  _onHandPress: function () {
    if (!this._shown || !this._nearBtn) return;
    this._nearBtn.onPress();
  },

  _releaseAllGrabs: function () {
    var ids = ['leftHand', 'rightHand'];
    for (var i = 0; i < ids.length; i++) {
      var grab = document.getElementById(ids[i]);
      grab = grab && grab.components['physx-grab'];
      if (!grab) continue;
      if (grab.joint) grab.removeJoint();
      grab.grabbing = false;
      grab.hitEl = undefined;
    }
  },

  _setClickable: function (on) {
    for (var i = 0; i < this._buttons.length; i++) {
      var el = this._buttons[i].data.el;
      if (on) el.classList.add('victory-ui-clickable');
      else el.classList.remove('victory-ui-clickable');
    }
  },

  _hidePanel: function () {
    this._shown = false;
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._setClickable(false);
    if (this._root) this._root.setAttribute('visible', false);
    for (var i = 0; i < this._buttons.length; i++) {
      this._buttons[i].data.el.setAttribute('scale', '1 1 1');
      this._setPlaneSrc(this._buttons[i].data.el, this._buttons[i].normalSrc);
    }
    if (typeof window.disableDesktopUiCursor === 'function') {
      window.disableDesktopUiCursor();
    }
  },

  _doRestart: function () {
    if (this._busy) return;
    this._busy = true;
    console.log('[victory-ui] заново — новая игра');
    this._releaseAllGrabs();
    this._hidePanel();
    if (typeof window.restartGame === 'function') {
      window.restartGame();
    } else if (typeof window.startGame === 'function') {
      window.startGame();
    }
    this._busy = false;
  },

  _doMainMenu: function () {
    if (this._busy) return;
    this._busy = true;
    console.log('[victory-ui] в главное меню');
    this._releaseAllGrabs();
    this._hidePanel();
    if (typeof window.returnToMenu === 'function') {
      window.returnToMenu();
    }
    this._busy = false;
  },

  _onGameStarted: function () {
    if (this._shown) this._hidePanel();
  },

  _showPanel: function (mode) {
    if (!this._root) return;
    this._mode = mode === 'defeat' ? 'defeat' : 'victory';
    var src = this._mode === 'defeat' ? this._panelDefeatSrc : this._panelVictorySrc;
    this._setPlaneSrc(this._panelEl, src);

    this._shown = true;
    this._nearBtn = null;
    this._nearHintLogged = false;
    var pos = this._getMenuPosition();
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', true);
    this._setClickable(true);
    this._facePlayer();
    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
    var title = this._mode === 'defeat'
      ? (((CONFIG.defeat && CONFIG.defeat.ui) || {}).titleText || 'DEFEAT')
      : (this.cfg.titleText || 'VICTORY');
    console.log('[victory-ui] ' + title + ' — PNG panel');
  },

  _onVictory: function () {
    this._showPanel('victory');
  },

  _onDefeat: function () {
    this._showPanel('defeat');
  },
});
