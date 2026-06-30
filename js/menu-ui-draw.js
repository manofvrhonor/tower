/* global CONFIG */

/**
 * menu-ui-draw — общая отрисовка canvas-плашек меню (game-menu, victory-ui).
 * Цвета — CONFIG.game.menuTheme. Текст — по метрикам шрифта (ровно по центру).
 */
(function () {
  function getMenuTheme() {
    var g = (typeof CONFIG !== 'undefined' && CONFIG.game) || {};
    var t = g.menuTheme || {};
    return {
      panel: t.panel || '#0a1018',
      title: t.title || '#ffffff',
      titleAccent: t.titleAccent || '#66f5ff',
      btnBg: t.btnBg || '#0c1820',
      btnHover: t.btnHover || '#143040',
      btnNear: t.btnNear || '#1e5068',
      btnSelected: t.btnSelected || '#1488a8',
      btnAccent: t.btnAccent || '#33e0ff',
      btnAccentHover: t.btnAccentHover || '#66f5ff',
      btnAccentNear: t.btnAccentNear || '#b8ffff',
      border: t.border || '#33e0ff',
      borderDim: t.borderDim || '#1a5070',
      text: t.text || '#ffffff',
      textOnAccent: t.textOnAccent || '#061018',
    };
  }

  function canvasSizeForPlane(planeW, planeH, baseW) {
    var bw = baseW || 512;
    return { w: bw, h: Math.max(16, Math.round(bw * (planeH / planeW))) };
  }

  function drawCenteredText(ctx, text, w, h, fontSize, color) {
    ctx.fillStyle = color || '#ffffff';
    ctx.font = 'bold ' + fontSize + 'px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    var m = ctx.measureText(text);
    var y = h / 2;
    if (m.actualBoundingBoxAscent !== undefined && m.actualBoundingBoxDescent !== undefined) {
      ctx.textBaseline = 'alphabetic';
      y = (h + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    } else {
      ctx.textBaseline = 'middle';
    }
    ctx.fillText(text, w / 2, y);
  }

  function drawButtonCanvas(ctx, canvas, text, fontSize, bgColor, opts) {
    opts = opts || {};
    var w = canvas.width;
    var h = canvas.height;
    var pad = opts.borderWidth !== undefined ? opts.borderWidth : 3;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    if (opts.borderColor) {
      ctx.strokeStyle = opts.borderColor;
      ctx.lineWidth = pad;
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    }
    drawCenteredText(ctx, text, w, h, fontSize, opts.textColor || '#ffffff');
  }

  window.getMenuTheme = getMenuTheme;
  window.menuUiCanvasSize = canvasSizeForPlane;
  window.menuUiDrawButton = drawButtonCanvas;
  window.menuUiDrawCenteredText = drawCenteredText;
})();
