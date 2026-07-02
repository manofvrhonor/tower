/* global AFRAME, CONFIG */

/**
 * assembly-hub — якорь ядра. В hardcore копирует rotation кольца на #assembly-core
 * (без DOM-reparent — иначе Three.js-слоты assembly-core пропадают).
 */
AFRAME.registerComponent('assembly-hub', {
  schema: {},

  init: function () {
    this._hub = this.el;
    this._rotateWithRing = null;
    this._coreHomePos = '0 0.015 0';
    this._onGameStarted = this._onGameStarted.bind(this);
    this._onReturnMenu = this._onReturnMenu.bind(this);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnMenu);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnMenu);
  },

  tick: function () {
    if (this._rotateWithRing === null || this._rotateWithRing === undefined) return;

    var ring = document.getElementById('orbit-ring-' + this._rotateWithRing);
    var core = document.getElementById('assembly-core');
    if (!ring || !core) return;

    var rr = ring.getAttribute('rotation');
    if (!rr) return;
    core.setAttribute('rotation', rr.x + ' ' + rr.y + ' ' + rr.z);
  },

  _ensureCoreOnHub: function () {
    var core = document.getElementById('assembly-core');
    if (!core) return null;

    if (core.parentElement !== this._hub) {
      this._hub.appendChild(core);
    }
    core.setAttribute('position', this._coreHomePos);

    var comp = core.components['assembly-core'];
    if (comp && typeof comp.ensureSlotsBuilt === 'function') {
      comp.ensureSlotsBuilt();
    }
    return core;
  },

  _onReturnMenu: function () {
    this._rotateWithRing = null;
    var core = this._ensureCoreOnHub();
    if (core) core.setAttribute('rotation', '0 0 0');
  },

  _onGameStarted: function (evt) {
    var diffId = (evt.detail && evt.detail.difficulty) ||
      (typeof window.getGameDifficulty === 'function' && window.getGameDifficulty()) ||
      'normal';
    var game = (typeof CONFIG !== 'undefined' && CONFIG.game) || {};
    var preset = game.difficulties && game.difficulties[diffId];
    var ringIdx = preset && preset.rotateAssemblyWithRing;

    this._ensureCoreOnHub();

    if (ringIdx !== undefined && ringIdx !== null &&
        document.getElementById('orbit-ring-' + ringIdx)) {
      this._rotateWithRing = ringIdx;
      console.log('[assembly-hub] hardcore — слоты крутятся с кольцом', ringIdx);
      return;
    }

    this._rotateWithRing = null;
    var core = document.getElementById('assembly-core');
    if (core) core.setAttribute('rotation', '0 0 0');
    console.log('[assembly-hub] слоты фиксированы на hub');
  },
});

