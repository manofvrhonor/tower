/* global CONFIG */

/**
 * init-session.js — случайная схема победы на каждую игру.
 *
 * shuffleVictoryScheme(): перемешивает targetColors (5) → stackColors[4] + excludedColor.
 * Вызывается при загрузке и при «Заново» (без reload — VR-сессия сохраняется).
 */
(function () {
  function shuffleVictoryScheme() {
    var fc = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    var victory = (typeof CONFIG !== 'undefined' && CONFIG.victory) || {};
    var palette = (fc.targetColors || []).slice();
    var need = victory.stackHeight || 4;

    if (palette.length < need + 1) {
      console.error('[init-session] need at least', need + 1, 'targetColors, got', palette.length);
      return false;
    }

    for (var i = palette.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = palette[i];
      palette[i] = palette[j];
      palette[j] = tmp;
    }

    victory.stackColors = palette.slice(0, need);
    victory.excludedColor = palette[need];

    console.log('[init-session] stack bottom→top:', victory.stackColors.join(' → '));
    console.log('[init-session] excluded this run:', victory.excludedColor);
    return true;
  }

  window.shuffleVictoryScheme = shuffleVictoryScheme;
  shuffleVictoryScheme();
})();
