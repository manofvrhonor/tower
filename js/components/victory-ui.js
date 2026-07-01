/* global AFRAME, CONFIG, THREE */

/**
 * victory-ui — плашка победы в VR (Этап 5, шаг 3).
 *
 * Позиция = CONFIG.game.menu.worldPosition (как стартовое меню).
 * «Заново» — сразу новая игра; «В главное меню» — returnToMenu().
 */
AFRAME.registerComponent('victory-ui', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory && CONFIG.victory.ui) || {};
    this._shown = false;
    this._buttons = [];
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._onVictory = this._onVictory.bind(this);
    this._onHandPress = this._onHandPress.bind(this);
    this._onTick = this._onTick.bind(this);
    this._onGameStarted = this._onGameStarted.bind(this);

    this._applyMenuTheme();
    this._menuRenderOrder = 50;

    this.el.sceneEl.addEventListener('victory', this._onVictory);
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
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.removeEventListener('tick', this._onTick);
    this._unbindHands();
  },

  /** Та же точка в мире, что у game-menu (z:-0.65 — комфортная дистанция в VR). */
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

  _applyMenuDrawOrder: function (el) {
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

  _applyMenuTheme: function () {
    var th = (typeof window.getMenuTheme === 'function') ? window.getMenuTheme() : {};
    this._theme = th;
    this._btnNormal = th.btnBg || '#0c1820';
    this._btnHover = th.btnHover || '#143040';
    this._btnNear = th.btnNear || '#1e5068';
    this._btnStart = th.btnAccent || '#33e0ff';
    this._btnStartHover = th.btnAccentHover || '#66f5ff';
    this._btnStartNear = th.btnAccentNear || '#b8ffff';
    this._panelColor = th.panel || '#0a1018';
  },

  _buttonDrawOpts: function (bgColor) {
    var th = this._theme || {};
    if (bgColor === th.btnAccent || bgColor === th.btnAccentHover || bgColor === th.btnAccentNear) {
      return { borderColor: th.border, textColor: th.textOnAccent || '#061018' };
    }
    if (bgColor === th.btnNear) {
      return { borderColor: th.border, textColor: th.text || '#ffffff' };
    }
    return { borderColor: th.borderDim || th.border, textColor: th.text || '#ffffff' };
  },

  _makeTextPlane: function (text, planeW, planeH, options) {
    var opts = options || {};
    var sz = (typeof window.menuUiCanvasSize === 'function')
      ? window.menuUiCanvasSize(planeW, planeH, opts.canvasW || 512)
      : { w: opts.canvasW || 512, h: opts.canvasH || 128 };
    var canvas = document.createElement('canvas');
    canvas.width = sz.w;
    canvas.height = sz.h;
    var ctx = canvas.getContext('2d');

    if (opts.bg) {
      if (typeof window.menuUiDrawButton === 'function') {
        window.menuUiDrawButton(
          ctx, canvas, text, opts.fontSize || 44, opts.bg, this._buttonDrawOpts(opts.bg)
        );
      }
    } else {
      ctx.clearRect(0, 0, sz.w, sz.h);
      if (typeof window.menuUiDrawCenteredText === 'function') {
        window.menuUiDrawCenteredText(ctx, text, sz.w, sz.h, opts.fontSize || 48, opts.color || '#ffffff');
      }
    }

    var plane = document.createElement('a-plane');
    plane.setAttribute('width', planeW);
    plane.setAttribute('height', planeH);

    var self = this;
    var apply = function () {
      self._applyCanvasTexture(plane, canvas);
    };
    plane.addEventListener('loaded', apply);
    if (plane.hasLoaded) apply();

    return { el: plane, canvas: canvas, ctx: ctx, label: text, fontSize: opts.fontSize || 44 };
  },

  _applyCanvasTexture: function (el, canvas) {
    var mesh = el.getObject3D('mesh');
    if (!mesh) return;
    var tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    mesh.material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
    });
    mesh.renderOrder = this._menuRenderOrder;
  },

  _redrawButton: function (btnData, bgColor, label) {
    var text = label !== undefined ? label : btnData.label;
    if (typeof window.menuUiDrawButton === 'function') {
      window.menuUiDrawButton(
        btnData.ctx, btnData.canvas, text, btnData.fontSize || 44, bgColor,
        this._buttonDrawOpts(bgColor)
      );
    }
    var mesh = btnData.el.getObject3D('mesh');
    if (mesh && mesh.material && mesh.material.map) {
      mesh.material.map.needsUpdate = true;
    }
  },

  _registerButton: function (btnData, meta) {
    var entry = {
      data: btnData,
      normalBg: meta.normalBg || this._btnNormal,
      hoverBg: meta.hoverBg || this._btnHover,
      nearBg: meta.nearBg || this._btnNear,
      onPress: meta.onPress,
    };
    this._buttons.push(entry);

    var self = this;
    btnData.el.addEventListener('click', function () {
      if (self._shown) entry.onPress();
    });
    btnData.el.addEventListener('mouseenter', function () {
      if (self._shown && self._nearBtn !== entry) {
        self._redrawButton(btnData, entry.hoverBg);
      }
    });
    btnData.el.addEventListener('mouseleave', function () {
      if (self._shown && self._nearBtn !== entry) {
        self._redrawButton(btnData, entry.normalBg);
      }
    });
    return entry;
  },

  _buildUI: function () {
    var ui = this.cfg;
    var lay = ui.layout || {};
    var contentW = lay.contentWidth !== undefined ? lay.contentWidth : 1.45;
    var btnH = lay.btnHeight !== undefined ? lay.btnHeight : 0.165;
    var btnFs = lay.btnFontSize !== undefined ? lay.btnFontSize : 60;
    var titleLay = lay.title || { height: 0.12, fontSize: 72 };
    var pos = this._getMenuPosition();
    this._pressRadius = this._getPressRadius();
    var title = ui.titleText || 'VICTORY';
    var restartText = ui.restartText || ui.buttonText || 'Restart';
    var menuText = ui.menuText || 'Main Menu';

    var layout = (typeof window.menuUiComputeLayout === 'function')
      ? window.menuUiComputeLayout({
        title: { width: contentW, height: titleLay.height },
        rows: [
          { buttons: [{ width: contentW, height: btnH }] },
          { buttons: [{ width: contentW, height: btnH }] },
        ],
      })
      : null;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'victory-ui-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', false);

    var panel = document.createElement('a-plane');
    panel.setAttribute('width', layout ? layout.panel.width : contentW + 0.1);
    panel.setAttribute('height', layout ? layout.panel.height : 0.45);
    panel.setAttribute('color', this._panelColor);
    panel.setAttribute('material', 'shader: flat; opacity: 0.96; transparent: true; side: front; depthTest: false; depthWrite: false; renderOrder: 50');
    panel.setAttribute('position', '0 0 0');

    var titleColor = (this._theme && this._theme.titleAccent) || '#66f5ff';
    var titleData = this._makeTextPlane(title, contentW, titleLay.height, {
      fontSize: titleLay.fontSize, color: titleColor,
    });
    if (layout && layout.title) {
      var tp = layout.title;
      titleData.el.setAttribute('position', tp.x + ' ' + tp.y + ' ' + tp.z);
    }

    var self = this;
    var menuBtnFs = (typeof window.menuUiFontSizeOnPlane === 'function')
      ? window.menuUiFontSizeOnPlane(btnFs, contentW, btnH, contentW, btnH)
      : btnFs;

    var restartData = this._makeTextPlane(restartText, contentW, btnH, {
      fontSize: menuBtnFs, bg: this._btnStart,
    });
    restartData.fontSize = menuBtnFs;
    restartData.el.setAttribute('class', 'victory-ui-clickable');
    if (layout && layout.rows[0] && layout.rows[0].buttons[0]) {
      var rp = layout.rows[0].buttons[0];
      restartData.el.setAttribute('position', rp.x + ' ' + rp.y + ' ' + rp.z);
    }
    this._registerButton(restartData, {
      normalBg: this._btnStart,
      hoverBg: this._btnStartHover,
      nearBg: this._btnStartNear,
      onPress: function () { self._doRestart(); },
    });

    var menuBtnData = this._makeTextPlane(menuText, contentW, btnH, {
      fontSize: menuBtnFs, bg: this._btnNormal,
    });
    menuBtnData.fontSize = menuBtnFs;
    menuBtnData.el.setAttribute('class', 'victory-ui-clickable');
    if (layout && layout.rows[1] && layout.rows[1].buttons[0]) {
      var mp = layout.rows[1].buttons[0];
      menuBtnData.el.setAttribute('position', mp.x + ' ' + mp.y + ' ' + mp.z);
    }
    this._registerButton(menuBtnData, {
      normalBg: this._btnNormal,
      hoverBg: this._btnHover,
      nearBg: this._btnNear,
      onPress: function () { self._doMainMenu(); },
    });

    this._root.appendChild(panel);
    this._root.appendChild(titleData.el);
    this._root.appendChild(restartData.el);
    this._root.appendChild(menuBtnData.el);
    this.el.sceneEl.appendChild(this._root);

    this._applyMenuDrawOrder(panel);
    this._applyMenuDrawOrder(titleData.el);
    this._applyMenuDrawOrder(restartData.el);
    this._applyMenuDrawOrder(menuBtnData.el);

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
        this._redrawButton(this._nearBtn.data, this._nearBtn.normalBg);
        this._nearBtn.data.el.setAttribute('scale', '1 1 1');
      }
      this._nearBtn = near;
      if (near) {
        this._redrawButton(near.data, near.nearBg);
        if (!this._nearHintLogged) {
          this._nearHintLogged = true;
          console.log('[victory-ui] рука у кнопки — grip или trigger');
        }
      } else {
        this._nearHintLogged = false;
      }
    }

    if (near) {
      near.data.el.setAttribute('scale', '1.08 1.08 1');
    }
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

  _hidePanel: function () {
    this._shown = false;
    this._nearBtn = null;
    this._nearHintLogged = false;
    if (this._root) this._root.setAttribute('visible', false);
    for (var i = 0; i < this._buttons.length; i++) {
      this._buttons[i].data.el.setAttribute('scale', '1 1 1');
      this._redrawButton(this._buttons[i].data, this._buttons[i].normalBg);
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
    if (typeof window.startGame === 'function') {
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

  _onVictory: function () {
    if (!this._root) return;
    this._shown = true;
    this._nearBtn = null;
    this._nearHintLogged = false;
    var pos = this._getMenuPosition();
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', true);
    this._facePlayer();
    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
    console.log('[victory-ui] ПОБЕДА — «Заново» или «В главное меню»');
  },
});
