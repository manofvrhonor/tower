/* global AFRAME, THREE, CONFIG */

/**
 * room-dome-collider — PhysX-коллайдер комнаты: внутренняя полусфера
 * (CONFIG.room.fogDome). Тонкие static box-плитки, слой WORLD.
 *
 * Пол (#floor) — отдельный a-box. Стены/потолок-куб удалены.
 */
AFRAME.registerComponent('room-dome-collider', {
  schema: {
    enabled: { default: true },
  },

  init: function () {
    if (!this.data.enabled) return;

    var room = (typeof CONFIG !== 'undefined' && CONFIG.room) || {};
    var fd = room.fogDome || {};
    var c = fd.collider || {};
    var bm = (typeof CONFIG !== 'undefined' && CONFIG.world && CONFIG.world.bounceMaterial) || {};

    if (!fd.radius) {
      console.error('[room-dome-collider] CONFIG.room.fogDome.radius не задан');
      return;
    }

    this.tiles = [];
    this._cfg = {
      radius: fd.radius,
      center: fd.position || { x: 0, y: 0, z: 0 },
      collider: c,
    };

    var layers = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, FLOAT_CUBE: 2, GRAVITY_CUBE: 3, GRABBED_CUBE: 4, BALL: 5, BAT: 7,
    };

    this._physxMaterial =
      'restitution: ' + (bm.restitution !== undefined ? bm.restitution : 0.95) +
      '; staticFriction: ' + (bm.staticFriction !== undefined ? bm.staticFriction : 0.05) +
      '; dynamicFriction: ' + (bm.dynamicFriction !== undefined ? bm.dynamicFriction : 0.05);

    this._layerSuffix =
      '; collisionLayers: ' + layers.WORLD +
      '; collidesWithLayers: ' +
      [layers.FLOAT_CUBE, layers.GRAVITY_CUBE, layers.GRABBED_CUBE, layers.BALL, layers.BAT].join(', ');

    this.el.object3D.position.set(
      this._cfg.center.x,
      this._cfg.center.y,
      this._cfg.center.z
    );

    this._buildHemisphere();
    console.log('[room-dome-collider] плиток:', this.tiles.length, '(WORLD, R=' + fd.radius + ')');
  },

  remove: function () {
    for (var i = 0; i < this.tiles.length; i++) {
      var t = this.tiles[i];
      if (t.parentNode) t.parentNode.removeChild(t);
    }
    this.tiles.length = 0;
  },

  _buildHemisphere: function () {
    var cfg = this._cfg;
    var c = cfg.collider;
    var M = c.latitudeRings !== undefined ? c.latitudeRings : 10;
    var K = c.longitudeSegments !== undefined ? c.longitudeSegments : 28;
    var R = cfg.radius;
    var thickness = c.shellThickness !== undefined ? c.shellThickness : 0.02;
    var overlap = c.tileOverlap !== undefined ? c.tileOverlap : 1.08;
    var dPhi = (Math.PI / 2) / M;

    for (var j = 0; j < M; j++) {
      // phi_p: 0 = макушка (+Y), PI/2 = экватор (y=0)
      var phiP = (j + 0.5) * dPhi;
      var ringR = R * Math.sin(phiP);
      var yRing = R * Math.cos(phiP);
      var phiEquator = (Math.PI / 2) - phiP;

      var chord = 2 * Math.max(ringR, 0.05) * Math.sin(Math.PI / K);
      var width = chord * overlap;
      var arc = R * dPhi;
      var height = arc * overlap;

      for (var i = 0; i < K; i++) {
        var theta = (i / K) * Math.PI * 2;
        var x = ringR * Math.sin(theta);
        var z = ringR * Math.cos(theta);
        var rotY = THREE.MathUtils.radToDeg(Math.atan2(x, z));
        var rotX = -THREE.MathUtils.radToDeg(phiEquator);

        this._createTile({
          position: { x: x, y: yRing, z: z },
          rotation: { x: rotX, y: rotY, z: 0 },
          width: width,
          height: height,
          depth: thickness,
        });
      }
    }

    var capSize = 2 * R * Math.sin(dPhi / 2) * overlap * 1.5;
    this._createTile({
      position: { x: 0, y: R, z: 0 },
      rotation: { x: -90, y: 0, z: 0 },
      width: capSize,
      height: capSize,
      depth: thickness,
    });
  },

  _createTile: function (opts) {
    var el = document.createElement('a-box');
    el.setAttribute('position', opts.position);
    el.setAttribute('rotation', opts.rotation);
    el.setAttribute('width', opts.width);
    el.setAttribute('height', opts.height);
    el.setAttribute('depth', opts.depth);
    el.setAttribute('visible', false);
    el.setAttribute('data-physx-hidden-collider', '');
    el.setAttribute('physx-body', 'type: static');
    el.setAttribute('physx-material', this._physxMaterial + this._layerSuffix);

    this.el.appendChild(el);
    this.tiles.push(el);
  },
});
