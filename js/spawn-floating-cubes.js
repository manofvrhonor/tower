/* global CONFIG */

/**
 * spawn-floating-cubes.js — детали сборки + junk из CONFIG.session.
 * respawnFloatingCubes() — для «Заново» без reload.
 */
(function () {
  function buildPhysxMaterialStr(ownLayer, collidesWithList, fm) {
    return 'restitution: ' + fm.restitution +
      '; staticFriction: ' + fm.staticFriction +
      '; dynamicFriction: ' + fm.dynamicFriction + '; ' +
      'collisionLayers: ' + ownLayer + '; ' +
      'collidesWithLayers: ' + collidesWithList;
  }

  function spawnStagePart(stage, position, mass, matStr, root) {
    var el = document.createElement('a-entity');
    el.setAttribute('id', 'part-' + stage.partId);
    el.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
    el.setAttribute('physx-material', matStr);
    el.setAttribute('floating-cube', '');
    el.setAttribute('float-motion-trail', '');
    el.setAttribute('part-entity', {
      partId: stage.partId,
      model: stage.model,
      colliderModel: stage.colliderModel,
      mass: mass,
    });
    el.dataset.isTarget = 'true';
    el.dataset.partId = stage.partId;
    el.dataset.partRole = stage.role || '';
    // Предустановленная деталь (сложность): сразу снеп в свой слот + несбиваемая.
    if (stage.preAssembled) {
      el.dataset.startSnapped = 'true';
      el.dataset.startSlot = stage.slotId;
      el.dataset.fixed = 'true';
    }
    root.appendChild(el);
    return el;
  }

  function spawnJunkGlb(item, position, mass, matStr, root) {
    var el = document.createElement('a-entity');
    el.setAttribute('id', item.id);
    el.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
    el.setAttribute('physx-material', matStr);
    el.setAttribute('floating-cube', '');
    el.setAttribute('float-motion-trail', '');
    el.setAttribute('part-entity', {
      partId: item.id,
      model: item.model,
      colliderModel: item.colliderModel,
      mass: mass,
    });
    el.dataset.isTarget = 'false';
    el.dataset.partId = item.id;
    root.appendChild(el);
    return el;
  }

  function spawnJunkCube(item, position, size, mass, matStr, root) {
    var el = document.createElement('a-entity');
    el.setAttribute('id', item.id);
    el.setAttribute('geometry',
      'primitive: box; width: ' + size + '; height: ' + size + '; depth: ' + size);
    el.setAttribute('material', 'color: ' + item.color);
    el.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
    el.setAttribute('physx-body', 'type: dynamic; mass: ' + mass + '; emitCollisionEvents: true');
    el.setAttribute('physx-material', matStr);
    el.setAttribute('floating-cube', '');
    el.setAttribute('float-motion-trail', '');
    el.dataset.isTarget = 'false';
    root.appendChild(el);
    return el;
  }

  function spawn() {
    var cfg = (typeof CONFIG !== 'undefined') && CONFIG.floatingCubes;
    if (!cfg) {
      console.error('[spawn-floating-cubes] CONFIG.floatingCubes not found');
      return;
    }

    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    if (!session) {
      console.error('[spawn-floating-cubes] CONFIG.session missing — rollAssemblySession first');
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

    var positions = cfg.spawnPositions || [];
    var size = cfg.size || 0.1;
    var mass = (cfg.mass !== undefined) ? cfg.mass : 1;
    var fm = cfg.floatMaterial || {
      restitution: 0.9, staticFriction: 0.05, dynamicFriction: 0.05,
    };
    var matStr = buildPhysxMaterialStr(ownLayer, collidesWithList, fm);

    var stages = session.stages || [];
    var junkItems = session.junkItems || [];
    var total = stages.length + junkItems.length;
    if (positions.length < total) {
      console.warn('[spawn-floating-cubes] spawn positions:', positions.length,
        'need', total);
    }

    var created = 0;
    var posIdx = 0;
    var i;

    for (i = 0; i < stages.length; i++) {
      if (posIdx >= positions.length) break;
      var pMech = positions[posIdx];
      if (typeof clampPositionToRoomDome === 'function') {
        pMech = clampPositionToRoomDome(pMech, size / 2);
      }
      spawnStagePart(stages[i], pMech, mass, matStr, root);
      posIdx += 1;
      created += 1;
    }

    for (i = 0; i < junkItems.length; i++) {
      if (posIdx >= positions.length) break;
      var pJunk = positions[posIdx];
      if (typeof clampPositionToRoomDome === 'function') {
        pJunk = clampPositionToRoomDome(pJunk, size / 2);
      }
      if (junkItems[i].type === 'glb') {
        spawnJunkGlb(junkItems[i], pJunk, mass, matStr, root);
      } else {
        spawnJunkCube(junkItems[i], pJunk, size, mass, matStr, root);
      }
      posIdx += 1;
      created += 1;
    }

    console.log('[spawn-floating-cubes] spawned', created,
      '(stages:', stages.length, 'junk:', junkItems.length + ')');
  }

  function clearCubes() {
    var root = document.getElementById('floating-cubes-root');
    if (root) {
      while (root.firstChild) {
        root.removeChild(root.firstChild);
      }
    }
    // Снепнутые детали реперентятся под #assembly-core — их тоже убрать.
    var core = document.getElementById('assembly-core');
    if (core) {
      var kids = Array.prototype.slice.call(core.children);
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.dataset && el.dataset.partId) core.removeChild(el);
      }
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
