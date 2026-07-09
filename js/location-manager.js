/* global CONFIG */

/**
 * location-manager.js — эпохи, живая квота, travel gate (Фаза 4+).
 *
 * visitedIds — старт + куда реально прыгали (кнопка всегда активна).
 * unlockedIds — эпохи, открытые квотой (можно прыгать, даже если ещё не visited).
 * Квота = живые слоты на машине (assembly-core), не «где снепнули».
 * Принёс C в Present и поставил — Past-квота тоже видит C.
 * stage-snapped / stage-unsnapped → travel-availability-changed.
 * Auto-меню: до autoMenuMaxPerLocation раз на эпоху (first / rebuilt).
 */
(function () {
  var activeLocationId = null;
  var unlockedIds = [];
  var visitedIds = [];
  var rooms = {};
  var autoPopupCount = {};
  var quotaWasMet = {};

  function getLocations() {
    return (typeof CONFIG !== 'undefined' && CONFIG.locations) || [];
  }

  function travelCfg() {
    return (typeof CONFIG !== 'undefined' && CONFIG.travel) || {};
  }

  function findLocation(id) {
    var locs = getLocations();
    var i;
    for (i = 0; i < locs.length; i++) {
      if (locs[i].id === id) return locs[i];
    }
    return null;
  }

  function findStartLocation() {
    var locs = getLocations();
    var i;
    for (i = 0; i < locs.length; i++) {
      if (locs[i].start) return locs[i];
    }
    return locs.length ? locs[0] : null;
  }

  function makeRoomState(locId) {
    return {
      locationId: locId,
      visited: false,
      snappedStages: {},
      entities: {},
    };
  }

  function ensureAllRooms() {
    var locs = getLocations();
    var i;
    for (i = 0; i < locs.length; i++) {
      var id = locs[i].id;
      if (!rooms[id]) rooms[id] = makeRoomState(id);
    }
  }

  function emitOnScene(name, detail) {
    var scene = document.querySelector('a-scene');
    if (scene) scene.emit(name, detail || {}, false);
  }

  function markVisited(id) {
    if (!id) return;
    if (visitedIds.indexOf(id) < 0) visitedIds.push(id);
    var room = getRoomState(id);
    if (room) room.visited = true;
  }

  function isVisited(id) {
    return visitedIds.indexOf(id) >= 0;
  }

  function resetLocations() {
    rooms = {};
    autoPopupCount = {};
    quotaWasMet = {};
    ensureAllRooms();
    var start = findStartLocation();
    activeLocationId = start ? start.id : null;
    unlockedIds = activeLocationId ? [activeLocationId] : [];
    visitedIds = activeLocationId ? [activeLocationId] : [];
    if (activeLocationId) markVisited(activeLocationId);
    console.log('[location-manager] reset — active:', activeLocationId,
      '| visited:', visitedIds.join(',') || '(none)');
    emitOnScene('location-changed', {
      locationId: activeLocationId,
      location: start,
      reason: 'reset',
    });
    emitOnScene('travel-availability-changed', {
      locationId: activeLocationId,
    });
  }

  function getActiveLocationId() {
    return activeLocationId;
  }

  function getActiveLocation() {
    return findLocation(activeLocationId);
  }

  function getUnlockedLocationIds() {
    return unlockedIds.slice();
  }

  function getVisitedLocationIds() {
    return visitedIds.slice();
  }

  function isLocationUnlocked(id) {
    return unlockedIds.indexOf(id) >= 0;
  }

  function getRoomState(locId) {
    var id = locId || activeLocationId;
    if (!id) return null;
    if (!rooms[id]) rooms[id] = makeRoomState(id);
    return rooms[id];
  }

  function unlockLocation(id) {
    if (!findLocation(id)) {
      console.warn('[location-manager] unlock unknown location:', id);
      return false;
    }
    if (isLocationUnlocked(id)) return true;
    unlockedIds.push(id);
    console.log('[location-manager] unlocked:', id);
    emitOnScene('location-unlocked', { locationId: id });
    return true;
  }

  function getRoute() {
    var prog = (typeof CONFIG !== 'undefined' && CONFIG.progression) || {};
    if (prog.route && prog.route.length) return prog.route.slice();
    return getLocations().map(function (l) { return l.id; });
  }

  function getNextLocationId(fromId) {
    var loc = findLocation(fromId || activeLocationId);
    return (loc && loc.unlocks) ? loc.unlocks : null;
  }

  function markStageSnapped(stageId, locId) {
    // Пишем в комнату для отладки/бэклога; квота читает live core.
    var room = getRoomState(locId);
    if (!room || !stageId) return;
    room.snappedStages[stageId] = true;
  }

  function markStageUnsnapped(stageId, locId) {
    var room = getRoomState(locId);
    if (!room || !stageId) return;
    delete room.snappedStages[stageId];
    // Снять метку и с других комнат — стадия одна на всю машину.
    var id;
    for (id in rooms) {
      if (rooms[id] && rooms[id].snappedStages) {
        delete rooms[id].snappedStages[stageId];
      }
    }
  }

  function getAssemblyCore() {
    var el = document.getElementById('assembly-core');
    return (el && el.components && el.components['assembly-core']) || null;
  }

  /** stageId → true по живым занятым слотам машины. */
  function liveSnappedStageSet() {
    var set = {};
    var core = getAssemblyCore();
    if (!core || typeof core.getLiveOccupiedStages !== 'function') return set;
    var live = core.getLiveOccupiedStages();
    var i;
    for (i = 0; i < live.length; i++) {
      if (live[i].stageId) set[live[i].stageId] = true;
    }
    return set;
  }

  /** Сколько stageIds локации сейчас на машине (live). */
  function countSnappedStages(locId) {
    var loc = findLocation(locId || activeLocationId);
    if (!loc || !loc.stageIds) return 0;
    var live = liveSnappedStageSet();
    var count = 0;
    var i;
    for (i = 0; i < loc.stageIds.length; i++) {
      if (live[loc.stageIds[i]]) count++;
    }
    return count;
  }

  /**
   * Квота эпохи: все stageIds этой эпохи стоят на машине.
   * Где снепнули — не важно (можно принести с запястья в другую эпоху).
   */
  function isLocationQuotaMet(locId) {
    var loc = findLocation(locId || activeLocationId);
    if (!loc) return false;
    var need = loc.partsToComplete != null
      ? loc.partsToComplete
      : (loc.stageIds || []).length;
    return countSnappedStages(locId) >= need;
  }

  /**
   * Можно ли прыгнуть в id прямо сейчас.
   * Текущая — нет. Visited / уже unlocked — да.
   * Следующая (unlocks) ещё не открыта — только пока квота текущей собрана.
   */
  function canTravelTo(id) {
    if (!id || !findLocation(id)) return false;
    if (id === activeLocationId) return false;
    if (isVisited(id) || isLocationUnlocked(id)) return true;
    var cur = getActiveLocation();
    if (cur && cur.unlocks === id) return isLocationQuotaMet(activeLocationId);
    return false;
  }

  function getTravelMenuLocations() {
    var locs = getLocations();
    var out = [];
    var i;
    for (i = 0; i < locs.length; i++) {
      var loc = locs[i];
      out.push({
        id: loc.id,
        label: loc.label || loc.id,
        enabled: canTravelTo(loc.id),
        isCurrent: loc.id === activeLocationId,
        visited: isVisited(loc.id),
      });
    }
    return out;
  }

  function hasAnyTravelTarget() {
    var locs = getLocations();
    var i;
    for (i = 0; i < locs.length; i++) {
      if (canTravelTo(locs[i].id)) return true;
    }
    return false;
  }

  function autoMenuMax() {
    var t = travelCfg();
    return t.autoMenuMaxPerLocation !== undefined ? t.autoMenuMaxPerLocation : 2;
  }

  function autoMenuEnabled() {
    var t = travelCfg();
    return t.autoMenuEnabled !== false;
  }

  function emitAvailability() {
    emitOnScene('travel-availability-changed', {
      locationId: activeLocationId,
      quotaMet: isLocationQuotaMet(),
    });
  }

  function _lockOccupiedEntries(entries, label) {
    var locked = 0;
    var i;
    for (i = 0; i < entries.length; i++) {
      var el = entries[i].el;
      if (!el || el === true || !el.components) continue;
      var fc = el.components['floating-cube'];
      if (fc && typeof fc.lockToTime === 'function' && fc.lockToTime()) {
        locked++;
      }
    }
    console.log('[location-manager] time-lock parts:', locked, label || '');
    return locked;
  }

  /**
   * Закрепить «временем» все стадии эпох, чья квота уже собрана на машине.
   * Не зависит от того, в какой локации снепнули (Present с C+D → Past-квота → lock CD).
   */
  function lockCompletedEpochPartsOnTravel() {
    var core = getAssemblyCore();
    if (!core || typeof core.getLiveOccupiedStages !== 'function') return;
    var locs = getLocations();
    var allowed = {};
    var labels = [];
    var i;
    var j;
    for (i = 0; i < locs.length; i++) {
      var loc = locs[i];
      if (!isLocationQuotaMet(loc.id)) continue;
      var ids = loc.stageIds || [];
      for (j = 0; j < ids.length; j++) allowed[ids[j]] = true;
      if (ids.length) labels.push(loc.id + ':' + ids.join(''));
    }
    if (!labels.length) return;
    var live = core.getLiveOccupiedStages();
    var toLock = [];
    for (i = 0; i < live.length; i++) {
      if (allowed[live[i].stageId]) toLock.push(live[i]);
    }
    _lockOccupiedEntries(toLock, '(' + labels.join(' | ') + ')');
  }

  /** Финальная победа: закрепить ВСЕ снепнутые детали машины. */
  function lockAllSnappedPartsOnVictory() {
    var core = getAssemblyCore();
    if (!core || typeof core.getLiveOccupiedStages !== 'function') return;
    _lockOccupiedEntries(core.getLiveOccupiedStages(), '(victory)');
  }

  /**
   * Квота locId только что собрана → unlock следующей + опц. auto-меню,
   * если игрок сейчас в этой эпохе (или квота собрана «чужой» деталью здесь).
   */
  function onQuotaNewlyMet(locId) {
    var loc = findLocation(locId);
    if (!loc || !loc.unlocks) {
      emitAvailability();
      return;
    }

    unlockLocation(loc.unlocks);

    // Auto-меню только если квота текущей эпохи (не спамить при сборке чужой).
    if (locId !== activeLocationId) {
      emitAvailability();
      return;
    }

    var count = autoPopupCount[locId] || 0;
    var max = autoMenuMax();
    var shouldAuto = autoMenuEnabled() && count < max;

    if (!shouldAuto) {
      emitAvailability();
      return;
    }

    var comicKey = count === 0 ? 'first' : 'rebuilt';
    autoPopupCount[locId] = count + 1;

    var detail = {
      locationId: locId,
      nextLocationId: loc.unlocks,
      location: loc,
      comicKey: comicKey,
      autoPopupIndex: count + 1,
    };

    requestAnimationFrame(function () {
      console.log('[location-manager] travel-ready:', locId,
        '→ next:', loc.unlocks,
        '| comic:', comicKey,
        '| snapped:', countSnappedStages(locId), '/', loc.partsToComplete);
      emitOnScene('travel-ready', detail);
      emitAvailability();
    });
  }

  /** Пересчитать квоты всех эпох (снеп мог закрыть «чужую» квоту). */
  function refreshAllQuotas() {
    var locs = getLocations();
    var i;
    var anyNew = false;
    for (i = 0; i < locs.length; i++) {
      var id = locs[i].id;
      var met = isLocationQuotaMet(id);
      var wasMet = !!quotaWasMet[id];
      quotaWasMet[id] = met;
      if (met && !wasMet) {
        anyNew = true;
        onQuotaNewlyMet(id);
      }
    }
    if (!anyNew) emitAvailability();
  }

  function onStageSnapped(evt) {
    var d = evt.detail || {};
    if (!d.stageId) return;
    markStageSnapped(d.stageId);
    refreshAllQuotas();
  }

  function onStageUnsnapped(evt) {
    var d = evt.detail || {};
    if (!d.stageId) return;
    markStageUnsnapped(d.stageId, d.locationId);
    var locs = getLocations();
    var i;
    for (i = 0; i < locs.length; i++) {
      var id = locs[i].id;
      quotaWasMet[id] = isLocationQuotaMet(id);
    }
    console.log('[location-manager] stage-unsnapped:', d.stageId,
      '| activeQuota:', isLocationQuotaMet());
    emitAvailability();
  }

  function travelTo(id) {
    if (!findLocation(id)) {
      console.warn('[location-manager] travelTo unknown:', id);
      return false;
    }
    if (!canTravelTo(id)) {
      console.warn('[location-manager] travelTo not allowed:', id);
      return false;
    }
    if (id === activeLocationId) return true;

    var prev = activeLocationId;
    if (prev) {
      markVisited(prev);
      // Любые эпохи с выполненной квотой — time-lock (даже если собрали «не дома»).
      lockCompletedEpochPartsOnTravel();
    }

    activeLocationId = id;
    markVisited(id);
    if (!isLocationUnlocked(id)) unlockLocation(id);

    console.log('[location-manager] travel:', prev, '→', id);
    emitOnScene('location-changed', {
      locationId: id,
      location: findLocation(id),
      reason: 'travel',
      previousLocationId: prev,
    });
    emitAvailability();
    return true;
  }

  function onVictory() {
    lockAllSnappedPartsOnVictory();
  }

  /** Публичный хук: пересчитать квоты (после внешнего снепа). */
  function checkTravelReady() {
    refreshAllQuotas();
  }

  function bindSceneEvents() {
    var scene = document.querySelector('a-scene');
    if (!scene) return;
    scene.addEventListener('game-started', resetLocations);
    scene.addEventListener('return-to-menu', resetLocations);
    scene.addEventListener('stage-snapped', onStageSnapped);
    scene.addEventListener('stage-unsnapped', onStageUnsnapped);
    scene.addEventListener('victory', onVictory);
  }

  window.getActiveLocationId = getActiveLocationId;
  window.getActiveLocation = getActiveLocation;
  window.getLocationById = findLocation;
  window.getUnlockedLocationIds = getUnlockedLocationIds;
  window.getVisitedLocationIds = getVisitedLocationIds;
  window.isLocationUnlocked = isLocationUnlocked;
  window.isLocationVisited = isVisited;
  window.getLocationRoomState = getRoomState;
  window.unlockLocation = unlockLocation;
  window.travelTo = travelTo;
  window.canTravelTo = canTravelTo;
  window.getTravelMenuLocations = getTravelMenuLocations;
  window.hasAnyTravelTarget = hasAnyTravelTarget;
  window.resetLocations = resetLocations;
  window.getLocationRoute = getRoute;
  window.getNextLocationId = getNextLocationId;
  window.markLocationStageSnapped = markStageSnapped;
  window.markLocationStageUnsnapped = markStageUnsnapped;
  window.countLocationSnappedStages = countSnappedStages;
  window.isLocationQuotaMet = isLocationQuotaMet;
  window.checkTravelReady = checkTravelReady;
  window.lockAllSnappedPartsOnVictory = lockAllSnappedPartsOnVictory;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSceneEvents);
  } else {
    bindSceneEvents();
  }
})();
