/* global CONFIG */

/**
 * game-lifecycle.js — меню ↔ игра (сессия 29).
 *
 * startGame(): первый старт из меню.
 * restartGame(): «Заново» после победы (state уже playing).
 * returnToMenu(): очистка мира, сброс victory-check, показ меню.
 */
(function () {
  var state = 'menu';
  var currentDifficulty = 'normal';

  function getGameCfg() {
    return (typeof CONFIG !== 'undefined' && CONFIG.game) || {};
  }

  function applyDifficulty(id) {
    var game = getGameCfg();
    var preset = game.difficulties && game.difficulties[id];
    if (!preset) {
      console.error('[game-lifecycle] unknown difficulty:', id);
      return false;
    }
    currentDifficulty = id;
    if (CONFIG.balls) CONFIG.balls.count = preset.ballCount;
    console.log('[game-lifecycle] difficulty:', id,
      '— balls:', preset.ballCount,
      'pre-assembled:', (preset.preAssembled || []).join('') || '(none)',
      'junk:', preset.junkCount);
    return true;
  }

  function releaseAllGrabs() {
    var ids = ['leftHand', 'rightHand'];
    for (var i = 0; i < ids.length; i++) {
      var grab = document.getElementById(ids[i]);
      grab = grab && grab.components['physx-grab'];
      if (!grab) continue;
      if (grab.joint) grab.removeJoint();
      grab.grabbing = false;
      grab.hitEl = undefined;
    }
  }

  function clearWorld() {
    if (typeof window.clearFloatingCubes === 'function') window.clearFloatingCubes();
    if (window.ballWaveManager && typeof window.ballWaveManager.stopWaves === 'function') {
      window.ballWaveManager.stopWaves();
    }
    if (typeof window.clearRedBalls === 'function') window.clearRedBalls();
    if (typeof window.clearBallBat === 'function') window.clearBallBat();

    var ghost = document.getElementById('ghost-tower-hint');
    if (ghost) ghost.setAttribute('visible', false);

    var core = document.getElementById('assembly-core');
    var coreComp = core && core.components['assembly-core'];
    if (coreComp && typeof coreComp.resetOccupancy === 'function') {
      coreComp.resetOccupancy();
    }
  }

  function resetVictoryCheck() {
    var scene = document.querySelector('a-scene');
    var vc = scene && scene.components['victory-check'];
    if (vc && typeof vc.reset === 'function') vc.reset();
  }

  /** Спавн мира + сброс слотов/victory-check (общий для start и restart). */
  function spawnWorld() {
    applyDifficulty(currentDifficulty);

    if (typeof window.rollAssemblySession === 'function') {
      if (!window.rollAssemblySession()) {
        console.error('[game-lifecycle] rollAssemblySession failed');
      }
    }

    if (typeof window.respawnFloatingCubes === 'function') {
      window.respawnFloatingCubes();
    }
    var wavesOn = CONFIG.balls && CONFIG.balls.waves && CONFIG.balls.waves.enabled;
    if (wavesOn && window.ballWaveManager &&
        typeof window.ballWaveManager.startWaves === 'function') {
      window.ballWaveManager.startWaves();
    } else if (typeof window.respawnRedBalls === 'function') {
      window.respawnRedBalls();
    }
    if (typeof window.respawnBallBat === 'function') {
      window.respawnBallBat();
    }

    var core = document.getElementById('assembly-core');
    var coreComp = core && core.components['assembly-core'];
    if (coreComp && typeof coreComp.resetOccupancy === 'function') {
      coreComp.resetOccupancy();
    }

    resetVictoryCheck();
  }

  function emitGameStarted() {
    var scene = document.querySelector('a-scene');
    if (scene) {
      scene.emit('game-started', { difficulty: currentDifficulty }, false);
    }
  }

  function startGame() {
    if (state === 'playing') return;

    spawnWorld();
    state = 'playing';
    emitGameStarted();
    console.log('[game-lifecycle] game started');
  }

  /** «Заново» на плашке победы — state уже playing, нужен полный респawn. */
  function restartGame() {
    releaseAllGrabs();
    clearWorld();
    spawnWorld();
    state = 'playing';
    emitGameStarted();
    console.log('[game-lifecycle] game restarted');
  }

  function returnToMenu() {
    releaseAllGrabs();
    clearWorld();
    resetVictoryCheck();

    state = 'menu';
    var scene = document.querySelector('a-scene');
    if (scene) scene.emit('return-to-menu', null, false);
    console.log('[game-lifecycle] returned to menu');
  }

  function getState() {
    return state;
  }

  function getDifficulty() {
    return currentDifficulty;
  }

  function setDifficulty(id) {
    return applyDifficulty(id);
  }

  window.applyDifficulty = applyDifficulty;
  window.startGame = startGame;
  window.restartGame = restartGame;
  window.returnToMenu = returnToMenu;
  window.getGameState = getState;
  window.getGameDifficulty = getDifficulty;
  window.setGameDifficulty = setDifficulty;

  var gameCfg = getGameCfg();
  applyDifficulty(gameCfg.defaultDifficulty || 'normal');
})();
