/* global CONFIG */

/**
 * menu-ui-layout — расчёт размеров панели и позиций кнопок по строкам (game-menu, victory-ui).
 * Добавление строк или кнопок в spec автоматически расширяет чёрную плашку.
 */
(function () {
  function getLayoutDefaults() {
    var g = (typeof CONFIG !== 'undefined' && CONFIG.game) || {};
    var L = g.menuLayout || {};
    return {
      paddingTop: L.paddingTop !== undefined ? L.paddingTop : 0.06,
      paddingBottom: L.paddingBottom !== undefined ? L.paddingBottom : 0.06,
      paddingH: L.paddingH !== undefined ? L.paddingH : 0.05,
      rowGap: L.rowGap !== undefined ? L.rowGap : 0.04,
      colGap: L.colGap !== undefined ? L.colGap : 0.02,
      titleGap: L.titleGap !== undefined ? L.titleGap : 0.05,
      hoverPad: L.hoverPad !== undefined ? L.hoverPad : 0.04,
      buttonZ: L.buttonZ !== undefined ? L.buttonZ : 0.01,
      titleZ: L.titleZ !== undefined ? L.titleZ : 0.006,
      minPanelWidth: L.minPanelWidth !== undefined ? L.minPanelWidth : 0.62,
    };
  }

  function rowItems(row) {
    return row.buttons || row.items || [];
  }

  function rowWidth(row, colGap) {
    var items = rowItems(row);
    if (items.length === 0) return 0;
    var w = 0;
    for (var i = 0; i < items.length; i++) {
      w += items[i].width || items[i].w || 0;
      if (i > 0) w += colGap;
    }
    return w;
  }

  function rowHeight(row) {
    var items = rowItems(row);
    var maxH = 0;
    for (var i = 0; i < items.length; i++) {
      var h = items[i].height || items[i].h || 0;
      if (h > maxH) maxH = h;
    }
    return maxH;
  }

  function equalRowButtons(count, contentWidth, height, colGap) {
    if (count < 1) return [];
    var gap = colGap !== undefined ? colGap : 0.03;
    var w = (contentWidth - gap * (count - 1)) / count;
    var out = [];
    for (var i = 0; i < count; i++) out.push({ width: w, height: height });
    return out;
  }

  /**
   * spec.title — { width, height } или null
   * spec.rows — массив { buttons: [{ width, height }, ...] }
   */
  function computeMenuLayout(spec, options) {
    var opts = options || {};
    var d = getLayoutDefaults();
    var key;
    for (key in d) {
      if (opts[key] === undefined) opts[key] = d[key];
    }

    var rows = spec.rows || [];
    var title = spec.title || null;

    var contentWidth = title ? title.width : 0;
    for (var r = 0; r < rows.length; r++) {
      var rw = rowWidth(rows[r], opts.colGap);
      if (rw > contentWidth) contentWidth = rw;
    }

    var panelWidth = Math.max(opts.minPanelWidth, contentWidth + opts.paddingH * 2);

    var contentHeight = opts.paddingTop + opts.paddingBottom;
    if (title) {
      contentHeight += title.height + opts.titleGap;
    }
    for (var ri = 0; ri < rows.length; ri++) {
      contentHeight += rowHeight(rows[ri]);
      if (ri < rows.length - 1) contentHeight += opts.rowGap;
    }

    var panelHeight = contentHeight + opts.hoverPad;

    var result = {
      panel: { width: panelWidth, height: panelHeight },
      title: null,
      rows: [],
    };

    var yCursor = panelHeight / 2 - opts.paddingTop;

    if (title) {
      result.title = {
        x: 0,
        y: yCursor - title.height / 2,
        z: opts.titleZ,
        width: title.width,
        height: title.height,
      };
      yCursor -= title.height + opts.titleGap;
    }

    for (var rx = 0; rx < rows.length; rx++) {
      var row = rows[rx];
      var items = rowItems(row);
      var rH = rowHeight(row);
      var rW = rowWidth(row, opts.colGap);
      var rowCenterY = yCursor - rH / 2;
      var rowResult = { y: rowCenterY, buttons: [] };

      var xCursor = -rW / 2;
      for (var bi = 0; bi < items.length; bi++) {
        var btn = items[bi];
        var bw = btn.width || btn.w;
        var bh = btn.height || btn.h;
        rowResult.buttons.push({
          x: xCursor + bw / 2,
          y: rowCenterY,
          z: opts.buttonZ,
          width: bw,
          height: bh,
        });
        xCursor += bw + opts.colGap;
      }

      result.rows.push(rowResult);
      yCursor -= rH + opts.rowGap;
    }

    return result;
  }

  window.menuUiComputeLayout = computeMenuLayout;
  window.menuUiLayoutDefaults = getLayoutDefaults;
  window.menuUiEqualRowButtons = equalRowButtons;
})();
