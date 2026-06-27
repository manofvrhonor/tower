/* global CONFIG */

/**
 * spawn-floating-cubes.js — наполняет #floating-cubes-root 11 entity
 * (см. CURRENT_TASK.md, задача 2). respawnFloatingCubes() — для «Заново» без reload.
 */
(function () {
  function spawn() {
    var cfg = (typeof CONFIG !== 'undefined') && CONFIG.floatingCubes;
    if (!cfg) {
      console.error('[spawn-floating-cubes] CONFIG.floatingCubes not found');
      return;
    }

    var root = document.getElementById('floating-cubes-root');
    if (!root) {
      console.error('[spawn-floating-cubes] #floating-cubes-root not found in DOM');
      return;
    }

    var layers = (CONFIG && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6,
    };
    var ownLayer = layers.FLOAT_CUBE;
    var collidesWithList = [
      layers.WORLD,
      layers.DOME,
      layers.FLOAT_CUBE,
      layers.GRAVITY_CUBE,
      layers.GRABBED_CUBE,
      layers.BALL,
    ].join(', ');

    var targets = cfg.targetColors || [];
    var trashColor = cfg.trashColor || '#888888';
    var positions = cfg.spawnPositions || [];
    var size = cfg.size || 0.1;
    var mass = (cfg.mass !== undefined) ? cfg.mass : 1;
    var fm = cfg.floatMaterial || {
      restitution: 0.9, staticFriction: 0.05, dynamicFriction: 0.05,
    };

    var nTargets = targets.length;
    var nTotal = positions.length;
    if (nTotal < nTargets) {
      console.error('[spawn-floating-cubes] позиций меньше, чем цветных кубиков');
      return;
    }

    var created = 0;
    for (var i = 0; i < nTotal; i++) {
      var p = positions[i];
      var isTarget = i < nTargets;
      var color = isTarget ? targets[i] : trashColor;
      var idSuffix = isTarget ? ('color-' + (i + 1)) : ('trash-' + (i - nTargets + 1));

      var el = document.createElement('a-entity');
      el.setAttribute('id', 'floating-cube-' + idSuffix);
      el.setAttribute('geometry',
        'primitive: box; width: ' + size + '; height: ' + size + '; depth: ' + size);
      el.setAttribute('material', 'color: ' + color);
      el.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
      el.setAttribute('physx-body', 'type: dynamic; mass: ' + mass + '; emitCollisionEvents: true');
      el.setAttribute('physx-material',
        'restitution: ' + fm.restitution +
        '; staticFriction: ' + fm.staticFriction +
        '; dynamicFriction: ' + fm.dynamicFriction + '; ' +
        'collisionLayers: ' + ownLayer + '; ' +
        'collidesWithLayers: ' + collidesWithList);
      el.setAttribute('floating-cube', '');
      el.setAttribute('float-motion-trail', '');
      el.dataset.isTarget = isTarget ? 'true' : 'false';

      root.appendChild(el);
      created++;
    }

    console.log('[spawn-floating-cubes] spawned', created, 'cubes');
  }

  function clearCubes() {
    var root = document.getElementById('floating-cubes-root');
    if (!root) return;
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
  }

  function respawnFloatingCubes() {
    clearCubes();
    spawn();
  }

  window.respawnFloatingCubes = respawnFloatingCubes;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', spawn);
  } else {
    spawn();
  }
})();
