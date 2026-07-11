/* global CONFIG */

/**
 * init-session.js — снеп-цепочка A→F + ветки C1–C3, пулы по assemblyRoutes.
 *
 * rollAssemblySession(): GLB по stages оси; stub-кубы для branchSlots;
 * spawn/quota из CONFIG.assemblyRoutes[difficulty.routeId].
 * quotaStages → locations[].stageIds (travel); spawn → locationPools.
 */
(function () {
  var manifestCache = null;

  function shuffleArray(arr) {
    var a = arr.slice();
    var i;
    for (i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function machineCfg() {
    return (typeof CONFIG !== 'undefined' && CONFIG.machine) || {};
  }

  function colliderUrl(folder, file) {
    return folder + file.replace(/\.glb$/i, '_COL.glb');
  }

  function loadManifest() {
    if (manifestCache) return Promise.resolve(manifestCache);

    var mc = machineCfg();
    var url = mc.manifestUrl || 'assets/models/machine-manifest.json';
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('manifest HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        manifestCache = data;
        return data;
      })
      .catch(function () {
        console.warn('[init-session] manifest fetch failed — CONFIG.machine.manifest');
        manifestCache = mc.manifest || {};
        return manifestCache;
      });
  }

  function getDifficultyPreset() {
    var game = (typeof CONFIG !== 'undefined' && CONFIG.game) || {};
    var id = (typeof window.getGameDifficulty === 'function' && window.getGameDifficulty()) ||
      game.defaultDifficulty || 'normal';
    return game.difficulties && game.difficulties[id];
  }

  function getRoute(preset) {
    var routes = (typeof CONFIG !== 'undefined' && CONFIG.assemblyRoutes) || {};
    var id = (preset && preset.routeId) || 'L1';
    var route = routes[id];
    if (!route) {
      console.error('[init-session] unknown routeId:', id);
      return null;
    }
    return { id: id, route: route };
  }

  /** Поза стадии i: originOffset + i*step по chain.axis + опц. stages[i].position. */
  function stagePose(chain, i) {
    var axis = (chain.axis || 'z').toLowerCase();
    var d = (chain.originOffset || 0) + i * (chain.step || 0.12);
    var pos = { x: 0, y: 0, z: 0 };
    pos[axis] = d;
    var st = chain.stages[i] || {};
    var off = st.position;
    if (off) {
      pos.x += off.x || 0;
      pos.y += off.y || 0;
      pos.z += off.z || 0;
    }
    var rot = st.rotation || { x: 0, y: 0, z: 0 };
    return { position: pos, rotation: { x: rot.x || 0, y: rot.y || 0, z: rot.z || 0 } };
  }

  /** Локальный сдвиг ветки от parent (диск XY вокруг Z цепочки). */
  function branchLocalOffset(br) {
    var rad = ((br.angleDeg || 0) * Math.PI) / 180;
    var r = br.radius !== undefined ? br.radius : 0.14;
    return {
      position: {
        x: Math.cos(rad) * r,
        y: Math.sin(rad) * r,
        z: br.y || 0,
      },
      rotation: { x: 0, y: 0, z: br.angleDeg || 0 },
    };
  }

  function getLocations() {
    return (typeof CONFIG !== 'undefined' && CONFIG.locations) || [];
  }

  function spawnCfg() {
    return (typeof CONFIG !== 'undefined' && CONFIG.spawn) || {};
  }

  function makeGlbJunk(id, path, file) {
    return {
      type: 'glb',
      id: id,
      model: path + file,
      colliderModel: colliderUrl(path, file),
    };
  }

  function takeWithRepeats(pool, count) {
    var out = [];
    if (!pool.length || count <= 0) return out;
    var bag = [];
    var i;
    for (i = 0; i < count; i++) {
      if (!bag.length) bag = shuffleArray(pool);
      out.push(bag.shift());
    }
    return out;
  }

  /** Применить quotaStages маршрута к CONFIG.locations (travel gate). */
  function applyRouteQuotas(route) {
    var locs = getLocations();
    var qs = (route && route.quotaStages) || {};
    var i;
    for (i = 0; i < locs.length; i++) {
      var loc = locs[i];
      var ids = qs[loc.id] || [];
      loc.stageIds = ids.slice();
      loc.partsToComplete = ids.length;
    }
  }

  /**
   * Dev-assert антитупик: квота стартовой эпохи ⊆ spawn старта;
   * ветки C1-C3 и F не в квотах.
   */
  function assertRouteNoSoftlock(routeId, route) {
    var locs = getLocations();
    var start = null;
    var i;
    for (i = 0; i < locs.length; i++) {
      if (locs[i].start) { start = locs[i].id; break; }
    }
    if (!start) start = 'present';
    var spawn = route.spawn || {};
    var quota = route.quotaStages || {};
    var startSpawn = spawn[start] || [];
    var startQuota = quota[start] || [];
    for (i = 0; i < startQuota.length; i++) {
      if (startSpawn.indexOf(startQuota[i]) < 0) {
        console.error('[init-session] softlock?', routeId,
          'quota', startQuota[i], 'not in spawn', start);
      }
    }
    var banned = { C1: 1, C2: 1, C3: 1, F: 1 };
    var locId;
    for (locId in quota) {
      if (!Object.prototype.hasOwnProperty.call(quota, locId)) continue;
      var arr = quota[locId] || [];
      for (i = 0; i < arr.length; i++) {
        if (banned[arr[i]]) {
          console.error('[init-session] softlock?', routeId,
            locId, 'quota must not include', arr[i]);
        }
      }
    }
  }

  /**
   * Пер-локационные пулы по route.spawn (не по stageIds квоты).
   */
  function buildLocationPools(stages, leftovers, preset, schemeFileKeys, route) {
    var locs = getLocations();
    var sc = spawnCfg();
    var mc = machineCfg();
    var junkFolder = mc.junkPath || 'assets/models/junk/';
    var spawnMap = (route && route.spawn) || {};

    var junkPer = preset.junkPerLocation !== undefined
      ? preset.junkPerLocation
      : (sc.junkPerLocation !== undefined ? sc.junkPerLocation : 4);
    var decoyPer = preset.decoyPerLocation !== undefined
      ? preset.decoyPerLocation
      : (sc.decoyPerLocation !== undefined ? sc.decoyPerLocation : 3);

    var junkPool = (manifestCache.junk || []).map(function (f) {
      return { path: junkFolder, file: f };
    });

    var decoyPool = [];
    var seen = {};
    function addDecoyCandidate(folder, file) {
      var key = folder + '/' + file;
      if (schemeFileKeys[key]) return;
      if (seen[key]) return;
      seen[key] = true;
      decoyPool.push({ path: mc.basePath + folder + '/', file: file });
    }
    leftovers.forEach(function (l) { addDecoyCandidate(l.folder, l.file); });
    var chain = mc.assemblyChain || {};
    var stagesCfg = chain.stages || [];
    var si;
    for (si = 0; si < stagesCfg.length; si++) {
      var folder = stagesCfg[si].folder;
      var files = manifestCache[folder] || [];
      var fi;
      for (fi = 0; fi < files.length; fi++) {
        addDecoyCandidate(folder, files[fi]);
      }
    }

    if (!junkPool.length) {
      console.warn('[init-session] junk pool empty — epochs get 0 junk GLB');
    }
    if (!decoyPool.length) {
      console.warn('[init-session] decoy pool empty (all stage files in scheme?)');
    }

    var stageById = {};
    stages.forEach(function (s) { stageById[s.stageId] = s; });

    var pools = {};
    var flatJunk = [];
    var junkIdx = 0;
    var decoyIdx = 0;
    var li;

    for (li = 0; li < locs.length; li++) {
      var loc = locs[li];
      var spawnIds = spawnMap[loc.id] || loc.stageIds || [];
      var locStages = [];
      for (si = 0; si < spawnIds.length; si++) {
        var st = stageById[spawnIds[si]];
        if (st) locStages.push(st);
        else console.warn('[init-session] spawn id missing stage:', spawnIds[si]);
      }

      var locJunk = [];
      var pickedJunk = takeWithRepeats(junkPool, junkPer);
      var j;
      for (j = 0; j < pickedJunk.length; j++) {
        var jp = pickedJunk[j];
        var item = makeGlbJunk('junk_glb_' + junkIdx, jp.path, jp.file);
        junkIdx += 1;
        locJunk.push(item);
        flatJunk.push(item);
      }

      var pickedDecoy = takeWithRepeats(decoyPool, decoyPer);
      for (j = 0; j < pickedDecoy.length; j++) {
        var lp = pickedDecoy[j];
        var decoy = makeGlbJunk('decoy_glb_' + decoyIdx, lp.path, lp.file);
        decoyIdx += 1;
        locJunk.push(decoy);
        flatJunk.push(decoy);
      }

      pools[loc.id] = {
        stages: locStages,
        junkItems: locJunk,
      };
    }

    return {
      locationPools: pools,
      junkItems: flatJunk,
      junkPerLocation: junkPer,
      decoyPerLocation: decoyPer,
    };
  }

  function rollAssemblySession() {
    if (!manifestCache) {
      manifestCache = machineCfg().manifest || {};
    }

    var mc = machineCfg();
    var chain = mc.assemblyChain || { axis: 'z', step: 0.12, originOffset: 0, stages: [] };
    var stagesCfg = chain.stages || [];
    var preset = getDifficultyPreset();
    if (!preset) {
      console.error('[init-session] unknown difficulty preset');
      return false;
    }

    var routeWrap = getRoute(preset);
    if (!routeWrap) return false;
    var routeId = routeWrap.id;
    var route = routeWrap.route;

    assertRouteNoSoftlock(routeId, route);
    applyRouteQuotas(route);

    var preSet = {};
    (preset.preAssembled || []).forEach(function (id) { preSet[id] = true; });

    var stages = [];
    var leftovers = [];
    var pickedFiles = [];
    var schemeFileKeys = {};
    var i;

    for (i = 0; i < stagesCfg.length; i++) {
      var stCfg = stagesCfg[i];
      var files = manifestCache[stCfg.folder] || [];
      if (!files.length) {
        console.error('[init-session] no GLB in stage folder:', stCfg.folder);
        return false;
      }
      var shuffled = shuffleArray(files);
      var picked = shuffled[0];
      pickedFiles.push(stCfg.folder + '/' + picked);
      schemeFileKeys[stCfg.folder + '/' + picked] = true;
      var k;
      for (k = 1; k < shuffled.length; k++) {
        leftovers.push({ folder: stCfg.folder, file: shuffled[k] });
      }

      var folderPath = mc.basePath + stCfg.folder + '/';
      var pose = stagePose(chain, i);
      stages.push({
        stageId: stCfg.id,
        order: i,
        role: stCfg.role || stCfg.folder,
        partId: 'run_' + stCfg.id,
        slotId: 'slot_' + stCfg.id,
        model: folderPath + picked,
        colliderModel: colliderUrl(folderPath, picked),
        preAssembled: !!preSet[stCfg.id],
        position: pose.position,
        rotation: pose.rotation,
        isBranch: false,
        stub: false,
      });
    }

    var stageById = {};
    stages.forEach(function (s) { stageById[s.stageId] = s; });

    var branches = chain.branchSlots || [];
    var stubColors = chain.stubColors || {};
    var stubSize = chain.stubSize !== undefined ? chain.stubSize : 0.08;
    var bi;
    for (bi = 0; bi < branches.length; bi++) {
      var br = branches[bi];
      var parent = stageById[br.parentId];
      if (!parent) {
        console.error('[init-session] branch parent missing:', br.parentId, br.id);
        return false;
      }
      var bPose = branchLocalOffset(br);
      stages.push({
        stageId: br.id,
        order: 100 + bi,
        parentOrder: parent.order,
        parentId: br.parentId,
        role: 'branch',
        partId: 'run_' + br.id,
        slotId: 'slot_' + br.id,
        model: null,
        colliderModel: null,
        preAssembled: false,
        position: bPose.position,
        rotation: bPose.rotation,
        isBranch: true,
        stub: true,
        stubColor: stubColors[br.id] || '#ffe066',
        stubSize: stubSize,
      });
    }

    var assemblySlots = stages.map(function (s) {
      return {
        id: s.slotId,
        stageId: s.stageId,
        order: s.order,
        parentId: s.parentId || null,
        parentOrder: s.parentOrder !== undefined ? s.parentOrder : null,
        isBranch: !!s.isBranch,
        acceptPartId: s.partId,
        role: s.role,
        model: s.model,
        stub: !!s.stub,
        stubColor: s.stubColor || null,
        stubSize: s.stubSize,
        position: s.position,
        rotation: s.rotation,
      };
    });

    var partsById = {};
    stages.forEach(function (s) { partsById[s.partId] = s; });

    var built = buildLocationPools(stages, leftovers, preset, schemeFileKeys, route);

    CONFIG.session = {
      stages: stages,
      assemblySlots: assemblySlots,
      partsById: partsById,
      junkItems: built.junkItems,
      locationPools: built.locationPools,
      routeId: routeId,
    };

    var preIds = stages.filter(function (s) { return s.preAssembled; })
      .map(function (s) { return s.stageId; });
    var poolLog = [];
    var locs = getLocations();
    for (i = 0; i < locs.length; i++) {
      var p = built.locationPools[locs[i].id];
      if (!p) continue;
      poolLog.push(locs[i].id + ':' +
        p.stages.map(function (s) { return s.stageId; }).join('') +
        '+j' + p.junkItems.length +
        '/q' + (locs[i].stageIds || []).join(''));
    }
    console.log('[init-session] roll — route:', routeId,
      '| chain:', stages.filter(function (s) { return !s.isBranch; })
        .map(function (s) { return s.stageId; }).join(''),
      '| branches:', stages.filter(function (s) { return s.isBranch; })
        .map(function (s) { return s.stageId; }).join(''),
      '| files:', pickedFiles.join(', '),
      '| pre:', preIds.join('') || '(none)',
      '| perLoc junk:', built.junkPerLocation, 'decoy:', built.decoyPerLocation,
      '| pools:', poolLog.join(' | '));

    var coreEl = document.getElementById('assembly-core');
    var coreComp = coreEl && coreEl.components['assembly-core'];
    if (coreComp && typeof coreComp.rebuildFromSession === 'function') {
      coreComp.rebuildFromSession();
    }

    return true;
  }

  window.rollAssemblySession = rollAssemblySession;
  window.preloadMachineManifest = loadManifest;

  loadManifest();
})();
