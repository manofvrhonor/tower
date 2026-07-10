/* global AFRAME, CONFIG, THREE */

/**
 * loop-timer — один таймер петли на весь забег (Фаза 5).
 *
 * UI на #rightHand рядом с wrist-travel-remote.
 * remaining -= dtSec * time-scale.getScale(); travel не сбрасывает.
 * 0 → scene.emit('defeat'); victory / return-to-menu → stop.
 */
AFRAME.registerComponent('loop-timer', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.loopTimer) || {};
    this._running = false;
    this._remaining = 0;
    this._defeated = false;
    this._anchorEl = null;
    this._planeEl = null;
    this._canvas = null;
    this._ctx = null;
    this._tex = null;
    this._lastDrawKey = '';
    this._visible = false;

    this._onGameStarted = this._onGameStarted.bind(this);
    this._onVictory = this._onVictory.bind(this);
    this._onReturnToMenu = this._onReturnToMenu.bind(this);

    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.addEventListener('victory', this._onVictory);
    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnToMenu);

    this._buildUI();
    this._setVisible(false);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.removeEventListener('victory', this._onVictory);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnToMenu);
    if (this._tex) {
      this._tex.dispose();
      this._tex = null;
    }
    if (this._anchorEl && this._anchorEl.parentNode) {
      this._anchorEl.parentNode.removeChild(this._anchorEl);
    }
    this._anchorEl = null;
    this._planeEl = null;
  },

  tick: function (time, delta) {
    if (!this._running || this._defeated) return;
    if (typeof window.isVictoryFrozen === 'function' && window.isVictoryFrozen()) return;

    var dtSec = (delta || 0) / 1000;
    if (dtSec <= 0) return;

    var scale = this._getTimeScale();
    this._remaining -= dtSec * scale;
    if (this._remaining < 0) this._remaining = 0;

    this._draw();

    if (this._remaining <= 0) {
      this._running = false;
      this._defeated = true;
      this.el.sceneEl.emit('defeat');
    }
  },

  _getTimeScale: function () {
    var sys = this.el.sceneEl.systems['time-scale'];
    if (!sys || typeof sys.getScale !== 'function') return 1;
    return sys.getScale();
  },

  _duration: function () {
    var d = this.cfg.durationSec;
    return d > 0 ? d : 180;
  },

  _onGameStarted: function () {
    this._defeated = false;
    this._remaining = this._duration();
    this._running = true;
    this._lastDrawKey = '';
    this._setVisible(true);
    this._draw();
  },

  _onVictory: function () {
    this._running = false;
  },

  _onReturnToMenu: function () {
    this._running = false;
    this._defeated = false;
    this._remaining = 0;
    this._lastDrawKey = '';
    this._setVisible(false);
  },

  _setVisible: function (on) {
    this._visible = !!on;
    if (this._anchorEl) {
      this._anchorEl.setAttribute('visible', on);
    }
  },

  _buildUI: function () {
    var pos = this.cfg.position || { x: 0.07, y: 0.13, z: -0.01 };
    var size = this.cfg.textPlaneSize !== undefined ? this.cfg.textPlaneSize : 0.04;
    // Плоскость чуть больше кольца, чтобы дуга и MM:SS читались на запястье.
    var planeSize = Math.max(size * 2.2, (this.cfg.radius || 0.028) * 2.6);

    var anchor = document.createElement('a-entity');
    anchor.setAttribute('class', 'loop-timer-anchor');
    anchor.setAttribute('position',
      (pos.x || 0) + ' ' + (pos.y || 0) + ' ' + (pos.z || 0));
    // Лицом к игроку с тыльной стороны правой руки (как пульт).
    anchor.setAttribute('rotation', '-90 0 0');
    this.el.appendChild(anchor);
    this._anchorEl = anchor;

    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');

    var plane = document.createElement('a-plane');
    plane.setAttribute('width', planeSize);
    plane.setAttribute('height', planeSize);
    plane.setAttribute('material', 'transparent: true; opacity: 1; side: double');
    plane.classList.add('loop-timer-plane');
    anchor.appendChild(plane);
    this._planeEl = plane;

    var self = this;
    var applyTex = function () {
      var mesh = plane.getObject3D('mesh');
      if (!mesh) return;
      if (self._tex) self._tex.dispose();
      self._tex = new THREE.CanvasTexture(canvas);
      self._tex.needsUpdate = true;
      mesh.material = new THREE.MeshBasicMaterial({
        map: self._tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      mesh.renderOrder = 9;
    };
    plane.addEventListener('loaded', applyTex);
    if (plane.hasLoaded) applyTex();
  },

  /** { main: 'M:SS', cs: 'CC' } — сотые отдельно, рисуются в 2× мельче. */
  _formatParts: function (sec) {
    var totalCs = Math.max(0, Math.floor(sec * 100 + 1e-6));
    var m = Math.floor(totalCs / 6000);
    var r = Math.floor((totalCs % 6000) / 100);
    var cs = totalCs % 100;
    return {
      main: m + ':' + (r < 10 ? '0' : '') + r,
      cs: (cs < 10 ? '0' : '') + cs,
    };
  },

  _draw: function () {
    if (!this._ctx || !this._canvas) return;

    var rem = this._remaining;
    var dur = this._duration();
    var frac = dur > 0 ? Math.max(0, Math.min(1, rem / dur)) : 0;
    var parts = this._formatParts(rem);
    var label = parts.main + ':' + parts.cs;
    var warnBelow = this.cfg.warnBelowSec !== undefined ? this.cfg.warnBelowSec : 30;
    var blinkHz = this.cfg.warnBlinkHz !== undefined ? this.cfg.warnBlinkHz : 2;
    var warn = rem > 0 && rem <= warnBelow;
    var blinkOn = true;
    if (warn && blinkHz > 0) {
      blinkOn = (Math.floor(performance.now() / 1000 * blinkHz * 2) % 2) === 0;
    }

    // Ключ: M:SS:CC + доля дуги + мигание.
    var fracBucket = Math.round(frac * 50);
    var drawKey = label + '|' + fracBucket + '|' + (warn ? (blinkOn ? '1' : '0') : 'n');
    if (drawKey === this._lastDrawKey) return;
    this._lastDrawKey = drawKey;

    var ctx = this._ctx;
    var w = this._canvas.width;
    var h = this._canvas.height;
    var cx = w / 2;
    var cy = h / 2;
    var ringR = w * 0.38;
    var tube = w * 0.055;
    var ringColor = this.cfg.ringColor || '#33e0ff';
    var emptyColor = this.cfg.ringEmptyColor || '#0a3040';
    var textColor = this.cfg.textColor || '#66f5ff';
    var bg = this.cfg.textBgColor || 'rgba(6, 16, 24, 0.55)';
    var fontSize = this.cfg.fontSize !== undefined ? this.cfg.fontSize : 42;
    var csSize = Math.max(10, Math.round(fontSize * 0.5));

    ctx.clearRect(0, 0, w, h);

    // Фон круга под цифрами.
    ctx.beginPath();
    ctx.arc(cx, cy, ringR - tube * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // Пустое кольцо.
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = emptyColor;
    ctx.lineWidth = tube;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Оставшаяся дуга (от 12 часов, по часовой = уменьшение).
    if (frac > 0.001 && (!warn || blinkOn)) {
      var start = -Math.PI / 2;
      var end = start + Math.PI * 2 * frac;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, start, end, false);
      ctx.strokeStyle = warn ? '#ff6688' : ringColor;
      ctx.lineWidth = tube;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    var fill = (!warn || blinkOn) ? (warn ? '#ff6688' : textColor) : 'rgba(102, 245, 255, 0.25)';
    var mainStr = parts.main + ':';
    var csStr = parts.cs;
    var fontMain = 'bold ' + fontSize + 'px sans-serif';
    var fontCs = 'bold ' + csSize + 'px sans-serif';

    ctx.font = fontMain;
    var mainW = ctx.measureText(mainStr).width;
    ctx.font = fontCs;
    var csW = ctx.measureText(csStr).width;
    var totalW = mainW + csW;
    var x0 = cx - totalW / 2;
    var y = cy + 2;

    ctx.fillStyle = fill;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = fontMain;
    ctx.fillText(mainStr, x0, y);
    ctx.font = fontCs;
    // Сотые чуть выше baseline крупных цифр — визуально «верхний индекс».
    ctx.fillText(csStr, x0 + mainW, y - fontSize * 0.12);

    if (this._tex) this._tex.needsUpdate = true;
  },
});
