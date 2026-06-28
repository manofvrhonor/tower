/* global AFRAME */

/**
 * desktop-ui-cursor.js — белое кольцо-прицел для UI (меню, победа).
 *
 * Работает и в Quest VR, и на desktop. Пересоздаёт a-cursor при каждом enable.
 * Во время игры (game-started) — убрано; после victory / return-to-menu — снова.
 */
(function () {
  var RAY_TARGETS = '.game-menu-clickable, .victory-ui-clickable';
  var CURSOR_ID = 'game-menu-cursor';

  function getCamera() {
    return document.querySelector('#player a-camera');
  }

  function getScene() {
    return document.querySelector('a-scene');
  }

  function removeCursor() {
    var cur = document.getElementById(CURSOR_ID);
    if (cur && cur.parentNode) {
      cur.parentNode.removeChild(cur);
    }
  }

  function enableDesktopUiCursor() {
    var cam = getCamera();
    if (!cam) return;

    removeCursor();

    var ray = 'objects: ' + RAY_TARGETS + '; far: 8';
    var cur = document.createElement('a-cursor');
    cur.setAttribute('id', CURSOR_ID);
    cur.setAttribute('raycaster', ray);
    cur.setAttribute('cursor', 'fuse: false; rayOrigin: entity');
    cur.setAttribute('visible', true);
    cur.setAttribute('position', '0 0 -0.6');
    cur.setAttribute('material', 'color: #ffffff; shader: flat');
    cur.setAttribute('geometry', 'primitive: ring; radiusInner: 0.006; radiusOuter: 0.011');
    cam.appendChild(cur);
  }

  function disableDesktopUiCursor() {
    removeCursor();
  }

  function bindSceneEvents() {
    var scene = getScene();
    if (!scene || bindSceneEvents._done) return;
    bindSceneEvents._done = true;

    scene.addEventListener('loaded', function () {
      enableDesktopUiCursor();
    });

    scene.addEventListener('game-started', function () {
      disableDesktopUiCursor();
    });

    scene.addEventListener('victory', function () {
      setTimeout(enableDesktopUiCursor, 50);
    });

    scene.addEventListener('return-to-menu', function () {
      setTimeout(enableDesktopUiCursor, 50);
    });
  }

  window.enableDesktopUiCursor = enableDesktopUiCursor;
  window.disableDesktopUiCursor = disableDesktopUiCursor;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSceneEvents);
  } else {
    bindSceneEvents();
  }
})();
