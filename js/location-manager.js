/* global CONFIG */

/**
 * location-manager.js — эпохи, живая квота, travel gate (Фаза 4+).
 *
 * visitedIds — старт + куда реально прыгали (кнопка всегда активна).
 * Следующая эпоха (current.unlocks) — активна только пока живая квота собрана.
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
    var room = getRoomState(locId);
    if (!room || !stageId) return;
    room.snappedStages[stageId] = true;
  }

  function markStageUnsnapped(stageId, locId) {
    var room = getRoomState(locId);
    if (!room || !stageId) return;
    delete room.snappedStages[stageId];
  }

  function countSnappedStages(locId) {
    var loc = findLocation(locId || activeLocationId);
    if (!loc || !loc.stageIds) return 0;
    var room = getRoomState(locId);
    if (!room) return 0;
    var count = 0;
    var i;
    for (i = 0; i < loc.stageIds.length; i++) {
      if (room.snappedStages[loc.stageIds[i]]) count++;
    }
    return count;
  }

  function getAssemblyCore() {
    var el = document.getElementById('assembly-core');
    return (el && el.components && el.components['assembly-core']) || null;
  }

  /** Макс. order среди stageIds локации (session.assemblySlots). */
  function maxOrderForLocation(loc) {
    if (!loc || !loc.stageIds) return -1;
    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    var slots = (session && session.assemblySlots) || [];
    var max = -1;
    var i;
    var j;
    for (i = 0; i < loc.stageIds.length; i++) {
      var sid = loc.stageIds[i];
      for (j = 0; j < slots.length; j++) {
        if (slots[j].stageId === sid) {
          var o = slots[j].order !== undefined ? slots[j].order : j;
          if (o > max) max = o;
        }
      }
    }
    return max;
  }

  /**
   * Квота эпохи: все stageIds на месте И нет «лишних» стадий выше по цепочке
   * (мусор/следующая деталь до прыжка ломает машину).
   */
  function isLocationQuotaMet(locId) {
    var loc = findLocation(locId || activeLocationId);
    if (!loc) return false;
    var need = loc.partsToComplete != null
      ? loc.partsToComplete
      : (loc.stageIds || []).length;
    if (countSnappedStages(locId) < need) return false;

    var maxOrder = maxOrderForLocation(loc);
    if (maxOrder < 0) return true;

    var core = getAssemblyCore();
    if (!core || typeof core.getLiveOccupiedStages !== 'function') return true;
    var live = core.getLiveOccupiedStages();
    var i;
    for (i = 0; i < live.length; i++) {
      if (live[i].order > maxOrder) return false;
    }
    return true;
  }

  /**
   * Можно ли прыгнуть в id прямо сейчас.
   * Текущая — нет. Visited/start — да. Следующая (unlocks) — только живая квота.
   */
  function canTravelTo(id) {
    if (!id || !findLocation(id)) return false;
    if (id === activeLocationId) return false;
    if (isVisited(id)) return true;
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

  /** Закрепить «временем» стадии текущей эпохи (при прыжке вперёд). */
  function lockEpochPartsOnTravel(fromLocId) {
    var loc = findLocation(fromLocId);
    if (!loc || !loc.stageIds) return;
    var core = getAssemblyCore();
    if (!core || typeof core.getLiveOccupiedStages !== 'function') return;
    var allowed = {};
    var i;
    for (i = 0; i < loc.stageIds.length; i++) allowed[loc.stageIds[i]] = true;
    var live = core.getLiveOccupiedStages();
    var toLock = [];
    for (i = 0; i < live.length; i++) {
      if (allowed[live[i].stageId]) toLock.push(live[i]);
    }
    _lockOccupiedEntries(toLock, 'from ' + fromLocId + ' (' + loc.stageIds.join('') + ')');
  }

  /** Финальная победа: закрепить ВСЕ снепнутые детали машины (A→E). */
  function lockAllSnappedPartsOnVictory() {
    var core = getAssemblyCore();
    if (!core || typeof core.getLiveOccupiedStages !== 'function') return;
    _lockOccupiedEntries(core.getLiveOccupiedStages(), '(victory)');
  }

  function checkTravelReady() {
    var loc = getActiveLocation();
    if (!loc) return;
    if (!loc.unlocks) return;
    if (!isLocationQuotaMet()) return;

    unlockLocation(loc.unlocks);

    var locId = activeLocationId;
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
        '| snapped:', countSnappedStages(), '/', loc.partsToComplete);
      emitOnScene('travel-ready', detail);
      emitAvailability();
    });
  }

  function onStageSnapped(evt) {
    var d = evt.detail || {};
    if (!d.stageId) return;
    markStageSnapped(d.stageId);
    var met = isLocationQuotaMet();
    var locId = activeLocationId;
    var wasMet = !!quotaWasMet[locId];
    quotaWasMet[locId] = met;
    if (met && !wasMet) {
      checkTravelReady();
    } else {
      emitAvailability();
    }
  }

  function onStageUnsnapped(evt) {
    var d = evt.detail || {};
    if (!d.stageId) return;
    markStageUnsnapped(d.stageId, d.locationId);
    var locId = activeLocationId;
    var met = isLocationQuotaMet();
    quotaWasMet[locId] = met;
    console.log('[location-manager] stage-unsnapped:', d.stageId,
      '| quotaMet:', met);
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
      // Закрепить детали эпохи только при прыжке вперёд (квота жива).
      if (isLocationQuotaMet(prev)) {
        lockEpochPartsOnTravel(prev);
      }
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
