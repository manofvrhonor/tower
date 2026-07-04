/* global CONFIG */

/**
 * spawn-floating-cubes.js — кубы + GLB-детали (3.5B.1) в #floating-cubes-root.
 * respawnFloatingCubes() — для «Заново» без reload.
 */
(function () {
  function findPartById(id) {
    var parts = (CONFIG && CONFIG.parts) || [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i].id === id) return parts[i];
    }
    return null;
  }

  function buildPhysxMaterialStr(ownLayer, collidesWithList, fm) {
    return 'restitution: ' + fm.restitution +
      '; staticFriction: ' + fm.staticFriction +
      '; dynamicFriction: ' + fm.dynamicFriction + '; ' +
      'collisionLayers: ' + ownLayer + '; ' +
      'collidesWithLayers: ' + collidesWithList;
  }

  function spawnPartEntity(part, position, mass, matStr, root) {
    var el = document.createElement('a-entity');
    el.setAttribute('id', 'part-' + part.id);
    el.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
    el.setAttribute('physx-material', matStr);
    el.setAttribute('floating-cube', '');
    el.setAttribute('float-motion-trail', '');
    el.setAttribute('part-entity', {
      partId: part.id,
      model: part.model,
      colliderModel: part.colliderModel,
      mass: mass,
    });
    el.dataset.isTarget = part.kind === 'mechanism' ? 'true' : 'false';
    el.dataset.partId = part.id;
    root.appendChild(el);
    return el;
  }

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
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var ownLayer = layers.FLOAT_CUBE;
    var collidesWithList = [
      layers.WORLD,
      layers.DOME,
      layers.FLOAT_CUBE,
      layers.GRAVITY_CUBE,
      layers.GRABBED_CUBE,
      layers.BALL,
      layers.BAT,
    ].join(', ');

    var targets = cfg.targetColors || [];
    var trashColor = cfg.trashColor || '#888888';
    var positions = cfg.spawnPositions || [];
    var size = cfg.size || 0.1;
    var mass = (cfg.mass !== undefined) ? cfg.mass : 1;
    var fm = cfg.floatMaterial || {
      restitution: 0.9, staticFriction: 0.05, dynamicFriction: 0.05,
    };
    var matStr = buildPhysxMaterialStr(ownLayer, collidesWithList, fm);

    var glbPartIds = cfg.glbPartIds || [];
    var glbParts = [];
    var gi;
    for (gi = 0; gi < glbPartIds.length; gi++) {
      var part = findPartById(glbPartIds[gi]);
      if (part && part.model && part.colliderModel) {
        glbParts.push(part);
      }
    }

    var nTargets = cfg.coloredCubeCount !== undefined ? cfg.coloredCubeCount : targets.length;
    var nTotal = positions.length;
    var cubeTargets = Math.max(0, nTargets - glbParts.length);
    if (nTotal < nTargets) {
      console.error('[spawn-floating-cubes] позиций меньше, чем цветных кубиков');
      return;
    }

    var created = 0;
    var posIdx = 0;
    var cubeTargetIdx = 0;

    for (gi = 0; gi < glbParts.length; gi++) {
      if (posIdx >= nTotal) break;
      var pGlb = positions[posIdx];
      if (typeof clampPositionToRoomDome === 'function') {
        pGlb = clampPositionToRoomDome(pGlb, size / 2);
      }
      spawnPartEntity(glbParts[gi], pGlb, mass, matStr, root);
      posIdx += 1;
      created += 1;
    }

    for (var i = posIdx; i < nTotal; i++) {
      var p = positions[i];
      if (typeof clampPositionToRoomDome === 'function') {
        p = clampPositionToRoomDome(p, size / 2);
      }
      var isTarget = cubeTargetIdx < cubeTargets;
      var color = isTarget ? targets[cubeTargetIdx] : trashColor;
      var idSuffix = isTarget ? ('color-' + (cubeTargetIdx + 1)) : ('trash-' + (i - posIdx - cubeTargets + 1));

      var el = document.createElement('a-entity');
      el.setAttribute('id', 'floating-cube-' + idSuffix);
      el.setAttribute('geometry',
        'primitive: box; width: ' + size + '; height: ' + size + '; depth: ' + size);
      el.setAttribute('material', 'color: ' + color);
      el.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
      el.setAttribute('physx-body', 'type: dynamic; mass: ' + mass + '; emitCollisionEvents: true');
      el.setAttribute('physx-material', matStr);
      el.setAttribute('floating-cube', '');
      el.setAttribute('float-motion-trail', '');
      el.dataset.isTarget = isTarget ? 'true' : 'false';

      root.appendChild(el);
      created += 1;
      if (isTarget) cubeTargetIdx += 1;
    }

    console.log('[spawn-floating-cubes] spawned', created,
      '(glb parts:', glbParts.length + ')');
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

  window.spawnFloatingCubes = spawn;
  window.clearFloatingCubes = clearCubes;
  window.respawnFloatingCubes = respawnFloatingCubes;
})();
