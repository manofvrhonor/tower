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

  /** Одинаковая физическая высота текста: ref-размер → fontSize для конкретной плашки. */
  function fontSizeOnPlane(uniformRefSize, planeW, planeH, refW, refH, baseW) {
    var bw = baseW || 512;
    var refPx = canvasSizeForPlane(refW, refH, bw).h;
    var planePx = canvasSizeForPlane(planeW, planeH, bw).h;
    return Math.round(uniformRefSize * (planePx / refPx));
  }

  /**
   * Общий множитель для btnFontSize: все подписи влезают, физический размер одинаковый.
   * При увеличении btnFontSize без btnHeight результат не меняется — нужны оба.
   */
  function uniformFontScaleForButtons(buttons, refW, refH, btnFontSize, baseW) {
    var bw = baseW || 512;
    var refPx = canvasSizeForPlane(refW, refH, bw).h;
    var scale = 1.0;
    var probe = document.createElement('canvas').getContext('2d');
    if (!probe) return 1;

    while (scale > 0.25) {
      var fits = true;
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var sz = canvasSizeForPlane(b.width, b.height, bw);
        var fs = Math.max(12, Math.round(btnFontSize * scale * sz.h / refPx));
        probe.font = 'bold ' + fs + 'px Arial, Helvetica, sans-serif';
        if (probe.measureText(b.text || '').width > sz.w * 0.88) {
          fits = false;
          break;
        }
      }
      if (fits) return scale;
      scale -= 0.02;
    }
    return 0.25;
  }

  /**
   * Максимальный uniformRefSize (относительно refW×refH), при котором все подписи влезают.
   * @deprecated используйте uniformFontScaleForButtons + fontSizeOnPlane
   */
  function uniformFontSizeForButtons(buttons, refW, refH, targetMax, baseW) {
    var scale = uniformFontScaleForButtons(buttons, refW, refH, targetMax, baseW);
    return Math.max(12, Math.round(targetMax * scale));
  }

  /** Подбор fontSize под размер плашки: ~42% высоты canvas, сжатие если текст шире кнопки. */
  function fontSizeForButton(text, planeW, planeH, opts) {
    opts = opts || {};
    var sz = canvasSizeForPlane(planeW, planeH, opts.canvasW || 512);
    var heightRatio = opts.heightRatio !== undefined ? opts.heightRatio : 0.42;
    var widthPad = opts.widthPad !== undefined ? opts.widthPad : 0.88;
    var minSize = opts.minSize !== undefined ? opts.minSize : 14;
    var fontSize = Math.round(sz.h * heightRatio);
    if (opts.maxSize !== undefined && fontSize > opts.maxSize) fontSize = opts.maxSize;

    var probe = document.createElement('canvas').getContext('2d');
    if (!probe) return fontSize;
    probe.textAlign = 'left';

    while (fontSize > minSize) {
      probe.font = 'bold ' + fontSize + 'px Arial, Helvetica, sans-serif';
      if (probe.measureText(text || '').width <= sz.w * widthPad) break;
      fontSize -= 2;
    }
    return fontSize;
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
      ctx.strokeRect(pad * 0.5, pad * 0.5, w - pad, h - pad);
    }
    drawCenteredText(ctx, text, w, h, fontSize, opts.textColor || '#ffffff');
  }

  /** Рамка и цвет текста для canvas-кнопки (game-menu, victory-ui). */
  function buttonDrawOpts(bgColor, theme) {
    var th = theme || getMenuTheme();
    if (bgColor === th.btnAccent || bgColor === th.btnAccentHover || bgColor === th.btnAccentNear) {
      return { borderColor: th.borderDim || th.border, textColor: th.textOnAccent || '#061018' };
    }
    if (bgColor === th.btnNear || bgColor === th.btnSelected) {
      return { borderColor: th.border, textColor: th.text || '#ffffff' };
    }
    return { borderColor: th.borderDim || th.border, textColor: th.text || '#ffffff' };
  }

  window.getMenuTheme = getMenuTheme;
  window.menuUiCanvasSize = canvasSizeForPlane;
  window.menuUiFontSizeOnPlane = fontSizeOnPlane;
  window.menuUiUniformFontScale = uniformFontScaleForButtons;
  window.menuUiUniformFontSize = uniformFontSizeForButtons;
  window.menuUiFontSizeForButton = fontSizeForButton;
  window.menuUiDrawButton = drawButtonCanvas;
  window.menuUiDrawCenteredText = drawCenteredText;
  window.menuUiButtonDrawOpts = buttonDrawOpts;
})();
