/* global CONFIG */

/**
 * init-session.js — случайная снеп-цепочка A→B→C→D→E на каждую игру.
 *
 * rollAssemblySession(): по одной случайной GLB из каждой папки стадии
 * (attach/box/core/drum/end) → упорядоченная цепочка вдоль оси ring_inner
 * (CONFIG.machine.assemblyChain). Сложность задаёт, какие стадии уже стоят
 * (preAssembled, несбиваемые).
 *
 * Пер-эпоха: locationPools[locId] = { stages, junkItems }.
 * junkPerLocation / decoyPerLocation — на КАЖДУЮ эпоху (difficulties).
 * Нехватка GLB → повтор из пула (без цветных кубов).
 * Decoy никогда не берёт файлы из snap-схемы сессии.
 *
 * Вызывается из game-lifecycle spawnWorld(), не при load. Manifest
 * предзагружается при старте страницы.
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

  /**
   * Взять count элементов из pool с повторами (циклически), каждый раз shuffle.
   * pool: [{ path, file }, ...]
   */
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

  /**
   * Пер-локационные пулы: stages эпохи + junk + decoy на каждую эпоху.
   * schemeFileKeys — map «folder/file» snap-схемы; decoy их не берёт.
   */
  function buildLocationPools(stages, leftovers, preset, schemeFileKeys) {
    var locs = getLocations();
    var sc = spawnCfg();
    var mc = machineCfg();
    var junkFolder = mc.junkPath || 'assets/models/junk/';

    var junkPer = preset.junkPerLocation !== undefined
      ? preset.junkPerLocation
      : (sc.junkPerLocation !== undefined ? sc.junkPerLocation : 4);
    var decoyPer = preset.decoyPerLocation !== undefined
      ? preset.decoyPerLocation
      : (sc.decoyPerLocation !== undefined ? sc.decoyPerLocation : 3);

    var junkPool = (manifestCache.junk || []).map(function (f) {
      return { path: junkFolder, file: f };
    });

    // Decoy: leftover + любые stage-GLB, кроме файлов текущей snap-схемы.
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
      var locStages = [];
      for (si = 0; si < (loc.stageIds || []).length; si++) {
        var st = stageById[loc.stageIds[si]];
        if (st) locStages.push(st);
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
      });
    }

    var assemblySlots = stages.map(function (s) {
      return {
        id: s.slotId,
        stageId: s.stageId,
        order: s.order,
        acceptPartId: s.partId,
        role: s.role,
        model: s.model,
        position: s.position,
        rotation: s.rotation,
      };
    });

    var partsById = {};
    stages.forEach(function (s) { partsById[s.partId] = s; });

    var built = buildLocationPools(stages, leftovers, preset, schemeFileKeys);

    CONFIG.session = {
      stages: stages,
      assemblySlots: assemblySlots,
      partsById: partsById,
      junkItems: built.junkItems,
      locationPools: built.locationPools,
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
        '+j' + p.junkItems.length);
    }
    console.log('[init-session] roll — chain:',
      stages.map(function (s) { return s.stageId; }).join(''),
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
