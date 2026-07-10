/* global AFRAME, CONFIG, THREE */

/**
 * travel-ui — меню прыжка эпох (Фаза 4+).
 *
 * Одно меню: пульт и auto (после travel-ready).
 * Auto: comic-slides (travelReady*) → затем это меню. Пульт — сразу меню.
 * Прыжок present→past / past→future: comic jump-папки между veil и travelTo.
 * Панель = размер victory/defeat. Таймлайн: Прошлое — Настоящее — Будущее.
 * Над текущей эпохой — маркер «вы тут». Внизу: домик | Закрыть | шестерёнка.
 * Домик → confirm → returnToMenu. Шестерёнка → wireframe (как game-menu).
 * PNG собираются один раз; open/close не пересоздаёт текстуры (Quest Link crash).
 */
AFRAME.registerComponent('travel-ui', {
  schema: {},

  init: function () {
    this.cfg = this._readCfg();
    this.assets = this.cfg.assets || {};
    this._shown = false;
    this._confirmShown = false;
    this._buttons = [];
    this._menuButtons = [];
    this._confirmButtons = [];
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._busy = false;
    this._nextHint = null;
    this._hereMarkerEl = null;
    this._panelEl = null;
    this._contentRoot = null;
    this._confirmRoot = null;
    this._gearVis = null;
    this._gearEntry = null;
    this._gearOffSrc = null;
    this._gearOnSrc = null;

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

  _readCfg: function () {
    var travel = (typeof CONFIG !== 'undefined' && CONFIG.travel) || {};
    return travel.ui || {};
  },

  _lay: function () {
    return this.cfg.layout || {};
  },

  _assetUrl: function (file) {
    if (!file) return null;
    var base = this.assets.basePath || 'assets/ui/travel/';
    return base + file;
  },

  _getMenuPosition: function () {
    if (this.cfg.worldPosition) return this.cfg.worldPosition;
    var menuCfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    return menuCfg.worldPosition || { x: 0, y: 1.55, z: -0.65 };
  },

  _applyMenuTheme: function () {
    var th = (typeof window.getMenuTheme === 'function') ? window.getMenuTheme() : {};
    this._theme = th;
    this._panelColor = th.panel || '#0a1018';
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
    // Пульт во время comic — закрыть преамбулу и показать меню.
    if (typeof window.isComicSlidesOpen === 'function' && window.isComicSlidesOpen()) {
      if (typeof window.hideComicSlides === 'function') window.hideComicSlides();
    }
    this._shown = true;
    this._nearBtn = null;
    this._nearHintLogged = false;
    if (opts && opts.nextLocationId) this._nextHint = opts.nextLocationId;

    this._setTravelSlowMo(true);

    var pos = this._getMenuPosition();
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', true);
    // Не пересоздаём PNG каждый open/close — на Quest Link это роняло runtime.
    if (!this._menuButtons.length) this._rebuildContent();
    else this._refreshEraButtons();
    this._setClickable(true);
    this._facePlayer();

    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
    console.log('[travel-ui] меню эпох открыто (' + ((opts && opts.source) || 'wrist') + ')');
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
    this._applyMenuDrawOrder(plane);
    return plane;
  },

  _setPlaneSrc: function (el, src) {
    if (!el || !src) return;
    // Не dispose() вручную — A-Frame сам держит кэш; dispose + смена src ронял Quest Link.
    var cur = el.getAttribute('material');
    if (cur && cur.src === src) return;
    el.setAttribute('material', 'src', src);
  },

  /** URL PNG эпохи по id и состоянию (текст уже в картинке). */
  _locSrc: function (locId, state) {
    var loc = (this.assets.loc && this.assets.loc[locId]) || {};
    var file = loc[state] || loc.idle;
    return this._assetUrl(file);
  },

  _registerPngButton: function (el, meta) {
    var entry = {
      data: { el: el },
      kind: meta.kind || 'png',
      normalSrc: meta.normalSrc,
      hoverSrc: meta.hoverSrc || meta.normalSrc,
      enabled: meta.enabled !== false,
      onPress: meta.onPress,
      locationId: meta.locationId || null,
      isClose: !!meta.isClose,
    };
    this._buttons.push(entry);

    var self = this;
    el.addEventListener('click', function () {
      if (!self._shown || !entry.enabled) return;
      if (self._confirmShown && entry.kind.indexOf('confirm-') !== 0) return;
      entry.onPress();
    });
    el.addEventListener('mouseenter', function () {
      if (!self._shown || !entry.enabled || self._nearBtn === entry) return;
      if (self._confirmShown && entry.kind.indexOf('confirm-') !== 0) return;
      if (entry.hoverSrc) self._setPlaneSrc(el, entry.hoverSrc);
    });
    el.addEventListener('mouseleave', function () {
      if (!self._shown || !entry.enabled || self._nearBtn === entry) return;
      if (entry.normalSrc) self._setPlaneSrc(el, entry.normalSrc);
    });
    return entry;
  },

  _menuLocationsById: function () {
    var map = {};
    var list = [];
    if (typeof window.getTravelMenuLocations === 'function') {
      list = window.getTravelMenuLocations();
    }
    var i;
    for (i = 0; i < list.length; i++) {
      map[list[i].id] = list[i];
    }
    return map;
  },

  /** Таймлайн: past → present → future (config.timelineOrder). */
  _timelineLocations: function () {
    var order = this.cfg.timelineOrder || ['past', 'present', 'future'];
    var byId = this._menuLocationsById();
    var out = [];
    var i;
    for (i = 0; i < order.length; i++) {
      var id = order[i];
      if (byId[id]) out.push(byId[id]);
      else {
        out.push({
          id: id,
          label: id,
          enabled: false,
          isCurrent: false,
        });
      }
    }
    return out;
  },

  _clearContent: function () {
    var i;
    for (i = 0; i < this._buttons.length; i++) {
      var el = this._buttons[i].data.el;
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this._buttons.length = 0;
    this._menuButtons.length = 0;
    this._nearBtn = null;
    this._gearVis = null;
    this._gearEntry = null;
    if (this._hereMarkerEl && this._hereMarkerEl.parentNode) {
      this._hereMarkerEl.parentNode.removeChild(this._hereMarkerEl);
    }
    this._hereMarkerEl = null;
    // Линия таймлайна и прочие non-button дети contentRoot.
    if (this._contentRoot) {
      while (this._contentRoot.firstChild) {
        this._contentRoot.removeChild(this._contentRoot.firstChild);
      }
    }
  },

  _buildUI: function () {
    var lay = this._lay();
    var panelW = lay.panelWidth !== undefined ? lay.panelWidth : 1.20;
    var panelH = lay.panelHeight !== undefined ? lay.panelHeight : 0.80;
    var pos = this._getMenuPosition();
    var panelSrc = this._assetUrl(this.assets.panel || 'panel_travel.png');

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'travel-ui-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this._root.setAttribute('visible', false);

    var panel = this._makeImagePlane(panelSrc, panelW, panelH);
    panel.setAttribute('position', '0 0 0');
    this._panelEl = panel;

    this._contentRoot = document.createElement('a-entity');
    this._contentRoot.setAttribute('id', 'travel-ui-content');

    this._root.appendChild(panel);
    this._root.appendChild(this._contentRoot);
    this._buildConfirmUI();
    this.el.sceneEl.appendChild(this._root);

    this._btnPos = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
  },

  _buildConfirmUI: function () {
    var lay = this._lay();
    var self = this;
    var cw = lay.confirmWidth !== undefined ? lay.confirmWidth : 0.80;
    var ch = lay.confirmHeight !== undefined ? lay.confirmHeight : 0.33;
    var btnW = lay.confirmBtnW !== undefined ? lay.confirmBtnW : 0.28;
    var btnH = lay.confirmBtnH !== undefined ? lay.confirmBtnH : 0.09;
    var gap = lay.confirmBtnGap !== undefined ? lay.confirmBtnGap : 0.06;
    var btnY = lay.confirmBtnY !== undefined ? lay.confirmBtnY : -0.08;
    var panelSrc = this._assetUrl(this.assets.confirmPanel || 'panel_confirm_exit.png');
    var yesIdle = this._assetUrl(this.assets.confirmYesIdle || 'btn_confirm_yes_idle.png');
    var yesHover = this._assetUrl(this.assets.confirmYesHover || 'btn_confirm_yes_hover.png');
    var noIdle = this._assetUrl(this.assets.confirmNoIdle || 'btn_confirm_no_idle.png');
    var noHover = this._assetUrl(this.assets.confirmNoHover || 'btn_confirm_no_hover.png');

    this._confirmRoot = document.createElement('a-entity');
    this._confirmRoot.setAttribute('id', 'travel-ui-confirm');
    this._confirmRoot.setAttribute('visible', false);
    this._confirmRoot.setAttribute('position', '0 0 0.04');

    var dim = document.createElement('a-plane');
    dim.setAttribute('width', lay.panelWidth !== undefined ? lay.panelWidth : 1.20);
    dim.setAttribute('height', lay.panelHeight !== undefined ? lay.panelHeight : 0.80);
    dim.setAttribute('color', '#000000');
    dim.setAttribute('material',
      'shader: flat; opacity: 0.72; transparent: true; side: double; depthTest: false; depthWrite: false');
    dim.setAttribute('position', '0 0 0');
    this._applyMenuDrawOrder(dim);
    this._confirmRoot.appendChild(dim);

    var panel = this._makeImagePlane(panelSrc, cw, ch);
    panel.setAttribute('position', '0 0.06 0.01');
    this._confirmRoot.appendChild(panel);

    var yesEl = this._makeImagePlane(yesIdle, btnW, btnH);
    yesEl.setAttribute('position', (-(btnW + gap) * 0.5) + ' ' + btnY + ' 0.02');
    this._confirmRoot.appendChild(yesEl);

    var noEl = this._makeImagePlane(noIdle, btnW, btnH);
    noEl.setAttribute('position', ((btnW + gap) * 0.5) + ' ' + btnY + ' 0.02');
    this._confirmRoot.appendChild(noEl);

    this._confirmButtons = [];
    this._confirmButtons.push(this._registerPngButton(yesEl, {
      kind: 'confirm-yes',
      enabled: true,
      normalSrc: yesIdle,
      hoverSrc: yesHover,
      onPress: function () { self._confirmExitYes(); },
    }));
    this._confirmButtons.push(this._registerPngButton(noEl, {
      kind: 'confirm-no',
      enabled: true,
      normalSrc: noIdle,
      hoverSrc: noHover,
      onPress: function () { self._confirmExitNo(); },
    }));
    // Убрать confirm-кнопки из основного списка — они живут в _confirmButtons.
    this._buttons.length = 0;

    this._root.appendChild(this._confirmRoot);
  },

  _rebuildContent: function () {
    this._hideConfirm(true);
    this._clearContent();
    if (!this._contentRoot) return;

    var lay = this._lay();
    var panelW = lay.panelWidth !== undefined ? lay.panelWidth : 1.20;
    var panelH = lay.panelHeight !== undefined ? lay.panelHeight : 0.80;
    var btnW = lay.btnWidth !== undefined ? lay.btnWidth : 0.32;
    var btnH = lay.btnHeight !== undefined ? lay.btnHeight : 0.09;
    var btnGap = lay.btnGap !== undefined ? lay.btnGap : 0.06;
    var btnBottomPad = lay.btnBottomPad !== undefined ? lay.btnBottomPad : 0.056;
    var eraRowY = lay.eraRowY !== undefined ? lay.eraRowY : -0.02;
    var markerW = lay.markerWidth !== undefined ? lay.markerWidth : 0.158;
    var markerH = lay.markerHeight !== undefined ? lay.markerHeight : 0.292;
    var markerGap = lay.markerGap !== undefined ? lay.markerGap : 0.012;
    var lineH = lay.lineHeight !== undefined ? lay.lineHeight : 0.006;
    var iconSize = lay.iconSize !== undefined ? lay.iconSize : 0.09;
    var iconSidePad = lay.iconSidePad !== undefined ? lay.iconSidePad : 0.05;
    var locs = this._timelineLocations();
    var self = this;
    var count = locs.length;
    var i;

    // Close у низа панели.
    var panelBottom = -panelH * 0.5;
    var closeY = panelBottom + btnBottomPad + btnH * 0.5;
    var closeW = lay.closeWidth !== undefined ? lay.closeWidth : 0.40;

    // Горизонтальный таймлайн: past — present — future (слева → направо).
    var rowW = count * btnW + Math.max(0, count - 1) * btnGap;
    var x0 = -rowW * 0.5 + btnW * 0.5;

    // Линия за кнопками.
    if (count > 1 && lineH > 0) {
      var line = document.createElement('a-plane');
      line.setAttribute('width', rowW - btnW * 0.35);
      line.setAttribute('height', lineH);
      line.setAttribute('color', '#33e0ff');
      line.setAttribute('material',
        'shader: flat; opacity: 0.55; transparent: true; side: double; depthTest: false; depthWrite: false');
      line.setAttribute('position', '0 ' + eraRowY + ' 0.005');
      this._applyMenuDrawOrder(line);
      this._contentRoot.appendChild(line);
    }

    for (i = 0; i < count; i++) {
      var info = locs[i];
      var isCurrent = !!info.isCurrent;
      var enabled = !!info.enabled;
      var isHint = info.id === this._nextHint && enabled;

      var normalState = isCurrent ? 'current'
        : (!enabled ? 'disabled'
          : (isHint ? 'hover' : 'idle'));
      var hoverState = enabled ? 'hover' : normalState;
      var normalSrc = this._locSrc(info.id, normalState);
      var hoverSrc = this._locSrc(info.id, hoverState);

      var x = x0 + i * (btnW + btnGap);
      var eraEl = this._makeImagePlane(normalSrc, btnW, btnH);
      eraEl.setAttribute('position', x + ' ' + eraRowY + ' 0.01');
      this._contentRoot.appendChild(eraEl);

      (function (destId, el, nSrc, hSrc, canPress) {
        self._registerPngButton(el, {
          kind: 'location',
          locationId: destId,
          enabled: canPress,
          normalSrc: nSrc,
          hoverSrc: hSrc,
          onPress: function () {
            if (typeof window.canTravelTo === 'function' && !window.canTravelTo(destId)) {
              self._refreshEraButtons();
              return;
            }
            self._doTravel(destId);
          },
        });
      })(info.id, eraEl, normalSrc, hoverSrc, enabled && !isCurrent);
    }

    // Маркер «вы тут» — один раз; позицию ставим после регистрации кнопок.
    var markerSrc = this._assetUrl(this.assets.hereMarker || 'marker_here.png');
    var marker = this._makeImagePlane(markerSrc, markerW, markerH);
    this._contentRoot.appendChild(marker);
    this._hereMarkerEl = marker;

    var closeIdle = this._assetUrl(this.assets.closeIdle || 'btn_close_idle.png');
    var closeHover = this._assetUrl(this.assets.closeHover || 'btn_close_hover.png');
    var closeEl = this._makeImagePlane(closeIdle, closeW, btnH);
    closeEl.setAttribute('position', '0 ' + closeY + ' 0.01');
    this._contentRoot.appendChild(closeEl);
    this._registerPngButton(closeEl, {
      kind: 'close',
      isClose: true,
      enabled: true,
      normalSrc: closeIdle,
      hoverSrc: closeHover,
      onPress: function () {
        self.closeMenu();
      },
    });

    // Домик слева на баре — выход в главное меню (через confirm).
    var homeOff = this._assetUrl(this.assets.homeOff || 'icon_home_off.png');
    var homeOn = this._assetUrl(this.assets.homeOn || 'icon_home_on.png');
    var homeX = -panelW * 0.5 + iconSidePad + iconSize * 0.5;
    var homeEl = this._makeImagePlane(homeOff, iconSize, iconSize);
    homeEl.setAttribute('position', homeX + ' ' + eraRowY + ' 0.01');
    this._contentRoot.appendChild(homeEl);
    this._registerPngButton(homeEl, {
      kind: 'home',
      enabled: true,
      normalSrc: homeOff,
      hoverSrc: homeOn,
      onPress: function () {
        self._showConfirmExit();
      },
    });

    // Шестерёнка справа на баре — wireframe (как в game-menu).
    this._gearOffSrc = this._assetUrl(this.assets.gearOff || 'icon_gear_off.png');
    this._gearOnSrc = this._assetUrl(this.assets.gearOn || 'icon_gear_on.png');
    var gearOn = !!(CONFIG.debug && CONFIG.debug.showColliders);
    var gearSrc = gearOn ? this._gearOnSrc : this._gearOffSrc;
    var gearX = panelW * 0.5 - iconSidePad - iconSize * 0.5;
    var gearEl = this._makeImagePlane(gearSrc, iconSize, iconSize);
    gearEl.setAttribute('position', gearX + ' ' + eraRowY + ' 0.01');
    this._contentRoot.appendChild(gearEl);
    this._gearVis = gearEl;
    this._gearEntry = this._registerPngButton(gearEl, {
      kind: 'wireframe',
      enabled: true,
      normalSrc: gearSrc,
      hoverSrc: this._gearOnSrc,
      onPress: function () {
        self._toggleWireframe();
      },
    });

    this._menuButtons = this._buttons.slice();
    this._positionHereMarker();
  },

  /** Обновить состояния эпох без пересоздания plane/текстур. */
  _refreshEraButtons: function () {
    this._hideConfirm(true);
    var locs = this._timelineLocations();
    var byId = {};
    var i;
    for (i = 0; i < locs.length; i++) byId[locs[i].id] = locs[i];

    for (i = 0; i < this._menuButtons.length; i++) {
      var entry = this._menuButtons[i];
      if (entry.kind !== 'location' || !entry.locationId) continue;
      var info = byId[entry.locationId] || {
        id: entry.locationId,
        enabled: false,
        isCurrent: false,
      };
      var isCurrent = !!info.isCurrent;
      var enabled = !!info.enabled;
      var isHint = info.id === this._nextHint && enabled;
      var normalState = isCurrent ? 'current'
        : (!enabled ? 'disabled'
          : (isHint ? 'hover' : 'idle'));
      var hoverState = enabled ? 'hover' : normalState;
      entry.enabled = enabled && !isCurrent;
      entry.normalSrc = this._locSrc(info.id, normalState);
      entry.hoverSrc = this._locSrc(info.id, hoverState);
      this._setPlaneSrc(entry.data.el, entry.normalSrc);
      entry.data.el.setAttribute('scale', '1 1 1');
    }

    if (this._hereMarkerEl) {
      this._positionHereMarker();
    }
    this._refreshWireframeButton();
    this._buttons = this._menuButtons.slice();
    this._nearBtn = null;
  },

  /** Сдвинуть маркер «вы тут» по X над активной эпохой (Y как раньше — центр панели). */
  _positionHereMarker: function () {
    if (!this._hereMarkerEl) return;

    var currentId = null;
    if (typeof window.getActiveLocationId === 'function') {
      currentId = window.getActiveLocationId();
    }

    var x = 0;
    var found = false;
    var i;
    for (i = 0; i < this._menuButtons.length; i++) {
      var entry = this._menuButtons[i];
      if (entry.kind !== 'location' || !entry.locationId) continue;
      if (entry.locationId !== currentId) continue;
      var pos = entry.data.el.getAttribute('position');
      if (pos) {
        x = typeof pos === 'object' ? pos.x : parseFloat(String(pos).split(' ')[0]);
        if (!isFinite(x)) x = 0;
      }
      found = true;
      break;
    }

    this._hereMarkerEl.setAttribute('position', x + ' 0 0.008');
    this._hereMarkerEl.setAttribute('visible', !!found);
  },

  _showConfirmExit: function () {
    if (!this._shown || this._confirmShown || !this._confirmRoot) return;
    this._confirmShown = true;
    this._nearBtn = null;
    this._confirmRoot.setAttribute('visible', true);
    this._buttons = this._confirmButtons.slice();
    this._setClickable(true);
    console.log('[travel-ui] confirm: выход в главное меню?');
  },

  _hideConfirm: function (silent) {
    if (!this._confirmRoot) return;
    if (!this._confirmShown) {
      this._confirmRoot.setAttribute('visible', false);
      return;
    }
    this._confirmShown = false;
    this._nearBtn = null;
    this._confirmRoot.setAttribute('visible', false);
    for (var i = 0; i < this._confirmButtons.length; i++) {
      var entry = this._confirmButtons[i];
      if (entry.normalSrc) this._setPlaneSrc(entry.data.el, entry.normalSrc);
      entry.data.el.setAttribute('scale', '1 1 1');
    }
    if (this._menuButtons.length) {
      this._buttons = this._menuButtons.slice();
      if (!silent && this._shown) this._setClickable(true);
    }
  },

  _confirmExitNo: function () {
    this._hideConfirm(false);
  },

  _confirmExitYes: function () {
    if (this._busy) return;
    this._busy = true;
    console.log('[travel-ui] выход в главное меню');
    this._hideConfirm(true);
    this._hidePanel(true);
    if (typeof window.returnToMenu === 'function') {
      window.returnToMenu();
    }
    this._busy = false;
  },

  _toggleWireframe: function () {
    if (!CONFIG.debug) return;
    CONFIG.debug.showColliders = !CONFIG.debug.showColliders;
    this._refreshWireframeButton();
    if (typeof window.applyColliderDebugVisual === 'function') {
      window.applyColliderDebugVisual();
    }
  },

  _refreshWireframeButton: function () {
    if (!this._gearEntry || !this._gearVis) return;
    var on = !!(CONFIG.debug && CONFIG.debug.showColliders);
    var src = on ? this._gearOnSrc : this._gearOffSrc;
    this._gearEntry.normalSrc = src;
    this._gearEntry.hoverSrc = this._gearOnSrc;
    if (this._nearBtn !== this._gearEntry) {
      this._setPlaneSrc(this._gearVis, src);
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
        if (this._nearBtn.normalSrc) {
          this._setPlaneSrc(this._nearBtn.data.el, this._nearBtn.normalSrc);
        }
        this._nearBtn.data.el.setAttribute('scale', '1 1 1');
      }
      this._nearBtn = near;
      if (near) {
        if (near.hoverSrc) this._setPlaneSrc(near.data.el, near.hoverSrc);
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
    this._hideConfirm(true);
    this._nearBtn = null;
    this._nearHintLogged = false;
    this._setClickable(false);
    if (this._root) this._root.setAttribute('visible', false);
    // Контент оставляем — повторный open только обновляет состояния (без reload PNG).
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
      this._refreshEraButtons();
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
    var fromId = typeof window.getActiveLocationId === 'function'
      ? window.getActiveLocationId() : null;

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

    var afterJumpComic = function () {
      if (vfx) {
        vfx.playTravelTransition(doTravel);
      } else {
        setTimeout(doTravel, trans.sparkDurationMs || 2500);
      }
    };

    var playJumpComic = function () {
      var comic = self.el.sceneEl && self.el.sceneEl.components['comic-slides'];
      var seqId = comic && typeof comic.sequenceForTravel === 'function'
        ? comic.sequenceForTravel(fromId, destId) : null;
      if (seqId && comic && typeof comic.playSequence === 'function') {
        comic.playSequence(seqId, afterJumpComic);
      } else {
        afterJumpComic();
      }
    };

    if (veil) {
      veil.coverWorld(playJumpComic, trans.coverDurationMs || 450);
    } else {
      playJumpComic();
    }
  },

  _onAvailability: function () {
    if (!this._shown) return;
    this._refreshEraButtons();
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
    var opts = {
      source: 'auto',
      nextLocationId: d.nextLocationId || null,
    };
    var self = this;
    var comicKey = d.comicKey || 'first';
    var seqId = comicKey === 'rebuilt' ? 'travelReadyRebuilt' : 'travelReadyFirst';
    var comic = this.el.sceneEl && this.el.sceneEl.components['comic-slides'];
    if (comic && typeof comic.playSequence === 'function') {
      comic.playSequence(seqId, function () {
        self.openMenu(opts);
      });
      console.log('[travel-ui] travel-ready — comic then menu',
        '(next:', this._nextHint || '?', '| key:', comicKey, ')');
      return;
    }
    this.openMenu(opts);
    console.log('[travel-ui] travel-ready — menu',
      '(next:', this._nextHint || '?', ')');
  },
});
