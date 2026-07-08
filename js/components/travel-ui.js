/* global AFRAME, CONFIG, THREE */

/**
 * travel-ui — комикс-панель прыжка между эпохами (Фаза 4, шаг 5).
 *
 * На travel-ready: панель + кнопки ← / → к соседним разблокированным эпохам.
 * PNG: CONFIG.travel.ui.assets (fallback — canvas). travelTo(id) по нажатию.
 */
AFRAME.registerComponent('travel-ui', {
  schema: {},

  init: function () {
    this.cfg = this._readCfg();
    this._shown = false;
    this._buttons = [];
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._busy = false;

    this._onTravelReady = this._onTravelReady.bind(this);
    this._onHide = this._onHide.bind(this);
    this._onHandPress = this._onHandPress.bind(this);
    this._onTick = this._onTick.bind(this);

    this._applyMenuTheme();
    this._menuRenderOrder = 50;
    this._pressRadius = this.cfg.handPressRadius !== undefined
      ? this.cfg.handPressRadius : 0.18;

    this._buildUI();
    this._bindHands();

    this.el.sceneEl.addEventListener('travel-ready', this._onTravelReady);
    this.el.sceneEl.addEventListener('game-started', this._onHide);
    this.el.sceneEl.addEventListener('return-to-menu', this._onHide);
    this.el.sceneEl.addEventListener('location-changed', this._onHide);
  },

  play: function () {
    this.el.sceneEl.addEventListener('tick', this._onTick);
  },

  pause: function () {
    this.el.sceneEl.removeEventListener('tick', this._onTick);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('travel-ready', this._onTravelReady);
    this.el.sceneEl.removeEventListener('game-started', this._onHide);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onHide);
    this.el.sceneEl.removeEventListener('location-changed', this._onHide);
    this.el.sceneEl.removeEventListener('tick', this._onTick);
    this._unbindHands();
  },

  _readCfg: function () {
    var travel = (typeof CONFIG !== 'undefined' && CONFIG.travel) || {};
    return travel.ui || {};
  },

  _getMenuPosition: function () {
    if (this.cfg.worldPosition) return this.cfg.worldPosition;
    var menuCfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    return menuCfg.worldPosition || { x: 0, y: 1.55, z: -0.65 };
  },

  _applyMenuTheme: function () {
    var th = (typeof window.getMenuTheme === 'function') ? window.getMenuTheme() : {};
    this._theme = th;
    this._btnNormal = th.btnBg || '#0c1820';
    this._btnHover = th.btnHover || '#143040';
    this._btnNear = th.btnNear || '#1e5068';
    this._btnAccent = th.btnAccent || '#33e0ff';
    this._btnAccentHover = th.btnAccentHover || '#66f5ff';
    this._btnAccentNear = th.btnAccentNear || '#b8ffff';
    this._btnDisabled = '#1a1a22';
    this._panelColor = th.panel || '#0a1018';
    this._titleColor = th.titleAccent || '#66f5ff';
  },

  _buttonDrawOpts: function (bgColor) {
    if (typeof window.menuUiButtonDrawOpts === 'function') {
      return window.menuUiButtonDrawOpts(bgColor, this._theme);
    }
    return { borderColor: '#1a5070', textColor: '#ffffff' };
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
      var drawOpts = this._buttonDrawOpts(opts.bg);
      if (typeof window.menuUiDrawButton === 'function') {
        window.menuUiDrawButton(ctx, canvas, text, opts.fontSize || 44, opts.bg, drawOpts);
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

  _drawComicFallback: function (canvas, w, h) {
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#33e0ff';
    ctx.lineWidth = Math.max(4, w * 0.008);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    if (typeof window.menuUiDrawCenteredText === 'function') {
      window.menuUiDrawCenteredText(ctx, 'TIME JUMP', w, h * 0.45, Math.round(h * 0.14), '#66f5ff');
      window.menuUiDrawCenteredText(ctx, '···', w, h * 0.72, Math.round(h * 0.2), '#33e0ff');
    }
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
      disabledBg: meta.disabledBg || this._btnDisabled,
      enabled: meta.enabled !== false,
      onPress: meta.onPress,
    };
    this._buttons.push(entry);

    var self = this;
    btnData.el.addEventListener('click', function () {
      if (self._shown && entry.enabled) entry.onPress();
    });
    btnData.el.addEventListener('mouseenter', function () {
      if (self._shown && entry.enabled && self._nearBtn !== entry) {
        self._redrawButton(btnData, entry.hoverBg);
      }
    });
    btnData.el.addEventListener('mouseleave', function () {
      if (self._shown && entry.enabled && self._nearBtn !== entry) {
        self._redrawButton(btnData, entry.normalBg);
      }
    });
    return entry;
  },

  _locationLabel: function (id) {
    if (!id) return '?';
    var loc = (typeof window.getLocationById === 'function')
      ? window.getLocationById(id) : null;
    return (loc && loc.label) ? loc.label : id;
  },

  _findTravelTarget: function (dir) {
    var route = (typeof window.getLocationRoute === 'function')
      ? window.getLocationRoute() : [];
    var current = (typeof window.getActiveLocationId === 'function')
      ? window.getActiveLocationId() : null;
    var unlocked = (typeof window.getUnlockedLocationIds === 'function')
      ? window.getUnlockedLocationIds() : [];
    var idx = route.indexOf(current);
    if (idx < 0) return null;

    var i = idx + dir;
    while (i >= 0 && i < route.length) {
      var id = route[i];
      if (unlocked.indexOf(id) >= 0 && id !== current) return id;
      i += dir;
    }
    return null;
  },

  _refreshNavButtons: function () {
    var leftId = this._findTravelTarget(-1);
    var rightId = this._findTravelTarget(1);

    this._leftEntry.enabled = !!leftId;
    this._rightEntry.enabled = !!rightId;

    var leftLabel = leftId
      ? ('← ' + this._locationLabel(leftId))
      : (this.cfg.leftDisabledText || '←');
    var rightLabel = rightId
      ? (this._locationLabel(rightId) + ' →')
      : (this.cfg.rightDisabledText || '→');

    this._leftEntry.data.label = leftLabel;
    this._rightEntry.data.label = rightLabel;

    this._leftEntry.normalBg = this._btnNormal;
    this._leftEntry.hoverBg = this._btnHover;
    this._leftEntry.nearBg = this._btnNear;

    if (rightId === this._nextHint) {
      this._rightEntry.normalBg = this._btnAccent;
      this._rightEntry.hoverBg = this._btnAccentHover;
      this._rightEntry.nearBg = this._btnAccentNear;
    } else {
      this._rightEntry.normalBg = this._btnNormal;
      this._rightEntry.hoverBg = this._btnHover;
      this._rightEntry.nearBg = this._btnNear;
    }

    this._redrawButton(
      this._leftEntry.data,
      this._leftEntry.enabled ? this._leftEntry.normalBg : this._leftEntry.disabledBg,
      leftLabel
    );
    this._redrawButton(
      this._rightEntry.data,
      this._rightEntry.enabled ? this._rightEntry.normalBg : this._rightEntry.disabledBg,
      rightLabel
    );
  },

  _buildUI: function () {
    var ui = this.cfg;
    var comicW = ui.comicWidth !== undefined ? ui.comicWidth : 1.1;
    var comicH = ui.comicHeight !== undefined ? ui.comicHeight : 0.75;
    var btnW = ui.btnWidth !== undefined ? ui.btnWidth : 0.42;
    var btnH = ui.btnHeight !== undefined ? ui.btnHeight : 0.14;
    var btnFs = ui.btnFontSize !== undefined ? ui.btnFontSize : 48;
    var titleH = ui.titleHeight !== undefined ? ui.titleHeight : 0.1;
    var pos = this._getMenuPosition();
    var self = this;

    var layout = (typeof window.menuUiComputeLayout === 'function')
      ? window.menuUiComputeLayout({
        title: { width: comicW, height: titleH },
        rows: [
          { buttons: [{ width: comicW, height: comicH }] },
          { buttons: [{ width: btnW, height: btnH }, { width: btnW, height: btnH }] },
        ],
      })
      : null;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'travel-ui-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', false);

    var panel = document.createElement('a-plane');
    panel.setAttribute('width', layout ? layout.panel.width : comicW + 0.12);
    panel.setAttribute('height', layout ? layout.panel.height : 1.15);
    panel.setAttribute('color', this._panelColor);
    panel.setAttribute('material',
      'shader: flat; opacity: 0.96; transparent: true; side: front; depthTest: false; depthWrite: false; renderOrder: 50');

    var titleText = ui.titleText || 'Прыжок';
    var titleFs = (typeof window.menuUiFontSizeForButton === 'function')
      ? window.menuUiFontSizeForButton(titleText, comicW, titleH, { maxSize: 64, heightRatio: 0.55 })
      : 56;
    var titleData = this._makeTextPlane(titleText, comicW, titleH, {
      fontSize: titleFs, color: this._titleColor,
    });
    if (layout && layout.title) {
      var tp = layout.title;
      titleData.el.setAttribute('position', tp.x + ' ' + tp.y + ' ' + tp.z);
    }

    var comicCanvas = document.createElement('canvas');
    comicCanvas.width = 1024;
    comicCanvas.height = 698;
    this._drawComicFallback(comicCanvas, comicCanvas.width, comicCanvas.height);
    this._tryLoadComicImage(comicCanvas);

    var comicPlane = document.createElement('a-plane');
    comicPlane.setAttribute('width', comicW);
    comicPlane.setAttribute('height', comicH);
    var comicApply = function () {
      self._applyCanvasTexture(comicPlane, comicCanvas);
    };
    comicPlane.addEventListener('loaded', comicApply);
    if (comicPlane.hasLoaded) comicApply();
    this._comicPlaneEl = comicPlane;
    if (layout && layout.rows[0] && layout.rows[0].buttons[0]) {
      var cp = layout.rows[0].buttons[0];
      comicPlane.setAttribute('position', cp.x + ' ' + cp.y + ' ' + cp.z);
    }

    var navFs = Math.round(btnFs * 0.85);
    var leftData = this._makeTextPlane('←', btnW, btnH, { fontSize: navFs, bg: this._btnNormal });
    leftData.fontSize = navFs;
    var rightData = this._makeTextPlane('→', btnW, btnH, { fontSize: navFs, bg: this._btnAccent });
    rightData.fontSize = navFs;

    if (layout && layout.rows[1] && layout.rows[1].buttons.length >= 2) {
      var lp = layout.rows[1].buttons[0];
      var rp = layout.rows[1].buttons[1];
      leftData.el.setAttribute('position', lp.x + ' ' + lp.y + ' ' + lp.z);
      rightData.el.setAttribute('position', rp.x + ' ' + rp.y + ' ' + rp.z);
    }

    this._leftEntry = this._registerButton(leftData, {
      onPress: function () {
        var id = self._findTravelTarget(-1);
        if (id) self._doTravel(id);
      },
    });
    this._rightEntry = this._registerButton(rightData, {
      normalBg: this._btnAccent,
      hoverBg: this._btnAccentHover,
      nearBg: this._btnAccentNear,
      onPress: function () {
        var id = self._findTravelTarget(1);
        if (id) self._doTravel(id);
      },
    });

    this._root.appendChild(panel);
    this._root.appendChild(titleData.el);
    this._root.appendChild(comicPlane);
    this._root.appendChild(leftData.el);
    this._root.appendChild(rightData.el);
    this.el.sceneEl.appendChild(this._root);

    this._applyMenuDrawOrder(panel);
    this._applyMenuDrawOrder(titleData.el);
    this._applyMenuDrawOrder(comicPlane);
    this._applyMenuDrawOrder(leftData.el);
    this._applyMenuDrawOrder(rightData.el);

    this._btnPos = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
  },

  _tryLoadComicImage: function (canvas) {
    var assets = this.cfg.assets || {};
    var file = assets.comic;
    if (!file) return;
    var base = assets.basePath || 'assets/ui/travel/';
    var url = base + file;
    var img = new Image();
    var self = this;
    img.onload = function () {
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (self._comicPlaneEl) {
        var mesh = self._comicPlaneEl.getObject3D('mesh');
        if (mesh && mesh.material && mesh.material.map) {
          mesh.material.map.needsUpdate = true;
        }
      }
    };
    img.onerror = function () {
      console.warn('[travel-ui] comic PNG not found:', url);
    };
    img.src = url;
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
      if (!entry.enabled) continue;
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
      if (this._nearBtn && this._nearBtn.enabled) {
        this._redrawButton(this._nearBtn.data, this._nearBtn.normalBg);
        this._nearBtn.data.el.setAttribute('scale', '1 1 1');
      }
      this._nearBtn = near;
      if (near) {
        this._redrawButton(near.data, near.nearBg);
        if (!this._nearHintLogged) {
          this._nearHintLogged = true;
          console.log('[travel-ui] рука у кнопки эпохи — grip или trigger');
        }
      } else {
        this._nearHintLogged = false;
      }
    }
    if (near) near.data.el.setAttribute('scale', '1.08 1.08 1');
  },

  _onHandPress: function () {
    if (!this._shown || !this._nearBtn || !this._nearBtn.enabled) return;
    this._nearBtn.onPress();
  },

  _setClickable: function (on) {
    for (var i = 0; i < this._buttons.length; i++) {
      var el = this._buttons[i].data.el;
      if (on) el.classList.add('travel-ui-clickable');
      else el.classList.remove('travel-ui-clickable');
    }
  },

  _hidePanel: function () {
    this._shown = false;
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._setClickable(false);
    if (this._root) this._root.setAttribute('visible', false);
    for (var i = 0; i < this._buttons.length; i++) {
      if (this._buttons[i].enabled) {
        this._buttons[i].data.el.setAttribute('scale', '1 1 1');
        this._redrawButton(this._buttons[i].data, this._buttons[i].normalBg);
      }
    }
    if (typeof window.disableDesktopUiCursor === 'function') {
      window.disableDesktopUiCursor();
    }
  },

  _getVeil: function () {
    return this.el.sceneEl && this.el.sceneEl.components['menu-world-veil'];
  },

  _getBackdropVfx: function () {
    return this.el.sceneEl && this.el.sceneEl.components['menu-backdrop-vfx'];
  },

  _getTravelTransition: function () {
    return (typeof CONFIG !== 'undefined' && CONFIG.travel &&
      CONFIG.travel.transition) || {};
  },

  _doTravel: function (destId) {
    if (this._busy || !destId) return;
    this._busy = true;
    console.log('[travel-ui] travel →', destId);
    this._hidePanel();
    if (typeof window.disableDesktopUiCursor === 'function') {
      window.disableDesktopUiCursor();
    }

    var self = this;
    var trans = this._getTravelTransition();
    var veil = this._getVeil();
    var vfx = this._getBackdropVfx();

    var finishReveal = function () {
      self._busy = false;
    };

    var doTravel = function () {
      if (typeof window.travelTo === 'function') {
        window.travelTo(destId);
      }
      if (veil) {
        veil.revealWorld(finishReveal, trans.revealDurationMs || 1500);
      } else {
        finishReveal();
      }
    };

    var runSparks = function () {
      if (vfx) {
        vfx.playTravelTransition(doTravel);
      } else {
        setTimeout(doTravel, trans.sparkDurationMs || 2500);
      }
    };

    if (veil) {
      veil.coverWorld(runSparks, trans.coverDurationMs || 450);
    } else {
      runSparks();
    }
  },

  _onHide: function (evt) {
    if (evt && evt.type === 'location-changed') {
      var d = evt.detail || {};
      if (d.reason !== 'travel' && d.reason !== 'reset') return;
    }
    if (this._shown) this._hidePanel();
  },

  _onTravelReady: function (evt) {
    if (!this._root) return;
    var d = evt.detail || {};
    this._nextHint = d.nextLocationId || null;
    this._shown = true;
    this._nearBtn = null;
    this._nearHintLogged = false;

    var pos = this._getMenuPosition();
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', true);
    this._refreshNavButtons();
    this._setClickable(true);
    this._facePlayer();

    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
    console.log('[travel-ui] панель прыжка — ← / → эпохи',
      '(next:', this._nextHint || '?', ')');
  },
});
