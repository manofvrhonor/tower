/* global AFRAME, CONFIG, THREE */

/**
 * game-menu — экран выбора сложности перед игрой (сессия 29).
 *
 * VR: поднести руку к кнопке + grip/trigger. Desktop: raycaster + click.
 * Кнопка wireframe переключает CONFIG.debug.showColliders.
 */
AFRAME.registerComponent('game-menu', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    this._visible = true;
    this._selectedDifficulty = (CONFIG.game && CONFIG.game.defaultDifficulty) || 'normal';
    this._buttons = [];
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._onTick = this._onTick.bind(this);
    this._onHandPress = this._onHandPress.bind(this);
    this._onReturnToMenu = this._onReturnToMenu.bind(this);
    this._onGameStarted = this._onGameStarted.bind(this);

    this._applyMenuTheme();
    this._pressRadius = this.cfg.handPressRadius !== undefined ? this.cfg.handPressRadius : 0.18;
    this._menuRenderOrder = 50;

    this._buildUI();
    this._bindHands();
    this._refreshDifficultyButtons();
    this._refreshWireframeButton();

    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnToMenu);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);
  },

  play: function () {
    this.el.sceneEl.addEventListener('tick', this._onTick);
    this._facePlayer();
    if (this._visible && typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
  },

  pause: function () {
    this.el.sceneEl.removeEventListener('tick', this._onTick);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('tick', this._onTick);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnToMenu);
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this._unbindHands();
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
    this._btnSelected = th.btnSelected || '#1488a8';
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
    if (bgColor === th.btnNear || bgColor === th.btnSelected) {
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
      kind: meta.kind,
      difficultyId: meta.difficultyId || null,
      normalBg: meta.normalBg || this._btnNormal,
      hoverBg: meta.hoverBg || this._btnHover,
      nearBg: meta.nearBg || this._btnNear,
      onPress: meta.onPress,
    };
    this._buttons.push(entry);

    var self = this;
    btnData.el.addEventListener('click', function () {
      if (!self._visible) return;
      entry.onPress();
    });
    btnData.el.addEventListener('mouseenter', function () {
      if (!self._visible || self._nearBtn === entry) return;
      self._redrawButton(btnData, entry.hoverBg);
    });
    btnData.el.addEventListener('mouseleave', function () {
      if (!self._visible || self._nearBtn === entry) return;
      self._redrawButton(btnData, self._bgForButton(entry));
    });

    return entry;
  },

  _bgForButton: function (entry) {
    if (entry.kind === 'difficulty' && entry.difficultyId === this._selectedDifficulty) {
      return this._btnSelected;
    }
    return entry.normalBg;
  },

  _buildUI: function () {
    var ui = this.cfg;
    var lay = ui.layout || {};
    var contentW = lay.contentWidth !== undefined ? lay.contentWidth : 1.45;
    var btnH = lay.btnHeight !== undefined ? lay.btnHeight : 0.165;
    var btnFs = lay.btnFontSize !== undefined ? lay.btnFontSize : 60;
    var wireW = (lay.wireframeBtn && lay.wireframeBtn.width) || 0.55;
    var layoutDefaults = (typeof window.menuUiLayoutDefaults === 'function')
      ? window.menuUiLayoutDefaults()
      : { colGap: 0.03 };
    var colGap = layoutDefaults.colGap;
    var pos = ui.worldPosition || { x: 0, y: 1.55, z: 0.35 };
    var startText = ui.startText || 'Start';
    var diffs = (CONFIG.game && CONFIG.game.difficulties) || {};

    var diffOrder = ['easy', 'normal', 'hard', 'hardcore'];
    var diffCount = 0;
    for (var dc = 0; dc < diffOrder.length; dc++) {
      if (diffs[diffOrder[dc]]) diffCount++;
    }

    var diffSizes = (typeof window.menuUiEqualRowButtons === 'function')
      ? window.menuUiEqualRowButtons(diffCount, contentW, btnH, colGap)
      : [];

    var wireLabel = this._wireframeLabel();
    var buttonSpecs = [];
    var specDiffCol = 0;
    for (var sp = 0; sp < diffOrder.length; sp++) {
      var spId = diffOrder[sp];
      var spPreset = diffs[spId];
      if (!spPreset) continue;
      var spSize = diffSizes[specDiffCol] || { width: contentW / Math.max(1, diffCount), height: btnH };
      buttonSpecs.push({
        text: spPreset.label || spId,
        width: spSize.width,
        height: btnH,
      });
      specDiffCol++;
    }
    buttonSpecs.push({ text: startText, width: contentW, height: btnH });
    buttonSpecs.push({ text: wireLabel, width: wireW, height: btnH });

    var fontScale = (typeof window.menuUiUniformFontScale === 'function')
      ? window.menuUiUniformFontScale(buttonSpecs, contentW, btnH, btnFs)
      : 1;
    var effectiveFs = Math.round(btnFs * fontScale);

    var self = this;
    this._menuBtnFont = function (planeW) {
      return (typeof window.menuUiFontSizeOnPlane === 'function')
        ? window.menuUiFontSizeOnPlane(effectiveFs, planeW, btnH, contentW, btnH)
        : effectiveFs;
    };

    var layout = (typeof window.menuUiComputeLayout === 'function')
      ? window.menuUiComputeLayout({
        rows: [
          { buttons: diffSizes },
          { buttons: [{ width: contentW, height: btnH }] },
          { buttons: [{ width: wireW, height: btnH }] },
        ],
      })
      : null;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'game-menu-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);

    var panel = document.createElement('a-plane');
    panel.setAttribute('width', layout ? layout.panel.width : contentW + 0.1);
    panel.setAttribute('height', layout ? layout.panel.height : 0.55);
    panel.setAttribute('color', this._panelColor);
    panel.setAttribute('material', 'shader: flat; opacity: 0.96; transparent: true; side: front; depthTest: false; depthWrite: false; renderOrder: 50');

    this._difficultyEntries = [];
    var diffCol = 0;

    for (var d = 0; d < diffOrder.length; d++) {
      var id = diffOrder[d];
      var preset = diffs[id];
      if (!preset) continue;
      var label = preset.label || id;
      var diffSize = diffSizes[diffCol] || { width: contentW / diffCount, height: btnH };
      var diffFs = this._menuBtnFont(diffSize.width);
      var btnData = this._makeTextPlane(label, diffSize.width, diffSize.height, {
        fontSize: diffFs, bg: this._btnNormal,
      });
      btnData.fontSize = diffFs;
      btnData.el.setAttribute('class', 'game-menu-clickable');
      if (layout && layout.rows[0] && layout.rows[0].buttons[diffCol]) {
        var dp = layout.rows[0].buttons[diffCol];
        btnData.el.setAttribute('position', dp.x + ' ' + dp.y + ' ' + dp.z);
      }
      this._registerButton(btnData, {
        kind: 'difficulty',
        difficultyId: id,
        onPress: (function (diffId) {
          return function () { self._selectDifficulty(diffId); };
        })(id),
      });
      this._difficultyEntries.push({ id: id, data: btnData });
      diffCol++;
    }

    var startFs = this._menuBtnFont(contentW);
    var startData = this._makeTextPlane(startText, contentW, btnH, {
      fontSize: startFs, bg: this._btnStart,
    });
    startData.fontSize = startFs;
    startData.el.setAttribute('class', 'game-menu-clickable');
    if (layout && layout.rows[1] && layout.rows[1].buttons[0]) {
      var sp = layout.rows[1].buttons[0];
      startData.el.setAttribute('position', sp.x + ' ' + sp.y + ' ' + sp.z);
    }
    this._startEntry = this._registerButton(startData, {
      kind: 'start',
      normalBg: this._btnStart,
      hoverBg: this._btnStartHover,
      nearBg: this._btnStartNear,
      onPress: function () { self._onStart(); },
    });

    var wireFs = this._menuBtnFont(wireW);
    this._wireframeData = this._makeTextPlane(wireLabel, wireW, btnH, {
      fontSize: wireFs, bg: this._btnNormal,
    });
    this._wireframeData.fontSize = wireFs;
    this._wireframeData.el.setAttribute('class', 'game-menu-clickable');
    if (layout && layout.rows[2] && layout.rows[2].buttons[0]) {
      var wp = layout.rows[2].buttons[0];
      this._wireframeData.el.setAttribute('position', wp.x + ' ' + wp.y + ' ' + wp.z);
    }
    this._wireframeEntry = this._registerButton(this._wireframeData, {
      kind: 'wireframe',
      onPress: function () { self._toggleWireframe(); },
    });

    this._root.appendChild(panel);
    for (var di = 0; di < this._difficultyEntries.length; di++) {
      this._root.appendChild(this._difficultyEntries[di].data.el);
    }
    this._root.appendChild(startData.el);
    this._root.appendChild(this._wireframeData.el);
    this.el.sceneEl.appendChild(this._root);

    this._applyMenuDrawOrder(panel);
    for (var ti = 0; ti < this._difficultyEntries.length; ti++) {
      this._applyMenuDrawOrder(this._difficultyEntries[ti].data.el);
    }
    this._applyMenuDrawOrder(startData.el);
    this._applyMenuDrawOrder(this._wireframeData.el);

    this._btnPos = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
  },

  _wireframeLabel: function () {
    var ui = this.cfg;
    var on = !!(CONFIG.debug && CONFIG.debug.showColliders);
    return on ? (ui.wireframeOnText || 'Wireframe: ON') : (ui.wireframeOffText || 'Wireframe: OFF');
  },

  _wireframeBg: function () {
    return (CONFIG.debug && CONFIG.debug.showColliders) ? this._btnSelected : this._btnNormal;
  },

  _refreshWireframeButton: function () {
    if (!this._wireframeData || !this._wireframeEntry) return;
    this._wireframeData.label = this._wireframeLabel();
    this._wireframeEntry.normalBg = this._wireframeBg();
    this._redrawButton(this._wireframeData, this._wireframeEntry.normalBg, this._wireframeData.label);
  },

  _toggleWireframe: function () {
    if (!CONFIG.debug) return;
    CONFIG.debug.showColliders = !CONFIG.debug.showColliders;
    this._refreshWireframeButton();
    if (typeof window.applyColliderDebugVisual === 'function') {
      window.applyColliderDebugVisual();
    }
    console.log('[game-menu] wireframe:', CONFIG.debug.showColliders ? 'ON' : 'OFF');
  },

  _selectDifficulty: function (id) {
    this._selectedDifficulty = id;
    if (typeof window.setGameDifficulty === 'function') {
      window.setGameDifficulty(id);
    }
    this._refreshDifficultyButtons();
    console.log('[game-menu] selected:', id);
  },

  _refreshDifficultyButtons: function () {
    if (!this._difficultyEntries) return;
    for (var i = 0; i < this._difficultyEntries.length; i++) {
      var item = this._difficultyEntries[i];
      var bg = item.id === this._selectedDifficulty ? this._btnSelected : this._btnNormal;
      for (var b = 0; b < this._buttons.length; b++) {
        if (this._buttons[b].difficultyId === item.id) {
          this._buttons[b].normalBg = bg;
          break;
        }
      }
      if (this._nearBtn && this._nearBtn.difficultyId === item.id) continue;
      this._redrawButton(item.data, bg);
    }
  },

  _onStart: function () {
    if (!this._visible) return;
    this._hide();
    if (typeof window.startGame === 'function') {
      window.startGame();
    }
  },

  _hide: function () {
    this._visible = false;
    this._nearBtn = null;
    this._nearHintLogged = false;
    if (this._root) this._root.setAttribute('visible', false);
    for (var i = 0; i < this._buttons.length; i++) {
      this._buttons[i].data.el.setAttribute('scale', '1 1 1');
    }
    this._disableDesktopCursor();
  },

  _show: function () {
    this._visible = true;
    this._nearBtn = null;
    this._nearHintLogged = false;
    if (this._root) {
      this._root.setAttribute('visible', true);
      this._facePlayer();
    }
    this._refreshDifficultyButtons();
    this._refreshWireframeButton();
    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
    console.log('[game-menu] menu shown');
  },

  _onGameStarted: function () {
    this._hide();
  },

  _onReturnToMenu: function () {
    var def = (CONFIG.game && CONFIG.game.defaultDifficulty) || 'normal';
    this._selectedDifficulty = def;
    if (typeof window.setGameDifficulty === 'function') window.setGameDifficulty(def);
    this._show();
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
    if (!this._visible) return;

    var near = this._findNearestButton();
    if (near !== this._nearBtn) {
      if (this._nearBtn) {
        this._redrawButton(this._nearBtn.data, this._bgForButton(this._nearBtn));
        this._nearBtn.data.el.setAttribute('scale', '1 1 1');
      }
      this._nearBtn = near;
      if (near) {
        this._redrawButton(near.data, near.nearBg);
        if (!this._nearHintLogged) {
          this._nearHintLogged = true;
          console.log('[game-menu] рука у кнопки — grip или trigger');
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
    if (!this._visible || !this._nearBtn) return;
    this._nearBtn.onPress();
  },

  _disableDesktopCursor: function () {
    if (typeof window.disableDesktopUiCursor === 'function') {
      window.disableDesktopUiCursor();
    }
  },
});
