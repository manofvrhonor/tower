/* global AFRAME */

/**
 * assembly-hub — позиционный якорь машины сборки.
 *
 * Держит мировой центр зоны сборки (assembly-zone.js читает #assembly-hub).
 * Вращение и иерархию колец/снеп-схемы ведёт machine-rig.js: #assembly-core,
 * сфера и купол — дети #machine-ring-inner и вращаются вместе с ним.
 *
 * Сброс occupancy слотов при возврате в меню.
 */
AFRAME.registerComponent('assembly-hub', {
  schema: {},

  init: function () {
    this._onReturnMenu = this._onReturnMenu.bind(this);
    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnMenu);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnMenu);
  },

  _onReturnMenu: function () {
    var core = document.getElementById('assembly-core');
    var comp = core && core.components['assembly-core'];
    if (comp && typeof comp.resetOccupancy === 'function') {
      comp.resetOccupancy();
    }
  },
});
