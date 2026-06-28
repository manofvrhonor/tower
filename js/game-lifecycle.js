/* global CONFIG */

/**
 * game-lifecycle.js — меню ↔ игра (сессия 29).
 *
 * startGame(): shuffle + спавн кубов/шаров/биты, показ ghost.
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
    if (CONFIG.victory) CONFIG.victory.stackHeight = preset.stackHeight;
    console.log('[game-lifecycle] difficulty:', id,
      '— balls:', preset.ballCount, 'stack:', preset.stackHeight);
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
    if (typeof window.clearRedBalls === 'function') window.clearRedBalls();
    if (typeof window.clearBallBat === 'function') window.clearBallBat();

    var ghost = document.getElementById('ghost-tower-hint');
    if (ghost) {
      ghost.setAttribute('visible', false);
      while (ghost.firstChild) ghost.removeChild(ghost.firstChild);
    }
  }

  function startGame() {
    if (state === 'playing') return;

    applyDifficulty(currentDifficulty);

    if (typeof window.shuffleVictoryScheme === 'function') {
      window.shuffleVictoryScheme();
    }

    if (typeof window.respawnFloatingCubes === 'function') {
      window.respawnFloatingCubes();
    }
    if (typeof window.respawnRedBalls === 'function') {
      window.respawnRedBalls();
    }
    if (typeof window.respawnBallBat === 'function') {
      window.respawnBallBat();
    }

    var ghost = document.getElementById('ghost-tower-hint');
    var ghostComp = ghost && ghost.components['ghost-tower-hint'];
    if (ghostComp && typeof ghostComp.rebuild === 'function') {
      ghostComp.rebuild();
      ghost.setAttribute('visible', true);
    }

    var scene = document.querySelector('a-scene');
    var vc = scene && scene.components['victory-check'];
    if (vc && typeof vc.reset === 'function') vc.reset();

    state = 'playing';
    scene.emit('game-started', { difficulty: currentDifficulty }, false);
    console.log('[game-lifecycle] game started');
  }

  function returnToMenu() {
    releaseAllGrabs();
    clearWorld();

    var scene = document.querySelector('a-scene');
    var vc = scene && scene.components['victory-check'];
    if (vc && typeof vc.reset === 'function') vc.reset();

    state = 'menu';
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
  window.returnToMenu = returnToMenu;
  window.getGameState = getState;
  window.getGameDifficulty = getDifficulty;
  window.setGameDifficulty = setDifficulty;

  var gameCfg = getGameCfg();
  applyDifficulty(gameCfg.defaultDifficulty || 'normal');
})();
