/* global AFRAME, CONFIG */

/**
 * Система slowmo-vfx — CSS-виньетка для десктопа/зеркала (#slowmo-vignette).
 * В VR — slowmo-vignette-3d на камере.
 */
AFRAME.registerSystem('slowmo-vfx', {
  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.slowmoFx &&
      CONFIG.slowmoFx.vignette) || {};
    this.overlay = document.getElementById('slowmo-vignette');
  },

  tick: function () {
    if (!this.overlay) return;

    var tsSys = this.el.systems['time-scale'];
    if (!tsSys) return;

    var ts = tsSys.getScale();
    var tsCfg = (typeof CONFIG !== 'undefined' && CONFIG.timeScale) || {};
    var tsMin = tsCfg.min !== undefined ? tsCfg.min : 0.05;
    var tsMax = tsCfg.max !== undefined ? tsCfg.max : 1.0;
    var range = tsMax - tsMin;
    if (range < 1e-6) return;

    var slowFactor = (tsMax - ts) / range;
    if (slowFactor < 0) slowFactor = 0;
    if (slowFactor > 1) slowFactor = 1;

    var maxOp = this.cfg.maxOpacity !== undefined ? this.cfg.maxOpacity : 0.22;
    this.overlay.style.opacity = String(maxOp * slowFactor);
  },
});
