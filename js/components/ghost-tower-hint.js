/* global AFRAME, CONFIG */

/**
 * ghost-tower-hint — призрачная башня на пьедестале (Этап 5, шаг 2).
 * rebuild() — перестроить после нового shuffleVictoryScheme().
 */
AFRAME.registerComponent('ghost-tower-hint', {
  schema: {},

  init: function () {
    this._buildSegments();
  },

  rebuild: function () {
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }
    this._buildSegments();
  },

  _buildSegments: function () {
    var cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory) || {};
    var colors = cfg.stackColors || [];
    var count = cfg.stackHeight || 4;
    var cubeSize = (CONFIG.floatingCubes && CONFIG.floatingCubes.size) || 0.1;
    var half = cubeSize / 2;
    var topY = cfg.pedestalTopY !== undefined ? cfg.pedestalTopY : 1.0;
    var ghost = cfg.ghostTower || {};
    var opacity = ghost.opacity !== undefined ? ghost.opacity : 0.20;

    if (colors.length < count) {
      console.warn('[ghost-tower-hint] stackColors not ready, count=', colors.length);
      return;
    }

    for (var i = 0; i < count; i++) {
      var box = document.createElement('a-box');
      box.setAttribute('width', cubeSize);
      box.setAttribute('height', cubeSize);
      box.setAttribute('depth', cubeSize);
      box.setAttribute('position', '0 ' + (topY + half + i * cubeSize) + ' 0');
      box.setAttribute('material',
        'color: ' + colors[i] +
        '; opacity: ' + opacity +
        '; transparent: true; depthWrite: false; shader: flat');
      box.setAttribute('data-ghost-segment', String(i));
      this.el.appendChild(box);
    }

    console.log('[ghost-tower-hint] built', count, 'segments');
  },
});
