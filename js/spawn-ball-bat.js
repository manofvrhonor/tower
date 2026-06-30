/* global CONFIG */

/**
 * spawn-ball-bat.js — бита в случайной точке большого купола.
 * respawnBallBat() — для «Заново» без reload.
 */
(function () {
  function buildBatEntity() {
    var cfg = (typeof CONFIG !== 'undefined') && CONFIG.bat;
    if (!cfg) {
      console.error('[spawn-ball-bat] CONFIG.bat not found');
      return null;
    }

    var layers = (CONFIG && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var ownLayer = layers.BAT;
    var collidesWithList = [
      layers.WORLD,
      layers.FLOAT_CUBE,
      layers.GRAVITY_CUBE,
      layers.GRABBED_CUBE,
      layers.BALL,
    ].join(', ');

    var panR = cfg.panRadius !== undefined ? cfg.panRadius : 0.11;
    var panT = cfg.panThickness !== undefined ? cfg.panThickness : 0.018;
    var hLen = cfg.handleLength !== undefined ? cfg.handleLength : 0.18;
    var hW = cfg.handleWidth !== undefined ? cfg.handleWidth : 0.04;
    var hT = cfg.handleThickness !== undefined ? cfg.handleThickness : 0.022;
    var mass = cfg.mass !== undefined ? cfg.mass : 0.35;
    var panColor = cfg.panColor || '#5a5a62';
    var handleColor = cfg.handleColor || '#6b4423';
    var bm = cfg.material || {
      restitution: 0.55, staticFriction: 0.55, dynamicFriction: 0.45,
    };

    var p = cfg.spawnPosition || { x: 0.12, y: 1.011, z: 0.14 };
    if (typeof window.randomPositionInRoomDome === 'function') {
      p = window.randomPositionInRoomDome(panR);
    }
    var rotY = Math.random() * 360;
    var rot = cfg.spawnRotation
      ? { x: cfg.spawnRotation.x, y: cfg.spawnRotation.y, z: cfg.spawnRotation.z }
      : { x: 15, y: rotY, z: 0 };

    // ВАЖНО: geometry НЕ на корне. Если на корне есть geometry, physx-body
    // строит только один шейп из неё и игнорирует дочерние меши (см. createShapes
    // в @c-frame/physx). Делаем блин и ручку дочерними → коллайдер на каждом,
    // захват работает по всей бите, включая кончик ручки.
    var el = document.createElement('a-entity');
    el.setAttribute('id', 'ball-bat');
    el.setAttribute('ball-bat', '');
    el.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
    el.setAttribute('rotation', rot.x + ' ' + rot.y + ' ' + rot.z);
    el.setAttribute('physx-body', 'type: dynamic; mass: ' + mass + '; emitCollisionEvents: true');
    el.setAttribute('physx-material',
      'restitution: ' + bm.restitution +
      '; staticFriction: ' + bm.staticFriction +
      '; dynamicFriction: ' + bm.dynamicFriction + '; ' +
      'collisionLayers: ' + ownLayer + '; ' +
      'collidesWithLayers: ' + collidesWithList);

    var pan = document.createElement('a-cylinder');
    pan.setAttribute('radius', panR);
    pan.setAttribute('height', panT);
    pan.setAttribute('material',
      'color: ' + panColor + '; metalness: 0.55; roughness: 0.38');
    el.appendChild(pan);

    var handle = document.createElement('a-box');
    var handleX = panR + hLen * 0.5;
    handle.setAttribute('position', handleX + ' 0 0');
    handle.setAttribute('width', hLen);
    handle.setAttribute('height', hT);
    handle.setAttribute('depth', hW);
    handle.setAttribute('material', 'color: ' + handleColor + '; roughness: 0.85');
    el.appendChild(handle);

    return el;
  }

  function spawn() {
    var root = document.getElementById('ball-bat-root');
    if (!root) {
      console.error('[spawn-ball-bat] #ball-bat-root not found');
      return;
    }
    var el = buildBatEntity();
    if (el) root.appendChild(el);
    console.log('[spawn-ball-bat] spawned ball-bat');
  }

  function respawnBallBat() {
    var existing = document.getElementById('ball-bat');
    if (existing) {
      var comp = existing.components['ball-bat'];
      if (comp && typeof comp.resetToSpawn === 'function') {
        comp.resetToSpawn();
        return;
      }
      existing.parentNode.removeChild(existing);
    }
    var root = document.getElementById('ball-bat-root');
    if (!root) return;
    var el = buildBatEntity();
    if (el) root.appendChild(el);
  }

  function clearBat() {
    var existing = document.getElementById('ball-bat');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var root = document.getElementById('ball-bat-root');
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  window.spawnBallBat = spawn;
  window.clearBallBat = clearBat;
  window.respawnBallBat = respawnBallBat;
})();
