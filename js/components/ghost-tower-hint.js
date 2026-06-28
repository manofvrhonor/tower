/* global AFRAME, CONFIG, THREE */

/**
 * ghost-tower-hint — схема победы на пьедестале (декоративный wireframe).
 *
 * LineSegments на object3D компонента — без дочерних a-entity (надёжнее при visible).
 * Не связан с CONFIG.debug.showColliders.
 */
AFRAME.registerComponent('ghost-tower-hint', {
  schema: {},

  init: function () {
    this._meshes = [];
    this._wireRoot = new THREE.Group();
    this._wireRoot.name = 'ghost-tower-wireframes';
    this.el.object3D.add(this._wireRoot);
  },

  remove: function () {
    this._clearSegments();
    if (this._wireRoot.parent) {
      this._wireRoot.parent.remove(this._wireRoot);
    }
  },

  rebuild: function () {
    this._clearSegments();
    this._buildSegments();
  },

  _clearSegments: function () {
    for (var i = 0; i < this._meshes.length; i++) {
      var lines = this._meshes[i];
      this._wireRoot.remove(lines);
      if (lines.geometry) lines.geometry.dispose();
      if (lines.material) lines.material.dispose();
    }
    this._meshes.length = 0;
  },

  _buildSegments: function () {
    var cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory) || {};
    var colors = cfg.stackColors || [];
    var count = cfg.stackHeight || 4;
    var cubeSize = (CONFIG.floatingCubes && CONFIG.floatingCubes.size) || 0.1;
    var half = cubeSize / 2;
    var topY = cfg.pedestalTopY !== undefined ? cfg.pedestalTopY : 1.0;
    var ghost = cfg.ghostTower || {};
    var lineOpacity = ghost.lineOpacity !== undefined ? ghost.lineOpacity : 1.0;

    if (colors.length < count) {
      console.warn('[ghost-tower-hint] stackColors not ready, count=', colors.length);
      return;
    }

    for (var i = 0; i < count; i++) {
      var boxGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
      var edges = new THREE.EdgesGeometry(boxGeo);
      var mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(colors[i]),
        transparent: lineOpacity < 1,
        opacity: lineOpacity,
        depthTest: false,
        depthWrite: false,
      });
      var lines = new THREE.LineSegments(edges, mat);
      lines.position.set(0, topY + half + i * cubeSize, 0);
      lines.renderOrder = 500;
      lines.frustumCulled = false;
      this._wireRoot.add(lines);
      this._meshes.push(lines);
      boxGeo.dispose();
    }

    console.log('[ghost-tower-hint] built', count, 'wireframe segments');
  },
});
