/* global AFRAME, CONFIG, THREE */

/**
 * travel-ui — меню выбора эпох (Фаза 4+).
 *
 * Всегда показывает ВСЕ эпохи; кнопки enabled по canTravelTo (живая квота).
 * Auto (travel-ready) и wrist — одно меню. Forced slo-mo пока открыто.
 * Закрытие: кнопка «Закрыть» или пульт. victory-freeze не используется.
 */
AFRAME.registerComponent('travel-ui', {
  schema: {},

  init: function () {
    this.cfg = this._readCfg();
    this._shown = false;
    this._openSource = null;
    this._comicKey = null;
    this._buttons = [];
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._busy = false;
    this._nextHint = null;

    this._onTravelReady = this._onTravelReady.bind(this);
    this._onHide = this._onHide.bind(this);
    this._onAvailability = this._onAvailability.bind(this);
    this._onHandPress = this._onHandPress.bind(this);
    this._onTick = this._onTick.bind(this);

    this._applyMenuTheme();
    this._menuRenderOrder = 50;
    this._pressRadius = this.cfg.handPressRadius !== undefined
      ? this.cfg.handPressRadius : 0.18;

    this._buildUI();
    this._bindHands();
    this._exposeApi();

    this.el.sceneEl.addEventListener('travel-ready', this._onTravelReady);
    this.el.sceneEl.addEventListener('travel-availability-changed', this._onAvailability);
    this.el.sceneEl.addEventListener('game-started', this._onHide);
    this.el.sceneEl.addEventListener('return-to-menu', this._onHide);
    this.el.sceneEl.addEventListener('location-changed', this._onHide);
    this.el.sceneEl.addEventListener('victory', this._onHide);
  },

  play: function () {
    this.el.sceneEl.addEventListener('tick', this._onTick);
  },

  pause: function () {
    this.el.sceneEl.removeEventListener('tick', this._onTick);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('travel-ready', this._onTravelReady);
    this.el.sceneEl.removeEventListener('travel-availability-changed', this._onAvailability);
    this.el.sceneEl.removeEventListener('game-started', this._onHide);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onHide);
    this.el.sceneEl.removeEventListener('location-changed', this._onHide);
    this.el.sceneEl.removeEventListener('victory', this._onHide);
    this.el.sceneEl.removeEventListener('tick', this._onTick);
    this._unbindHands();
    this._setTravelSlowMo(false);
    if (window.openTravelMenu) delete window.openTravelMenu;
    if (window.closeTravelMenu) delete window.closeTravelMenu;
    if (window.isTravelMenuOpen) delete window.isTravelMenuOpen;
  },

  _exposeApi: function () {
    var self = this;
    window.openTravelMenu = function (opts) {
      self.openMenu(opts || {});
    };
    window.closeTravelMenu = function () {
      self.closeMenu();
    };
    window.isTravelMenuOpen = function () {
      return self._shown;
    };
  },

  _isBlocked: function () {
    if (this._busy) return true;
    if (typeof window.isVictoryFrozen === 'function' && window.isVictoryFrozen()) return true;
    var scene = this.el.sceneEl;
    var menu = scene && scene.components['game-menu'];
    if (menu && menu._visible) return true;
    var vui = scene && scene.components['victory-ui'];
    if (vui && vui._shown) return true;
    return false;
  },

  openMenu: function (opts) {
    if (!this._root || this._isBlocked()) return;
    var source = (opts && opts.source) || 'wrist';
    var comicKey = (opts && opts.comicKey) || null;

    this._openSource = source;
    this._comicKey = comicKey;
    this._shown = true;
    this._nearBtn = null;
    this._nearHintLogged = false;
    if (opts && opts.nextLocationId) this._nextHint = opts.nextLocationId;

    this._setTravelSlowMo(true);

    var pos = this._getMenuPosition();
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', true);
    this._updateComicVisibility();
    this._rebuildLocationButtons();
    this._layoutPanel();
    this._setClickable(true);
    this._facePlayer();

    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
    console.log('[travel-ui] меню эпох открыто (' + source +
      (comicKey ? ', comic:' + comicKey : '') + ')');
  },

  closeMenu: function () {
    if (!this._shown) return;
    this._hidePanel(true);
  },

  _setTravelSlowMo: function (on) {
    var sys = this.el.sceneEl && this.el.sceneEl.systems['time-scale'];
    if (sys && typeof sys.setTravelMenuSlowMo === 'function') {
      sys.setTravelMenuSlowMo(on);
    }
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
    this._btnCurrent = '#2a3540';
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

  _drawComicFallback: function (canvas, w, h, comicKey) {
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#33e0ff';
    ctx.lineWidth = Math.max(4, w * 0.008);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    var title = comicKey === 'rebuilt' ? 'AGAIN' : 'TIME JUMP';
    var sub = comicKey === 'rebuilt'
      ? 'Machine works again'
      : (comicKey === 'first' ? 'Choose an era' : '···');
    if (typeof window.menuUiDrawCenteredText === 'function') {
      window.menuUiDrawCenteredText(ctx, title, w, h * 0.4, Math.round(h * 0.12), '#66f5ff');
      window.menuUiDrawCenteredText(ctx, sub, w, h * 0.68, Math.round(h * 0.08), '#33e0ff');
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
      locationId: meta.locationId || null,
      isClose: !!meta.isClose,
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

  _menuLocations: function () {
    if (typeof window.getTravelMenuLocations === 'function') {
      return window.getTravelMenuLocations();
    }
    return [];
  },

  _clearDynamicButtons: function () {
    var i;
    for (i = 0; i < this._buttons.length; i++) {
      var el = this._buttons[i].data.el;
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this._buttons.length = 0;
    this._nearBtn = null;
  },

  _rebuildLocationButtons: function () {
    this._clearDynamicButtons();
    if (!this._locBtnRoot) return;

    var ui = this.cfg;
    var btnW = ui.locBtnWidth !== undefined ? ui.locBtnWidth : 0.88;
    var btnH = ui.locBtnHeight !== undefined ? ui.locBtnHeight : 0.12;
    var btnGap = ui.locBtnGap !== undefined ? ui.locBtnGap : 0.04;
    var closeH = ui.closeBtnHeight !== undefined ? ui.closeBtnHeight : 0.1;
    var btnFs = ui.btnFontSize !== undefined ? Math.round(ui.btnFontSize * 0.82) : 40;
    var locs = this._menuLocations();
    var self = this;
    var count = locs.length;
    var idx;

    for (idx = 0; idx < count; idx++) {
      var info = locs[idx];
      var isCurrent = !!info.isCurrent;
      var enabled = !!info.enabled;
      var isHint = info.id === this._nextHint && enabled;
      var label = info.label || info.id;
      if (isCurrent) label = '● ' + label;

      var normalBg = isCurrent ? this._btnCurrent
        : (!enabled ? this._btnDisabled
          : (isHint ? this._btnAccent : this._btnNormal));
      var hoverBg = isHint ? this._btnAccentHover : this._btnHover;
      var nearBg = isHint ? this._btnAccentNear : this._btnNear;

      var btnData = this._makeTextPlane(label, btnW, btnH, {
        fontSize: btnFs,
        bg: normalBg,
      });
      btnData.fontSize = btnFs;
      btnData.label = label;
      var y = -idx * (btnH + btnGap);
      btnData.el.setAttribute('position', '0 ' + y + ' 0.01');
      this._locBtnRoot.appendChild(btnData.el);
      this._applyMenuDrawOrder(btnData.el);

      (function (destId, canPress, entryLabel, nBg, hBg, nb) {
        self._registerButton(btnData, {
          locationId: destId,
          enabled: canPress,
          normalBg: nBg,
          hoverBg: hBg,
          nearBg: nb,
          disabledBg: self._btnDisabled,
          onPress: function () {
            if (canPress) self._doTravel(destId);
          },
        });
      })(info.id, enabled, label, normalBg, hoverBg, nearBg);
    }

    var closeLabel = ui.closeBtnText || 'Закрыть';
    var closeY = -count * (btnH + btnGap) - 0.02;
    var closeData = this._makeTextPlane(closeLabel, btnW, closeH, {
      fontSize: Math.round(btnFs * 0.85),
      bg: this._btnNormal,
    });
    closeData.fontSize = Math.round(btnFs * 0.85);
    closeData.label = closeLabel;
    closeData.el.setAttribute('position', '0 ' + closeY + ' 0.01');
    this._locBtnRoot.appendChild(closeData.el);
    this._applyMenuDrawOrder(closeData.el);
    this._registerButton(closeData, {
      isClose: true,
      enabled: true,
      normalBg: this._btnNormal,
      hoverBg: this._btnHover,
      nearBg: this._btnNear,
      onPress: function () {
        self.closeMenu();
      },
    });
  },

  _shouldShowComic: function () {
    if (this._openSource === 'wrist') {
      return this.cfg.showComicOnWrist === true;
    }
    if (this.cfg.showComicOnAuto === false) return false;
    return !!this._comicKey;
  },

  _updateComicVisibility: function () {
    if (!this._comicPlaneEl) return;
    var show = this._shouldShowComic();
    this._comicPlaneEl.setAttribute('visible', show);
    if (show) this._refreshComicCanvas();
  },

  _refreshComicCanvas: function () {
    if (!this._comicCanvas) return;
    this._drawComicFallback(
      this._comicCanvas,
      this._comicCanvas.width,
      this._comicCanvas.height,
      this._comicKey
    );
    this._tryLoadComicImage(this._comicCanvas, this._comicKey);
    if (this._comicPlaneEl) {
      var mesh = this._comicPlaneEl.getObject3D('mesh');
      if (mesh && mesh.material && mesh.material.map) {
        mesh.material.map.needsUpdate = true;
      } else {
        this._applyCanvasTexture(this._comicPlaneEl, this._comicCanvas);
      }
    }
  },

  _buildUI: function () {
    var ui = this.cfg;
    var comicW = ui.comicWidth !== undefined ? ui.comicWidth : 1.1;
    var comicH = ui.comicHeight !== undefined ? ui.comicHeight : 0.75;
    var titleH = ui.titleHeight !== undefined ? ui.titleHeight : 0.1;
    var pos = this._getMenuPosition();
    var self = this;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'travel-ui-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', false);

    var panel = document.createElement('a-plane');
    panel.setAttribute('id', 'travel-ui-panel');
    panel.setAttribute('width', comicW + 0.12);
    panel.setAttribute('height', 1.15);
    panel.setAttribute('color', this._panelColor);
    panel.setAttribute('material',
      'shader: flat; opacity: 0.96; transparent: true; side: front; depthTest: false; depthWrite: false; renderOrder: 50');
    this._panelEl = panel;

    var titleText = ui.titleText || 'Прыжок';
    var titleFs = (typeof window.menuUiFontSizeForButton === 'function')
      ? window.menuUiFontSizeForButton(titleText, comicW, titleH, { maxSize: 64, heightRatio: 0.55 })
      : 56;
    var titleData = this._makeTextPlane(titleText, comicW, titleH, {
      fontSize: titleFs, color: this._titleColor,
    });
    titleData.el.setAttribute('position', '0 0.5 0.01');
    this._titleEl = titleData.el;

    var comicCanvas = document.createElement('canvas');
    comicCanvas.width = 1024;
    comicCanvas.height = 698;
    this._comicCanvas = comicCanvas;
    this._drawComicFallback(comicCanvas, comicCanvas.width, comicCanvas.height, null);

    var comicPlane = document.createElement('a-plane');
    comicPlane.setAttribute('width', comicW);
    comicPlane.setAttribute('height', comicH);
    comicPlane.setAttribute('visible', false);
    var comicApply = function () {
      self._applyCanvasTexture(comicPlane, comicCanvas);
    };
    comicPlane.addEventListener('loaded', comicApply);
    if (comicPlane.hasLoaded) comicApply();
    this._comicPlaneEl = comicPlane;
    comicPlane.setAttribute('position', '0 0.22 0.01');

    this._locBtnRoot = document.createElement('a-entity');
    this._locBtnRoot.setAttribute('id', 'travel-ui-loc-btns');
    this._locBtnRoot.setAttribute('position', '0 -0.18 0');

    this._root.appendChild(panel);
    this._root.appendChild(titleData.el);
    this._root.appendChild(comicPlane);
    this._root.appendChild(this._locBtnRoot);
    this.el.sceneEl.appendChild(this._root);

    this._applyMenuDrawOrder(panel);
    this._applyMenuDrawOrder(titleData.el);
    this._applyMenuDrawOrder(comicPlane);

    this._btnPos = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
  },

  _layoutPanel: function () {
    if (!this._panelEl) return;
    var ui = this.cfg;
    var comicW = ui.comicWidth !== undefined ? ui.comicWidth : 1.1;
    var comicH = ui.comicHeight !== undefined ? ui.comicHeight : 0.75;
    var titleH = ui.titleHeight !== undefined ? ui.titleHeight : 0.1;
    var btnH = ui.locBtnHeight !== undefined ? ui.locBtnHeight : 0.12;
    var btnGap = ui.locBtnGap !== undefined ? ui.locBtnGap : 0.04;
    var closeH = ui.closeBtnHeight !== undefined ? ui.closeBtnHeight : 0.1;
    var locs = this._menuLocations();
    var btnBlock = locs.length * btnH + Math.max(0, locs.length - 1) * btnGap
      + closeH + 0.06;
    var showComic = this._shouldShowComic();
    var panelH = titleH + (showComic ? comicH + 0.08 : 0) + btnBlock + 0.2;

    this._panelEl.setAttribute('width', comicW + 0.12);
    this._panelEl.setAttribute('height', panelH);

    var topY = panelH * 0.5 - titleH * 0.5 - 0.04;
    if (this._titleEl) this._titleEl.setAttribute('position', '0 ' + topY + ' 0.01');

    var comicY = topY - titleH * 0.5 - comicH * 0.5 - 0.04;
    if (this._comicPlaneEl) {
      this._comicPlaneEl.setAttribute('position', '0 ' + comicY + ' 0.01');
    }

    var btnTop = showComic
      ? comicY - comicH * 0.5 - 0.04
      : topY - titleH * 0.5 - 0.06;
    if (this._locBtnRoot) {
      this._locBtnRoot.setAttribute('position', '0 ' + btnTop + ' 0');
    }
  },

  _tryLoadComicImage: function (canvas, comicKey) {
    var assets = this.cfg.assets || {};
    var file = null;
    if (comicKey === 'rebuilt') file = assets.comicRebuilt;
    else if (comicKey === 'first') file = assets.comicFirst;
    if (!file && assets.comic) file = assets.comic;
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
          console.log('[travel-ui] рука у кнопки — grip или trigger');
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

  _stopTravelOrbit: function () {
    var vfx = this._getBackdropVfx();
    if (vfx && typeof vfx.stopTravelOrbit === 'function') vfx.stopTravelOrbit();
  },

  _hidePanel: function (resumeWorld) {
    var wasShown = this._shown;
    this._shown = false;
    this._openSource = null;
    this._comicKey = null;
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._setClickable(false);
    if (this._root) this._root.setAttribute('visible', false);
    this._clearDynamicButtons();
    if (typeof window.disableDesktopUiCursor === 'function') {
      window.disableDesktopUiCursor();
    }
    if (resumeWorld !== false) {
      this._setTravelSlowMo(false);
      this._stopTravelOrbit();
      if (wasShown) {
        this.el.sceneEl.emit('travel-menu-closed', {}, false);
      }
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
    if (typeof window.canTravelTo === 'function' && !window.canTravelTo(destId)) {
      console.warn('[travel-ui] travel blocked:', destId);
      this._rebuildLocationButtons();
      this._layoutPanel();
      return;
    }
    this._busy = true;
    console.log('[travel-ui] travel →', destId);
    this._hidePanel(false);
    this._setTravelSlowMo(false);
    this._stopTravelOrbit();
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

  _onAvailability: function () {
    if (!this._shown) return;
    this._rebuildLocationButtons();
    this._layoutPanel();
    this._setClickable(true);
  },

  _onHide: function (evt) {
    if (evt && evt.type === 'location-changed') {
      var d = evt.detail || {};
      if (d.reason !== 'travel' && d.reason !== 'reset') return;
    }
    if (this._shown) this._hidePanel(true);
    else this._setTravelSlowMo(false);
  },

  _onTravelReady: function (evt) {
    var d = evt.detail || {};
    this._nextHint = d.nextLocationId || null;
    this.openMenu({
      source: 'auto',
      comicKey: d.comicKey || 'first',
      nextLocationId: d.nextLocationId || null,
    });
    console.log('[travel-ui] travel-ready — auto menu',
      '(next:', this._nextHint || '?', ', comic:', d.comicKey || 'first', ')');
  },
});
