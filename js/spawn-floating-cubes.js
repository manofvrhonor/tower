/* global CONFIG */

/**
 * spawn-floating-cubes.js — детали сборки + junk из CONFIG.session.
 * respawnFloatingCubes() — для «Заново» без reload.
 */
(function () {
  function getVisualLocation() {
    if (typeof getActiveLocation === 'function') {
      var active = getActiveLocation();
      if (active) return active;
    }
    var locs = (typeof CONFIG !== 'undefined' && CONFIG.locations) || [];
    var i;
    for (i = 0; i < locs.length; i++) {
      if (locs[i].start) return locs[i];
    }
    return locs.length ? locs[0] : null;
  }

  function stageIdSetForLocation(loc) {
    var set = {};
    var ids = (loc && loc.stageIds) || [];
    var i;
    for (i = 0; i < ids.length; i++) set[ids[i]] = true;
    return set;
  }

  function isStageSnappedOnCore(stage) {
    var coreEl = document.getElementById('assembly-core');
    var core = coreEl && coreEl.components['assembly-core'];
    if (!core || !stage.slotId) return false;
    return core.isSlotOccupied(stage.slotId);
  }

  function partAlreadySpawned(stage) {
    return !!document.getElementById('part-' + stage.partId);
  }

  function stagesForLocation(loc, session) {
    var allowed = stageIdSetForLocation(loc);
    var stages = (session && session.stages) || [];
    var out = [];
    var i;
    for (i = 0; i < stages.length; i++) {
      var st = stages[i];
      if (!allowed[st.stageId]) continue;
      if (isStageSnappedOnCore(st)) continue;
      if (partAlreadySpawned(st)) continue;
      out.push(st);
    }
    return out;
  }

  function collectPlacedFromRoot(root) {
    var placed = [];
    if (!root) return placed;
    var spawn = (typeof CONFIG !== 'undefined' && CONFIG.spawn) || {};
    var fallbackR = spawn.fallbackRadius !== undefined ? spawn.fallbackRadius : 0.05;
    var i;
    for (i = 0; i < root.children.length; i++) {
      var el = root.children[i];
      var r = fallbackR;
      if (el.dataset && el.dataset.spawnRadius) {
        r = parseFloat(el.dataset.spawnRadius) || r;
      }
      var p = el.object3D && el.object3D.position;
      if (!p) continue;
      placed.push({ x: p.x, y: p.y, z: p.z, r: r });
    }
    return placed;
  }

  function bindLocationSpawn() {
    var scene = document.querySelector('a-scene');
    if (!scene || scene._spawnLocationBound) return;
    scene._spawnLocationBound = true;
    scene.addEventListener('location-changed', function (evt) {
      var d = evt.detail || {};
      if (d.reason !== 'travel') return;
      spawnMissingForLocation(d.location);
    });
  }

  function spawnMissingForLocation(loc) {
    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    if (!session) return;
    var stages = stagesForLocation(loc || getVisualLocation(), session);
    if (!stages.length) return;
    var created = spawnParts(stages, session, { junk: false, posStart: null });
    console.log('[spawn-floating-cubes] epoch parts +', created,
      '(', loc && loc.id, '| stages:', stages.map(function (s) {
        return s.stageId;
      }).join(''), ')');
  }

  function buildPhysxMaterialStr(ownLayer, collidesWithList, fm) {
    return 'restitution: ' + fm.restitution +
      '; staticFriction: ' + fm.staticFriction +
      '; dynamicFriction: ' + fm.dynamicFriction + '; ' +
      'collisionLayers: ' + ownLayer + '; ' +
      'collidesWithLayers: ' + collidesWithList;
  }

  function defaultBodyRadius(size) {
    var spawn = (typeof CONFIG !== 'undefined' && CONFIG.spawn) || {};
    if (spawn.fallbackRadius !== undefined) return spawn.fallbackRadius;
    return size / 2;
  }

  /** Радиус clamp: spawnRadius из сессии → кэш _COL → fallback. */
  function bodyRadiusForStage(stage, size) {
    if (stage.spawnRadius !== undefined) return stage.spawnRadius;
    if (stage.colliderModel && typeof getCachedColliderRadius === 'function') {
      var cached = getCachedColliderRadius(stage.colliderModel);
      if (cached !== null) return cached;
    }
    return defaultBodyRadius(size);
  }

  function bodyRadiusForJunk(item, size) {
    if (item.type === 'cube') return size / 2;
    if (item.spawnRadius !== undefined) return item.spawnRadius;
    if (item.colliderModel && typeof getCachedColliderRadius === 'function') {
      var cached = getCachedColliderRadius(item.colliderModel);
      if (cached !== null) return cached;
    }
    return defaultBodyRadius(size);
  }

  function effectiveSpawnRadius(r) {
    var spawn = (typeof CONFIG !== 'undefined' && CONFIG.spawn) || {};
    var mult = spawn.radiusSafetyMult !== undefined ? spawn.radiusSafetyMult : 1.1;
    return r * mult;
  }

  function separationGap() {
    var spawn = (typeof CONFIG !== 'undefined' && CONFIG.spawn) || {};
    return spawn.separationGap !== undefined ? spawn.separationGap : 0.06;
  }

  /** Развести pos от уже поставленных (центры ближе sum(r)+gap → сдвиг). */
  function separateFromPlaced(pos, radius, placed) {
    var out = { x: pos.x, y: pos.y, z: pos.z };
    var gap = separationGap();
    var i;
    for (i = 0; i < placed.length; i++) {
      var p = placed[i];
      var dx = out.x - p.x;
      var dy = out.y - p.y;
      var dz = out.z - p.z;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var need = radius + p.r + gap;
      if (dist >= need) continue;
      if (dist > 1e-6) {
        var s = need / dist;
        out.x = p.x + dx * s;
        out.y = p.y + dy * s;
        out.z = p.z + dz * s;
      } else {
        out.x += need;
      }
      if (typeof clampPositionToRoomDome === 'function') {
        out = clampPositionToRoomDome(out, radius);
      }
    }
    placed.push({ x: out.x, y: out.y, z: out.z, r: radius });
    return out;
  }

  function prepareSpawnPosition(rawPos, bodyRadius, placed) {
    var r = effectiveSpawnRadius(bodyRadius);
    var p = rawPos;
    if (typeof clampPositionToRoomDome === 'function') {
      p = clampPositionToRoomDome(p, r);
    }
    return separateFromPlaced(p, r, placed);
  }

  function tagSpawnRadius(el, radius) {
    if (el && el.dataset && radius !== undefined) {
      el.dataset.spawnRadius = String(radius);
    }
  }

  function spawnStagePart(stage, position, mass, matStr, root, bodyRadius) {
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
    tagSpawnRadius(el, bodyRadius);
    return el;
  }

  function spawnJunkGlb(item, position, mass, matStr, root, bodyRadius) {
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
    tagSpawnRadius(el, bodyRadius);
    return el;
  }

  function spawnJunkCube(item, position, size, mass, matStr, root, bodyRadius) {
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
    tagSpawnRadius(el, bodyRadius);
    return el;
  }

  function spawnParts(stages, session, opts) {
    opts = opts || {};
    var cfg = (typeof CONFIG !== 'undefined') && CONFIG.floatingCubes;
    if (!cfg) {
      console.error('[spawn-floating-cubes] CONFIG.floatingCubes not found');
      return 0;
    }

    var root = document.getElementById('floating-cubes-root');
    if (!root) {
      console.error('[spawn-floating-cubes] #floating-cubes-root not found in DOM');
      return 0;
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

    var junkItems = opts.junk === false ? [] : (session.junkItems || []);
    var total = stages.length + junkItems.length;
    var posIdx = opts.posStart != null ? opts.posStart : 0;
    if (positions.length < posIdx + total) {
      console.warn('[spawn-floating-cubes] spawn positions:', positions.length,
        'need', posIdx + total);
    }

    var created = 0;
    var i;
    var placed = collectPlacedFromRoot(root);

    for (i = 0; i < stages.length; i++) {
      if (posIdx >= positions.length) break;
      var rMech = bodyRadiusForStage(stages[i], size);
      var pMech = prepareSpawnPosition(positions[posIdx], rMech, placed);
      spawnStagePart(stages[i], pMech, mass, matStr, root, rMech);
      posIdx += 1;
      created += 1;
    }

    for (i = 0; i < junkItems.length; i++) {
      if (posIdx >= positions.length) break;
      var rJunk = bodyRadiusForJunk(junkItems[i], size);
      var pJunk = prepareSpawnPosition(positions[posIdx], rJunk, placed);
      if (junkItems[i].type === 'glb') {
        spawnJunkGlb(junkItems[i], pJunk, mass, matStr, root, rJunk);
      } else {
        spawnJunkCube(junkItems[i], pJunk, size, mass, matStr, root, rJunk);
      }
      posIdx += 1;
      created += 1;
    }

    return created;
  }

  function spawn() {
    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    if (!session) {
      console.error('[spawn-floating-cubes] CONFIG.session missing — rollAssemblySession first');
      return;
    }

    var loc = getVisualLocation();
    var stages = stagesForLocation(loc, session);
    var created = spawnParts(stages, session, { junk: true, posStart: 0 });

    console.log('[spawn-floating-cubes] spawned', created,
      '(epoch:', loc && loc.id, '| stages:', stages.length,
      'junk:', (session.junkItems || []).length + ')');
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
    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    if (!session) {
      console.error('[spawn-floating-cubes] CONFIG.session missing — rollAssemblySession first');
      return;
    }
    var runSpawn = function () {
      spawn();
    };
    if (typeof preloadSessionColliderBounds === 'function') {
      preloadSessionColliderBounds(session).then(runSpawn).catch(function (err) {
        console.warn('[spawn-floating-cubes] COL preload failed:', err);
        runSpawn();
      });
      return;
    }
    runSpawn();
  }

  window.spawnFloatingCubes = spawn;
  window.clearFloatingCubes = clearCubes;
  window.respawnFloatingCubes = respawnFloatingCubes;
  window.spawnLocationParts = spawnMissingForLocation;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLocationSpawn);
  } else {
    bindLocationSpawn();
  }
})();
