/* global CONFIG */

/**
 * spawn-red-balls.js — красные шары (Этап 6).
 * respawnRedBalls() — для «Заново» без reload.
 */
(function () {
  function spawn() {
    var cfg = (typeof CONFIG !== 'undefined') && CONFIG.balls;
    if (!cfg) {
      console.error('[spawn-red-balls] CONFIG.balls not found');
      return;
    }

    var root = document.getElementById('red-balls-root');
    if (!root) {
      console.error('[spawn-red-balls] #red-balls-root not found');
      return;
    }

    var layers = (CONFIG && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var ownLayer = layers.BALL;
    // BALL не сталкивается с DOME — пролетает сквозь стенку купola к башне
    // (как GRAVITY_CUBE). Стены комнаты — WORLD.
    var collidesWithList = [
      layers.WORLD,
      layers.FLOAT_CUBE,
      layers.GRAVITY_CUBE,
      layers.GRABBED_CUBE,
      layers.BALL,
      layers.BAT,
    ].join(', ');

    var positions = cfg.spawnPositions || [];
    var count = cfg.count !== undefined ? cfg.count : 3;
    var n = Math.min(count, positions.length);
    if (n === 0) {
      console.error('[spawn-red-balls] no spawn positions');
      return;
    }

    var radius = cfg.radius !== undefined ? cfg.radius : 0.07;
    var mass = cfg.mass !== undefined ? cfg.mass : 0.5;
    var color = cfg.color || '#E04040';
    var speedMin = cfg.speedMultiplierMin !== undefined ? cfg.speedMultiplierMin : 2.0;
    var speedMax = cfg.speedMultiplierMax !== undefined ? cfg.speedMultiplierMax : 3.0;
    if (speedMax < speedMin) { var tmp = speedMin; speedMin = speedMax; speedMax = tmp; }
    var bm = cfg.material || {
      restitution: 0.9, staticFriction: 0.05, dynamicFriction: 0.05,
    };
    var contactOff = cfg.contactOffset !== undefined ? cfg.contactOffset : 0.03;
    var contactStr = '; contactOffset: ' + contactOff;

    for (var i = 0; i < n; i++) {
      var p = positions[i];
      var el = document.createElement('a-entity');
      el.setAttribute('id', 'red-ball-' + (i + 1));
      el.setAttribute('geometry', 'primitive: sphere; radius: ' + radius);
      el.setAttribute('material', 'color: ' + color);
      el.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
      el.setAttribute('physx-body', 'type: dynamic; mass: ' + mass + '; emitCollisionEvents: true');
      el.setAttribute('physx-material',
        'restitution: ' + bm.restitution +
        '; staticFriction: ' + bm.staticFriction +
        '; dynamicFriction: ' + bm.dynamicFriction + contactStr + '; ' +
        'collisionLayers: ' + ownLayer + '; ' +
        'collidesWithLayers: ' + collidesWithList);
      var speedMult = speedMin + Math.random() * (speedMax - speedMin);
      el.setAttribute('red-ball', 'speedMultiplier: ' + speedMult.toFixed(3));
      el.setAttribute('float-motion-trail', '');
      root.appendChild(el);
    }

    console.log('[spawn-red-balls] spawned', n, 'balls on layer BALL');
  }

  function clearBalls() {
    var root = document.getElementById('red-balls-root');
    if (!root) return;
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
  }

  function respawnRedBalls() {
    clearBalls();
    spawn();
  }

  window.spawnRedBalls = spawn;
  window.clearRedBalls = clearBalls;
  window.respawnRedBalls = respawnRedBalls;
})();
