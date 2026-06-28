/* global CONFIG */

/**
 * init-session.js — случайная схема победы на каждую игру.
 *
 * shuffleVictoryScheme(): перемешивает только цвета кубов, которые реально
 * есть в мире (coloredCubeCount). Для hard (башня 5) excluded — 6-й цвет
 * палитры без куба. Вызывается из startGame(), не при load.
 */
(function () {
  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function shuffleVictoryScheme() {
    var fc = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    var victory = (typeof CONFIG !== 'undefined' && CONFIG.victory) || {};
    var fullPalette = (fc.targetColors || []).slice();
    var spawnCount = fc.coloredCubeCount !== undefined ? fc.coloredCubeCount : fullPalette.length;
    var spawned = fullPalette.slice(0, spawnCount);
    var need = victory.stackHeight || 4;

    if (need < spawnCount) {
      // Лёгкий / нормальный: need цветов в башне + 1 excluded — все из кубов в мире.
      if (spawned.length < need + 1) {
        console.error('[init-session] need at least', need + 1,
          'spawned colors, got', spawned.length);
        return false;
      }
      shuffleArray(spawned);
      victory.stackColors = spawned.slice(0, need);
      victory.excludedColor = spawned[need];
    } else if (need === spawnCount) {
      // Сложный: все цветные кубы в башне; excluded — доп. цвет палитры без куба.
      shuffleArray(spawned);
      victory.stackColors = spawned.slice(0, need);
      victory.excludedColor = fullPalette[spawnCount] || null;
      if (!victory.excludedColor) {
        console.error('[init-session] hard mode: need 6th palette color beyond spawned cubes');
        return false;
      }
    } else {
      console.error('[init-session] stackHeight', need, 'exceeds spawned colors', spawnCount);
      return false;
    }

    console.log('[init-session] stack bottom→top:', victory.stackColors.join(' → '));
    console.log('[init-session] excluded this run:', victory.excludedColor);
    return true;
  }

  window.shuffleVictoryScheme = shuffleVictoryScheme;
})();
