/* global AFRAME, THREE */

/**
 * pedestal-builder — физический коллайдер стола.
 *
 * Парящий диск (wallSegments=0): один a-cylinder = radius × diskThickness
 * (совпадает с визуалом; convex hull ≈ «блин» с боковой кромкой).
 * Столб (wallSegments>0): касательные a-box + крышка.
 * Entity #pedestal: position.y = tableSurfaceY при wallSegments=0.
 */

AFRAME.registerComponent('pedestal-builder', {
  schema: {
    enabled: { default: true },
  },

  init: function () {
    if (!this.data.enabled) return;

    var cfg = window.CONFIG && window.CONFIG.pedestal;
    if (!cfg) {
      console.error('[pedestal-builder] CONFIG.pedestal не найден');
      return;
    }

    this.tiles = [];

    var layers = window.CONFIG && window.CONFIG.collisionLayers;
    if (!layers) {
      console.error('[pedestal-builder] CONFIG.collisionLayers не найден');
      return;
    }

    var m = cfg.physxMaterial || {};
    this._matStr =
      'restitution: ' + (m.restitution !== undefined ? m.restitution : 0.15) +
      '; staticFriction: ' + (m.staticFriction !== undefined ? m.staticFriction : 0.70) +
      '; dynamicFriction: ' + (m.dynamicFriction !== undefined ? m.dynamicFriction : 0.60);

    this._layerTop =
      '; collisionLayers: ' + layers.WORLD +
      '; collidesWithLayers: ' + [
        layers.FLOAT_CUBE,
        layers.GRAVITY_CUBE,
        layers.GRABBED_CUBE,
        layers.BALL,
        layers.BAT,
      ].join(', ');

    // GRABBED_CUBE — только куб в руке; BAT (7) — всегда.
    this._layerWall =
      '; collisionLayers: ' + layers.WORLD +
      '; collidesWithLayers: ' + [
        layers.FLOAT_CUBE,
        layers.GRAVITY_CUBE,
        layers.BALL,
        layers.BAT,
      ].join(', ');

    this._buildAll(cfg);
  },

  remove: function () {
    for (var i = 0; i < this.tiles.length; i++) {
      var t = this.tiles[i];
      if (t.parentNode) t.parentNode.removeChild(t);
    }
    this.tiles.length = 0;
  },

  _buildAll: function (cfg) {
    var c = cfg.collider || {};
    var wallN = c.wallSegments !== undefined ? c.wallSegments : 12;
    if (wallN <= 0) {
      this._buildDisk(cfg, c);
      return;
    }
    this._buildWall(cfg, c);
    this._buildDisk(cfg, c, true);
  },

  _diskThickness: function (cfg, c, pillarMode) {
    if (pillarMode) {
      return c.topThickness !== undefined ? c.topThickness : 0.01;
    }
    var vis = cfg.visual || {};
    return vis.diskThickness !== undefined ? vis.diskThickness : 0.03;
  },

  _buildWall: function (cfg, c) {
    var N = c.wallSegments !== undefined ? c.wallSegments : 12;
    if (N <= 0) return;
    var R = cfg.radius !== undefined ? cfg.radius : 0.3;
    var height = cfg.height !== undefined ? cfg.height : 1.0;
    var topTh = c.topThickness !== undefined ? c.topThickness : 0.01;
    var overlap = c.tileOverlap !== undefined ? c.tileOverlap : 1.08;
    var thickness = c.shellThickness !== undefined ? c.shellThickness : 0.02;
    var wallHeight = height - topTh;
    var yMid = -topTh / 2;
    var chord = 2 * R * Math.sin(Math.PI / N);
    var width = chord * overlap;

    for (var i = 0; i < N; i++) {
      var theta = (i / N) * Math.PI * 2;
      var x = R * Math.sin(theta);
      var z = R * Math.cos(theta);
      var rotY = THREE.MathUtils.radToDeg(Math.atan2(x, z));

      this._createBoxTile({
        position: { x: x, y: yMid, z: z },
        rotation: { x: 0, y: rotY, z: 0 },
        width: width,
        height: wallHeight,
        depth: thickness,
        layerSuffix: this._layerWall,
      });
    }
  },

  /** Круглый диск или крышка столба: a-cylinder → PhysX convex-пuck. */
  _buildDisk: function (cfg, c, pillarTop) {
    var R = cfg.radius !== undefined ? cfg.radius : 0.3;
    var height = cfg.height !== undefined ? cfg.height : 1.0;
    var th = this._diskThickness(cfg, c, !!pillarTop);
    var yCenter = pillarTop
      ? height / 2 - th / 2
      : -th / 2;

    var el = document.createElement('a-cylinder');
    el.setAttribute('id', pillarTop ? 'pedestal-top' : 'pedestal-disk');
    el.setAttribute('position', { x: 0, y: yCenter, z: 0 });
    el.setAttribute('radius', R);
    el.setAttribute('height', th);
    el.setAttribute('visible', false);
    el.setAttribute('data-physx-hidden-collider', '');

    el.setAttribute('physx-body', 'type: static');
    el.setAttribute('physx-material', this._matStr + this._layerTop);

    if (typeof window.applyColliderDebugVisual === 'function') {
      window.applyColliderDebugVisual(el);
    }

    this.el.appendChild(el);
    this.tiles.push(el);
  },

  _createBoxTile: function (opts) {
    var el = document.createElement('a-box');
    el.setAttribute('position', opts.position);
    el.setAttribute('rotation', opts.rotation);
    el.setAttribute('width', opts.width);
    el.setAttribute('height', opts.height);
    el.setAttribute('depth', opts.depth);
    el.setAttribute('visible', false);
    el.setAttribute('data-physx-hidden-collider', '');

    el.setAttribute('physx-body', 'type: static');
    el.setAttribute('physx-material', this._matStr + opts.layerSuffix);

    if (typeof window.applyColliderDebugVisual === 'function') {
      window.applyColliderDebugVisual(el);
    }

    this.el.appendChild(el);
    this.tiles.push(el);
  },
});
