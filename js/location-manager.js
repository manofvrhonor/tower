/* global CONFIG */

/**
 * location-manager.js — эпохи и персистент комнат (Фаза 4, шаг 3–4).
 *
 * activeLocationId, unlockedLocationIds, travelTo(id), снимок состояния каждой эпохи.
 * stage-snapped → квота эпохи → travel-ready + unlock следующей. Сброс на game-started.
 */
(function () {
  var activeLocationId = null;
  var unlockedIds = [];
  var rooms = {};
  var travelReadyEmitted = null;

  function getLocations() {
    return (typeof CONFIG !== 'undefined' && CONFIG.locations) || [];
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

  function resetLocations() {
    rooms = {};
    travelReadyEmitted = null;
    ensureAllRooms();
    var start = findStartLocation();
    activeLocationId = start ? start.id : null;
    unlockedIds = activeLocationId ? [activeLocationId] : [];
    console.log('[location-manager] reset — active:', activeLocationId,
      '| unlocked:', unlockedIds.join(',') || '(none)');
    emitOnScene('location-changed', {
      locationId: activeLocationId,
      location: start,
      reason: 'reset',
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

  function travelTo(id) {
    if (!findLocation(id)) {
      console.warn('[location-manager] travelTo unknown:', id);
      return false;
    }
    if (!isLocationUnlocked(id)) {
      console.warn('[location-manager] travelTo locked:', id);
      return false;
    }
    if (id === activeLocationId) return true;

    var prev = activeLocationId;
    if (prev) getRoomState(prev).visited = true;

    activeLocationId = id;
    getRoomState(id).visited = true;

    console.log('[location-manager] travel:', prev, '→', id);
    emitOnScene('location-changed', {
      locationId: id,
      location: findLocation(id),
      reason: 'travel',
      previousLocationId: prev,
    });
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
    if (!room) return;
    room.snappedStages[stageId] = true;
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

  function isLocationQuotaMet(locId) {
    var loc = findLocation(locId || activeLocationId);
    if (!loc) return false;
    var need = loc.partsToComplete != null
      ? loc.partsToComplete
      : (loc.stageIds || []).length;
    return countSnappedStages(locId) >= need;
  }

  function checkTravelReady() {
    var loc = getActiveLocation();
    if (!loc) return;
    if (travelReadyEmitted === activeLocationId) return;
    if (!isLocationQuotaMet()) return;
    if (!loc.unlocks) return;

    travelReadyEmitted = activeLocationId;
    unlockLocation(loc.unlocks);
    var detail = {
      locationId: activeLocationId,
      nextLocationId: loc.unlocks,
      location: loc,
    };
    // Следующий кадр: снеп успевает co-rotation до freeze (floating-cube tick).
    requestAnimationFrame(function () {
      console.log('[location-manager] travel-ready:', activeLocationId,
        '→ next:', loc.unlocks,
        '| snapped:', countSnappedStages(), '/', loc.partsToComplete);
      emitOnScene('travel-ready', detail);
    });
  }

  function onStageSnapped(evt) {
    var d = evt.detail || {};
    if (!d.stageId) return;
    markStageSnapped(d.stageId);
    checkTravelReady();
  }

  function bindSceneEvents() {
    var scene = document.querySelector('a-scene');
    if (!scene) return;
    scene.addEventListener('game-started', resetLocations);
    scene.addEventListener('return-to-menu', resetLocations);
    scene.addEventListener('stage-snapped', onStageSnapped);
  }

  window.getActiveLocationId = getActiveLocationId;
  window.getActiveLocation = getActiveLocation;
  window.getLocationById = findLocation;
  window.getUnlockedLocationIds = getUnlockedLocationIds;
  window.isLocationUnlocked = isLocationUnlocked;
  window.getLocationRoomState = getRoomState;
  window.unlockLocation = unlockLocation;
  window.travelTo = travelTo;
  window.resetLocations = resetLocations;
  window.getLocationRoute = getRoute;
  window.getNextLocationId = getNextLocationId;
  window.markLocationStageSnapped = markStageSnapped;
  window.countLocationSnappedStages = countSnappedStages;
  window.isLocationQuotaMet = isLocationQuotaMet;
  window.checkTravelReady = checkTravelReady;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSceneEvents);
  } else {
    bindSceneEvents();
  }
})();
