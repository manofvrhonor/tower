/* global AFRAME, CONFIG, THREE */

/**
 * game-menu — wrap-карусель сложности (PNG) + Start + gear (Фаза 6, rewrite сессия 55).
 *
 * Макет: центр = выбранная карточка (яркая, неоновая cyan-рамка по контуру), боковые —
 * непрозрачные (opacity 1), затемнённые множителем цвета (арт серый), сдвинуты назад и
 * перекрыты центром. Wrap: всегда 2+2 карточки вокруг центра.
 *
 * Hover (ПК): raycaster бьёт в невидимый hit-plane (полный прямоугольник) — не в PNG,
 *   иначе прозрачные пиксели по краям не ловят курсор.
 * Hover (VR): расстояние руки до слота ≤ handPressRadiusCard.
 */
AFRAME.registerComponent('game-menu', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.game && CONFIG.game.menu) || {};
    this.assets = this.cfg.assets || {};
    this.carouselCfg = this.cfg.carousel || {};
    this.startCfg = this.cfg.startBtn || {};
    this.gearCfg = this.cfg.gearBtn || {};
    this._visible = true;
    this._starting = false;
    this._pulseT = 0;
    this._hoverPulseT = 0;
    this._selectedDifficulty = (CONFIG.game && CONFIG.game.defaultDifficulty) || 'normal';
    this._buttons = [];
    this._cardSlots = [];
    this._nearBtn = null;
    this._pointerEntry = null;
    this._centerFrame = null;
    this._onTick = this._onTick.bind(this);
    this._onHandPress = this._onHandPress.bind(this);
    this._onReturnToMenu = this._onReturnToMenu.bind(this);
    this._onGameStarted = this._onGameStarted.bind(this);

    this._applyMenuTheme();
    this._pressRadius = this.cfg.handPressRadius !== undefined ? this.cfg.handPressRadius : 0.18;
    this._pressRadiusCard = this.cfg.handPressRadiusCard !== undefined ? this.cfg.handPressRadiusCard : 0.32;
    this._menuRenderOrder = 50;

    this._diffOrder = (CONFIG.game && CONFIG.game.difficultyOrder) ||
      ['easy', 'normal', 'medium', 'hard', 'hardcore'];

    this._buildUI();
    this._bindHands();
    this._layoutCarousel();
    this._refreshWireframeButton();

    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnToMenu);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);
  },

  play: function () {
    this._facePlayer();
    if (this._visible && typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
  },

  pause: function () {},

  tick: function (time, delta) {
    this._onTick(time, delta);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnToMenu);
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this._unbindHands();
  },

  _applyMenuTheme: function () {
    var th = (typeof window.getMenuTheme === 'function') ? window.getMenuTheme() : {};
    this._theme = th;
    this._hoverCyan = this.carouselCfg.hoverCyan || th.titleAccent || '#66f5ff';
    this._frameColor = this.carouselCfg.frameColor || th.border || '#33e0ff';
  },

  _assetUrl: function (file) {
    var base = this.assets.basePath || 'assets/ui/menu/';
    return base + file;
  },

  _cardUrl: function (id) {
    var cards = this.assets.cards || {};
    return cards[id] ? this._assetUrl(cards[id]) : null;
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

  _applyPlaneMaterial: function (el, opts) {
    var ro = opts.renderOrder !== undefined ? opts.renderOrder : this._menuRenderOrder;
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

  _makeImagePlane: function (src, planeW, planeH, opts) {
    opts = opts || {};
    var ro = opts.renderOrder !== undefined ? opts.renderOrder : this._menuRenderOrder;
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
      renderOrder: ro,
    });
    this._applyPlaneMaterial(plane, { renderOrder: ro });
    return plane;
  },

  /** Полный прямоугольник для raycaster — без alphaTest (PNG прозрачность ломала hover по краям). */
  _makeHitPlane: function (planeW, planeH, renderOrder) {
    var ro = renderOrder !== undefined ? renderOrder : this._menuRenderOrder + 3;
    var plane = document.createElement('a-plane');
    plane.setAttribute('width', planeW);
    plane.setAttribute('height', planeH);
    plane.setAttribute('position', '0 0 0.006');
    plane.setAttribute('material', {
      opacity: 0.001,
      transparent: true,
      shader: 'flat',
      side: 'double',
      depthTest: false,
      depthWrite: false,
      renderOrder: ro,
    });
    plane.setAttribute('class', 'game-menu-clickable');
    this._applyPlaneMaterial(plane, { renderOrder: ro });
    return plane;
  },

  _setPlaneSrc: function (el, src) {
    var mesh = el.getObject3D('mesh');
    if (mesh && mesh.material && mesh.material.map) {
      mesh.material.map.dispose();
    }
    el.setAttribute('material', 'src', src);
  },

  /**
   * Неоновая cyan-рамка по контуру карточки + бегущий огонёк на canvas (additive).
   * Огонёк рисуется на текстуре рамки каждый tick — не отдельный mesh (не прячется за PNG).
   */
  _makeNeonFrame: function (cardW, cardH) {
    var th = this.carouselCfg.frameThickness !== undefined ? this.carouselCfg.frameThickness : 0.006;
    var pad = this.carouselCfg.framePad !== undefined ? this.carouselCfg.framePad : 0.016;
    var chamfer = this.carouselCfg.frameChamfer !== undefined ? this.carouselCfg.frameChamfer : 0.045;
    var glow = this.carouselCfg.frameGlow !== undefined ? this.carouselCfg.frameGlow : th * 8;
    var runColor = this.carouselCfg.runnerColor || '#e8feff';
    var runLen = this.carouselCfg.runnerLength !== undefined ? this.carouselCfg.runnerLength : 0.11;
    var runWid = this.carouselCfg.runnerWidth !== undefined ? this.carouselCfg.runnerWidth : 0.013;
    var runGlow = this.carouselCfg.runnerGlow !== undefined ? this.carouselCfg.runnerGlow : 0.038;
    var runSpeed = this.carouselCfg.runnerSpeed !== undefined ? this.carouselCfg.runnerSpeed : 0.67;
    var flashDur = this.carouselCfg.runnerFlashDurationMs !== undefined
      ? this.carouselCfg.runnerFlashDurationMs : 500;
    var flashMin = this.carouselCfg.runnerFlashIntervalMinMs !== undefined
      ? this.carouselCfg.runnerFlashIntervalMinMs : 2000;
    var flashMax = this.carouselCfg.runnerFlashIntervalMaxMs !== undefined
      ? this.carouselCfg.runnerFlashIntervalMaxMs : 3000;

    var halfWLine = cardW / 2 + pad;
    var halfHLine = cardH / 2 + pad;
    var extentX = halfWLine + th / 2 + glow;
    var extentY = halfHLine + th / 2 + glow;
    var planeW = extentX * 2;
    var planeH = extentY * 2;

    var bw = 512;
    var bh = Math.round(bw * (planeH / planeW));
    var pxPerM = bw / planeW;
    var canvas = document.createElement('canvas');
    canvas.width = bw;
    canvas.height = bh;
    var ctx = canvas.getContext('2d');

    var cx = bw / 2;
    var cy = bh / 2;
    var hw = halfWLine * pxPerM;
    var hh = halfHLine * pxPerM;
    var cPx = chamfer * pxPerM;
    var lwPx = th * pxPerM;
    var glowPx = glow * pxPerM;
    var color = this._frameColor;

    var pathRect = function () {
      ctx.beginPath();
      ctx.moveTo(cx - hw + cPx, cy - hh);
      ctx.lineTo(cx + hw - cPx, cy - hh);
      ctx.lineTo(cx + hw, cy - hh + cPx);
      ctx.lineTo(cx + hw, cy + hh - cPx);
      ctx.lineTo(cx + hw - cPx, cy + hh);
      ctx.lineTo(cx - hw + cPx, cy + hh);
      ctx.lineTo(cx - hw, cy + hh - cPx);
      ctx.lineTo(cx - hw, cy - hh + cPx);
      ctx.closePath();
    };

    var HW = halfWLine;
    var HH = halfHLine;
    var C = chamfer;
    var pts = [
      [-HW + C, HH], [HW - C, HH], [HW, HH - C], [HW, -HH + C],
      [HW - C, -HH], [-HW + C, -HH], [-HW, -HH + C], [-HW, HH - C],
    ];
    var segs = [];
    var total = 0;
    var pj;
    for (pj = 0; pj < pts.length; pj++) {
      var a = pts[pj];
      var b = pts[(pj + 1) % pts.length];
      var dx = b[0] - a[0];
      var dy = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      segs.push({ ax: a[0], ay: a[1], dx: dx / len, dy: dy / len, len: len, start: total });
      total += len;
    }

    var toCanvas = function (wx, wy) {
      return { x: cx + wx * pxPerM, y: cy - wy * pxPerM };
    };

    var pointAt = function (dist) {
      if (total <= 0) return { x: cx, y: cy, dx: 1, dy: 0 };
      var s = ((dist % total) + total) % total;
      var k;
      for (k = 0; k < segs.length; k++) {
        var sg = segs[k];
        if (s >= sg.start && s < sg.start + sg.len) {
          var d = s - sg.start;
          var wx = sg.ax + sg.dx * d;
          var wy = sg.ay + sg.dy * d;
          var p = toCanvas(wx, wy);
          return { x: p.x, y: p.y, dx: sg.dx, dy: -sg.dy };
        }
      }
      var last = segs[segs.length - 1];
      var p0 = toCanvas(last.ax + last.dx * last.len, last.ay + last.dy * last.len);
      return { x: p0.x, y: p0.y, dx: last.dx, dy: -last.dy };
    };

    var drawBase = function () {
      ctx.clearRect(0, 0, bw, bh);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      var passes = [
        { lw: lwPx * 1.0, blur: glowPx * 1.0,  alpha: 0.16 },
        { lw: lwPx * 0.9, blur: glowPx * 0.45, alpha: 0.24 },
        { lw: lwPx * 0.8, blur: glowPx * 0.12, alpha: 0.55 },
      ];
      var pi;
      for (pi = 0; pi < passes.length; pi++) {
        ctx.globalAlpha = passes[pi].alpha;
        ctx.lineWidth = passes[pi].lw;
        ctx.shadowBlur = passes[pi].blur;
        pathRect();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    var drawRunner = function (centerDist, scale) {
      var sc = (scale !== undefined && scale > 0) ? scale : 1;
      if (sc < 0.01) return;
      var effLen = runLen * sc;
      var half = effLen * 0.5;
      var samples = 18;
      var runWpx = runWid * pxPerM * sc;
      var runGlowPx = runGlow * pxPerM * sc;
      var pts = [];
      var si;
      for (si = 0; si <= samples; si++) {
        pts.push(pointAt(centerDist - half + effLen * (si / samples)));
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (si = 1; si <= samples; si++) ctx.lineTo(pts[si].x, pts[si].y);
      ctx.strokeStyle = '#33e0ff';
      ctx.lineWidth = runWpx * 2.6;
      ctx.globalAlpha = 0.45 * sc;
      ctx.shadowColor = '#66f5ff';
      ctx.shadowBlur = runGlowPx * 2.2;
      ctx.stroke();
      ctx.restore();

      for (si = 0; si < samples; si++) {
        var u = (si + 0.5) / samples;
        var fade = Math.pow(Math.sin(Math.PI * u), 0.75);
        if (fade < 0.06) continue;
        ctx.beginPath();
        ctx.moveTo(pts[si].x, pts[si].y);
        ctx.lineTo(pts[si + 1].x, pts[si + 1].y);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = runWpx * (0.65 + 0.55 * fade);
        ctx.globalAlpha = (0.55 + 0.45 * fade) * sc;
        ctx.shadowColor = runColor;
        ctx.shadowBlur = runGlowPx * 0.85;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    var plane = document.createElement('a-plane');
    plane.setAttribute('width', planeW);
    plane.setAttribute('height', planeH);
    plane.setAttribute('position', '0 0 0.005');

    var self = this;
    var mat = null;
    var tex = null;
    var runnerT0 = null;
    var runnerS = 0;
    var flashUntil = 0;
    var flashStartAt = 0;
    var nextFlashAt = 0;

    var scheduleNextFlash = function (nowMs) {
      nextFlashAt = nowMs + flashMin + Math.random() * Math.max(0, flashMax - flashMin);
    };

    var maybeStartFlash = function (nowMs) {
      if (nowMs < flashUntil) return;
      if (nextFlashAt > 0 && nowMs < nextFlashAt) return;
      flashStartAt = nowMs;
      flashUntil = nowMs + flashDur;
      scheduleNextFlash(nowMs);
    };

    var flashScale = function (nowMs) {
      if (flashDur <= 0) return 1;
      var t = (nowMs - flashStartAt) / flashDur;
      if (t <= 0 || t >= 1) return 0;
      return Math.sin(Math.PI * t);
    };

    var redraw = function (withRunner, centerDist, runnerScale) {
      drawBase();
      if (withRunner) drawRunner(centerDist, runnerScale);
      if (tex) tex.needsUpdate = true;
    };

    var apply = function () {
      var mesh = plane.getObject3D('mesh');
      if (!mesh) return;
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
      });
      mesh.material = mat;
      mesh.renderOrder = self._menuRenderOrder - 1;
      runnerT0 = null;
      redraw(false, 0);
    };
    plane.addEventListener('loaded', apply);
    if (plane.hasLoaded) apply();

    return {
      el: plane,
      setPulse: function (alpha) {
        if (mat) mat.opacity = alpha;
      },
      updateRunner: function (dt, timeMs) {
        if (total <= 0) return;
        var now = (typeof timeMs === 'number' && isFinite(timeMs)) ? timeMs : performance.now();
        if (typeof timeMs === 'number' && isFinite(timeMs)) {
          if (runnerT0 === null) {
            runnerT0 = timeMs;
            scheduleNextFlash(timeMs);
          }
          runnerS = ((timeMs - runnerT0) * 0.001 * runSpeed) % total;
        } else {
          runnerS = (runnerS + (dt || 0.016) * runSpeed) % total;
          if (nextFlashAt === 0) scheduleNextFlash(now);
        }
        maybeStartFlash(now);
        if (now < flashUntil) {
          redraw(true, runnerS, flashScale(now));
        } else {
          redraw(false, 0, 0);
        }
      },
      resetRunner: function () {
        runnerT0 = null;
        runnerS = 0;
        flashUntil = 0;
        flashStartAt = 0;
        nextFlashAt = 0;
      },
    };
  },

  _registerFlatButton: function (el, meta) {
    var entry = {
      data: { el: el },
      kind: meta.kind,
      hitRadius: meta.hitRadius || this._pressRadius,
      normalSrc: meta.normalSrc,
      hoverSrc: meta.hoverSrc || meta.normalSrc,
      onPress: meta.onPress,
    };
    this._buttons.push(entry);

    var self = this;
    el.addEventListener('click', function () {
      if (!self._visible || self._starting) return;
      entry.onPress();
    });
    el.addEventListener('mouseenter', function () {
      if (!self._visible || self._starting) return;
      self._pointerEntry = entry;
      self._applyFlatHover(entry, true);
    });
    el.addEventListener('mouseleave', function () {
      if (!self._visible || self._starting) return;
      if (self._pointerEntry === entry) self._pointerEntry = null;
      self._applyFlatHover(entry, false);
    });

    return entry;
  },

  _registerCardButton: function (hitEl, slotData, meta) {
    var entry = {
      data: { el: hitEl },
      kind: 'difficulty',
      difficultyId: meta.difficultyId,
      slotEl: slotData.slot,
      slotData: slotData,
      hitRadius: this._pressRadiusCard,
      onPress: meta.onPress,
    };
    this._buttons.push(entry);

    var self = this;
    hitEl.addEventListener('click', function () {
      if (!self._visible || self._starting || !slotData.clickable) return;
      entry.onPress();
    });
    hitEl.addEventListener('mouseenter', function () {
      if (!self._visible || self._starting || !slotData.clickable) return;
      self._pointerEntry = entry;
      self._refreshCarouselVisuals();
    });
    hitEl.addEventListener('mouseleave', function () {
      if (!self._visible || self._starting) return;
      if (self._pointerEntry === entry) self._pointerEntry = null;
      self._refreshCarouselVisuals();
    });

    slotData.entry = entry;
    return entry;
  },

  /** Затемнение боковых: opacity всегда 1, только множитель цвета (арт серый → dim). */
  _applyCardVisual: function (slot, state) {
    var mesh = slot.card.getObject3D('mesh');
    if (!mesh || !mesh.material) return;
    var cyan = this._hoverCyan;
    var dimNear = this.carouselCfg.dimNear !== undefined ? this.carouselCfg.dimNear : 0.60;
    var dimFar = this.carouselCfg.dimFar !== undefined ? this.carouselCfg.dimFar : 0.34;

    mesh.material.opacity = 1;

    if (state.active) {
      if (state.hover) {
        var hm = 0.2 + 0.12 * Math.sin(this._hoverPulseT);
        mesh.material.color.set('#ffffff').lerp(new THREE.Color(cyan), hm);
      } else {
        mesh.material.color.set('#ffffff');
      }
      return;
    }

    var dim = state.absOffset >= 2 ? dimFar : dimNear;
    if (state.hover) {
      var mix = 0.55 + 0.3 * Math.sin(this._hoverPulseT);
      var base = new THREE.Color(dim, dim, dim);
      mesh.material.color.copy(base).lerp(new THREE.Color(cyan), mix);
    } else {
      mesh.material.color.setRGB(dim, dim, dim);
    }
  },

  /** Круговой (wrap) offset: ближайшее расстояние по кольцу difficultyOrder. */
  _carouselOffset: function (cardIndex, selectedIndex, n) {
    var d = cardIndex - selectedIndex;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  },

  /** Локальные размеры plane (как в PNG: 512×768, портрет). */
  _cardSize: function () {
    var w = this.carouselCfg.cardWidth !== undefined ? this.carouselCfg.cardWidth : 0.30;
    var pixel = (this.assets && this.assets.cardPixelSize) || { w: 512, h: 768 };
    var aspect = pixel.h / pixel.w;
    return { width: w, height: w * aspect };
  },

  /** Визуальный размер после cardRotationZ (для карусели и hit). */
  _cardVisualSize: function () {
    var s = this._cardSize();
    var rot = this.carouselCfg.cardRotationZ !== undefined ? this.carouselCfg.cardRotationZ : 0;
    if (Math.abs(rot) === 90 || Math.abs(rot) === 270) {
      return { width: s.height, height: s.width };
    }
    return { width: s.width, height: s.height };
  },

  _buildUI: function () {
    var pos = this.cfg.worldPosition || { x: 0, y: 1.55, z: -0.65 };
    var cardSize = this._cardSize();
    var carouselY = this.carouselCfg.carouselY !== undefined ? this.carouselCfg.carouselY : 0.14;
    var self = this;

    this._root = document.createElement('a-entity');
    this._root.setAttribute('id', 'game-menu-root');
    this._root.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);

    this._carouselRoot = document.createElement('a-entity');
    this._carouselRoot.setAttribute('position', '0 ' + carouselY + ' 0');
    this._root.appendChild(this._carouselRoot);

    this._cardSlots = [];
    var i;
    for (i = 0; i < this._diffOrder.length; i++) {
      var id = this._diffOrder[i];
      var src = this._cardUrl(id);
      if (!src) continue;

      var slot = document.createElement('a-entity');
      var cardRotZ = this.carouselCfg.cardRotationZ !== undefined ? this.carouselCfg.cardRotationZ : 0;
      if (cardRotZ) slot.setAttribute('rotation', '0 0 ' + cardRotZ);

      var frame = this._makeNeonFrame(cardSize.width, cardSize.height);
      frame.el.setAttribute('visible', false);
      slot.appendChild(frame.el);

      var card = this._makeImagePlane(src, cardSize.width, cardSize.height, {
        renderOrder: this._menuRenderOrder,
      });
      card.setAttribute('position', '0 0 0');
      slot.appendChild(card);

      var hit = this._makeHitPlane(cardSize.width, cardSize.height);
      slot.appendChild(hit);

      this._carouselRoot.appendChild(slot);

      var slotData = {
        id: id, slot: slot, frame: frame,
        card: card, hit: hit, entry: null, carouselOffset: 0,
      };
      this._registerCardButton(hit, slotData, {
        difficultyId: id,
        onPress: (function (diffId) {
          return function () { self._selectDifficulty(diffId); };
        })(id),
      });
      // Полный layout после загрузки меша: renderOrder ставится только по загруженному
      // мешу, иначе на старте (меши не готовы) occlusion не проставлен и карточки наезжают.
      card.addEventListener('loaded', function () {
        self._layoutCarousel();
      }, { once: true });
      this._cardSlots.push(slotData);
    }

    var startW = this.startCfg.width !== undefined ? this.startCfg.width : 0.95;
    var startH = this.startCfg.height !== undefined ? this.startCfg.height : 0.267;
    var startY = this.startCfg.y !== undefined ? this.startCfg.y : -0.32;
    var startIdle = this._assetUrl(this.assets.startIdle || 'btn_start_idle.png');
    var startHover = this._assetUrl(this.assets.startHover || 'btn_start_hover.png');
    var startEl = this._makeImagePlane(startIdle, startW, startH);
    startEl.setAttribute('class', 'game-menu-clickable');
    startEl.setAttribute('position', '0 ' + startY + ' 0');
    this._startEntry = this._registerFlatButton(startEl, {
      kind: 'start',
      normalSrc: startIdle,
      hoverSrc: startHover,
      onPress: function () { self._onStart(); },
    });
    this._root.appendChild(startEl);

    var gearSize = this.gearCfg.size !== undefined ? this.gearCfg.size : 0.11;
    var gearY = this.gearCfg.y !== undefined ? this.gearCfg.y : -0.58;
    var gearOff = this._assetUrl(this.assets.gearOff || 'icon_gear_off.png');
    var gearOn = this._assetUrl(this.assets.gearOn || 'icon_gear_on.png');
    var gearEl = this._makeImagePlane(gearOff, gearSize, gearSize);
    gearEl.setAttribute('class', 'game-menu-clickable');
    gearEl.setAttribute('position', '0 ' + gearY + ' 0');
    this._gearVis = gearEl;
    this._gearOffSrc = gearOff;
    this._gearOnSrc = gearOn;
    this._wireframeEntry = this._registerFlatButton(gearEl, {
      kind: 'wireframe',
      normalSrc: gearOff,
      hoverSrc: gearOn,
      onPress: function () { self._toggleWireframe(); },
    });
    this._root.appendChild(gearEl);

    this.el.sceneEl.appendChild(this._root);

    this._btnPos = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
  },

  _selectedIndex: function () {
    var idx = this._diffOrder.indexOf(this._selectedDifficulty);
    return idx >= 0 ? idx : 0;
  },

  _layoutCarousel: function () {
    if (!this._cardSlots.length) return;
    var n = this._cardSlots.length;
    var center = this._selectedIndex();
    var spacing = this.carouselCfg.cardSpacing !== undefined ? this.carouselCfg.cardSpacing : 0.235;
    var farStep = this.carouselCfg.farSpacingStep !== undefined ? this.carouselCfg.farSpacingStep : 0.135;
    var sideScale = this.carouselCfg.sideScale !== undefined ? this.carouselCfg.sideScale : 0.78;
    var sideScaleFar = this.carouselCfg.sideScaleFar !== undefined ? this.carouselCfg.sideScaleFar : 0.50;
    var sideZ = this.carouselCfg.sideZ !== undefined ? this.carouselCfg.sideZ : 0.06;
    var maxVisible = this.carouselCfg.maxVisibleOffset !== undefined ? this.carouselCfg.maxVisibleOffset : 2;
    var clickMax = this.carouselCfg.clickableMaxOffset !== undefined ? this.carouselCfg.clickableMaxOffset : 1;
    this._centerFrame = null;
    var i;

    for (i = 0; i < n; i++) {
      var slot = this._cardSlots[i];
      var offset = this._carouselOffset(i, center, n);
      slot.carouselOffset = offset;
      var abs = Math.abs(offset);
      var visible = abs <= maxVisible;
      slot.slot.setAttribute('visible', visible);
      slot.clickable = visible && abs <= clickMax;
      if (!visible) continue;

      var scale = offset === 0 ? 1 : (abs >= 2 ? sideScaleFar : sideScale);
      var x = offset === 0 ? 0 : (offset > 0 ? 1 : -1) * (spacing + (abs - 1) * farStep);
      var z = -abs * sideZ;
      slot.slot.setAttribute('position', x + ' 0 ' + z);
      slot.slot.setAttribute('scale', scale + ' ' + scale + ' 1');
      slot.slot._baseScale = scale;
      slot.frame.el.setAttribute('visible', offset === 0);
      var ro = this._menuRenderOrder + (maxVisible - abs) * 4;
      this._setMeshRenderOrder(slot.card, ro);
      this._setMeshRenderOrder(slot.frame.el, ro + 1);
      this._setMeshRenderOrder(slot.hit, ro + 3);
      if (offset === 0) {
        this._centerFrame = slot.frame;
        if (slot.frame.resetRunner) slot.frame.resetRunner();
      }
    }

    this._refreshCarouselVisuals();
  },

  _setMeshRenderOrder: function (el, order) {
    var mesh = el.getObject3D('mesh');
    if (mesh && mesh.material) {
      mesh.renderOrder = order;
    }
  },

  _refreshCarouselVisuals: function () {
    var i;
    for (i = 0; i < this._cardSlots.length; i++) {
      var slot = this._cardSlots[i];
      if (slot.slot.getAttribute('visible') === false) continue;
      var isCenter = slot.carouselOffset === 0;
      var isHover = (this._pointerEntry && this._pointerEntry.slotData === slot) ||
        (this._nearBtn && this._nearBtn.slotData === slot);
      this._applyCardVisual(slot, {
        active: isCenter,
        hover: isHover,
        absOffset: Math.abs(slot.carouselOffset),
      });
      var base = slot.slot._baseScale || 1;
      var s = isHover ? base * 1.05 : base;
      slot.slot.setAttribute('scale', s + ' ' + s + ' 1');
    }
  },

  _updateFramePulse: function (dt, time) {
    if (!this._centerFrame) return;
    var speed = this.carouselCfg.pulseSpeed !== undefined ? this.carouselCfg.pulseSpeed : 3.2;
    this._pulseT += dt * speed;
    var pulse = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(this._pulseT));
    this._centerFrame.setPulse(pulse);
    if (this._centerFrame.updateRunner) this._centerFrame.updateRunner(dt, time);
  },

  _setNearEntry: function (entry) {
    if (entry === this._nearBtn) return;
    if (this._nearBtn && this._nearBtn.kind !== 'difficulty') {
      this._clearFlatHover(this._nearBtn);
    }
    this._nearBtn = entry;
    if (entry && entry.kind !== 'difficulty') {
      this._applyFlatHover(entry, true);
    }
    this._refreshCarouselVisuals();
  },

  _clearFlatHover: function (entry) {
    if (!entry || !entry.data || !entry.data.el) return;
    this._setPlaneSrc(entry.data.el, entry.normalSrc);
    entry.data.el.setAttribute('scale', '1 1 1');
  },

  _applyFlatHover: function (entry, on) {
    if (!entry || !entry.data || !entry.data.el) return;
    if (on) {
      this._setPlaneSrc(entry.data.el, entry.hoverSrc);
      entry.data.el.setAttribute('scale', entry.kind === 'wireframe' ? '1.08 1.08 1' : '1.04 1.04 1');
    } else {
      this._clearFlatHover(entry);
    }
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
    if (!this._wireframeEntry || !this._gearVis) return;
    var on = !!(CONFIG.debug && CONFIG.debug.showColliders);
    var src = on ? this._gearOnSrc : this._gearOffSrc;
    this._wireframeEntry.normalSrc = src;
    if (this._nearBtn !== this._wireframeEntry && this._pointerEntry !== this._wireframeEntry) {
      this._setPlaneSrc(this._gearVis, src);
    }
  },

  _selectDifficulty: function (id) {
    this._pointerEntry = null;
    this._selectedDifficulty = id;
    if (typeof window.setGameDifficulty === 'function') {
      window.setGameDifficulty(id);
    }
    this._layoutCarousel();
  },

  _getVeil: function () {
    return this.el.sceneEl && this.el.sceneEl.components['menu-world-veil'];
  },

  _getBackdropVfx: function () {
    return this.el.sceneEl && this.el.sceneEl.components['menu-backdrop-vfx'];
  },

  _onStart: function () {
    if (!this._visible || this._starting) return;
    this._starting = true;
    this._disableDesktopCursor();
    if (this._root) this._root.setAttribute('visible', false);

    var self = this;
    var vfx = this._getBackdropVfx();
    var veil = this._getVeil();

    var finish = function () {
      self._hide();
      if (typeof window.startGame === 'function') {
        window.startGame();
      }
      self._starting = false;
    };

    var reveal = function () {
      if (veil) {
        veil.revealWorld(finish);
      } else {
        finish();
      }
    };

    if (vfx) {
      vfx.playStartTransition(reveal);
    } else {
      reveal();
    }
  },

  _hide: function () {
    this._visible = false;
    this._nearBtn = null;
    this._pointerEntry = null;
    if (this._root) this._root.setAttribute('visible', false);
    this._disableDesktopCursor();
    var vfx = this._getBackdropVfx();
    if (vfx) vfx.setMenuActive(false);
  },

  _show: function () {
    this._visible = true;
    this._starting = false;
    this._nearBtn = null;
    this._pointerEntry = null;
    if (this._root) {
      this._root.setAttribute('visible', true);
      this._facePlayer();
    }
    this._layoutCarousel();
    this._refreshWireframeButton();
    if (typeof window.enableDesktopUiCursor === 'function') {
      window.enableDesktopUiCursor();
    }
    var vfx = this._getBackdropVfx();
    if (vfx) vfx.setMenuActive(true);
    var veil = this._getVeil();
    if (veil) veil.setMenuMode(true);
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
      var target = entry.slotEl || entry.data.el;
      if (entry.slotData && (entry.slotData.slot.getAttribute('visible') === false || !entry.slotData.clickable)) continue;
      target.object3D.getWorldPosition(this._btnPos);
      var radius = entry.hitRadius || this._pressRadius;
      for (var h = 0; h < this._handEls.length; h++) {
        this._getHandWorldPos(this._handEls[h]);
        var dist = this._handPos.distanceTo(this._btnPos);
        if (dist <= radius && dist < minDist) {
          minDist = dist;
          nearest = entry;
        }
      }
    }
    return nearest;
  },

  _onTick: function (time, delta) {
    if (!this._visible) return;
    var dt = (delta || 16) / 1000;
    this._hoverPulseT += dt * 4.5;
    this._updateFramePulse(dt, time);

    if (!this._pointerEntry) {
      var near = this._findNearestButton();
      if (near !== this._nearBtn) {
        this._setNearEntry(near);
      }
    }

    this._refreshCarouselVisuals();
  },

  _onHandPress: function () {
    if (!this._visible || !this._nearBtn || this._starting) return;
    this._nearBtn.onPress();
  },

  _disableDesktopCursor: function () {
    if (typeof window.disableDesktopUiCursor === 'function') {
      window.disableDesktopUiCursor();
    }
  },
});
