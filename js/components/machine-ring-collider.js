/* global AFRAME, CONFIG, THREE */

/**
 * machine-ring-collider — kinematic box-сегменты по окружности для GLB-колец.
 *
 * Вешается на #machine-ring / #machine-ring-inner. Сегменты — дети entity;
 * крутятся вместе с vis (machine-rig tick). Центр кольца пустой — не convex _COL.
 * Параметры: CONFIG.machine.rig.ringSegments / ringInnerSegments.
 */
AFRAME.registerComponent('machine-ring-collider', {
  schema: {
    which: { default: 'outer', oneOf: ['outer', 'inner'] },
  },

  init: function () {
    this._segments = [];
    this._cfg = this._readCfg();
    if (this._cfg.enabled === false) return;
    this._buildSegments();
  },

  remove: function () {
    for (var i = 0; i < this._segments.length; i++) {
      var s = this._segments[i];
      if (s.parentNode) s.parentNode.removeChild(s);
    }
    this._segments.length = 0;
  },

  _readCfg: function () {
    var rig = ((typeof CONFIG !== 'undefined' && CONFIG.machine) || {}).rig || {};
    var key = this.data.which === 'inner' ? 'ringInnerSegments' : 'ringSegments';
    var seg = rig[key] || {};
    var defaults = this.data.which === 'inner'
      ? { enabled: true, radius: 0.14, thickness: 0.02, bandWidth: 0.035, segments: 64, overlap: 1.08 }
      : { enabled: true, radius: 0.24, thickness: 0.025, bandWidth: 0.04, segments: 72, overlap: 1.08 };
    return {
      enabled: seg.enabled !== undefined ? seg.enabled : defaults.enabled,
      radius: seg.radius !== undefined ? seg.radius : defaults.radius,
      thickness: seg.thickness !== undefined ? seg.thickness : defaults.thickness,
      bandWidth: seg.bandWidth !== undefined ? seg.bandWidth : defaults.bandWidth,
      segments: seg.segments !== undefined ? seg.segments : defaults.segments,
      overlap: seg.overlap !== undefined ? seg.overlap : defaults.overlap,
    };
  },

  _physxMaterialStr: function () {
    var bm = (typeof CONFIG !== 'undefined' && CONFIG.world && CONFIG.world.bounceMaterial) || {};
    var layers = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, FLOAT_CUBE: 2, GRAVITY_CUBE: 3, GRABBED_CUBE: 4, BALL: 5, BAT: 7, WAVE_BALL: 8,
    };
    return (
      'restitution: ' + (bm.restitution !== undefined ? bm.restitution : 0.95) +
      '; staticFriction: ' + (bm.staticFriction !== undefined ? bm.staticFriction : 0.05) +
      '; dynamicFriction: ' + (bm.dynamicFriction !== undefined ? bm.dynamicFriction : 0.05) +
      '; collisionLayers: ' + layers.WORLD +
      '; collidesWithLayers: ' + [
        layers.FLOAT_CUBE,
        layers.GRAVITY_CUBE,
        layers.GRABBED_CUBE,
        layers.BALL,
        layers.BAT,
        layers.WAVE_BALL,
      ].join(', ')
    );
  },

  _buildSegments: function () {
    var c = this._cfg;
    var N = c.segments;
    var R = c.radius;
    var th = c.thickness;
    var band = c.bandWidth;
    var overlap = c.overlap;
    var chord = 2 * R * Math.sin(Math.PI / N);
    var width = chord * overlap;
    var matStr = this._physxMaterialStr();

    for (var i = 0; i < N; i++) {
      var theta = (i / N) * Math.PI * 2;
      var x = R * Math.sin(theta);
      var z = R * Math.cos(theta);
      var rotY = THREE.MathUtils.radToDeg(Math.atan2(x, z));

      var el = document.createElement('a-box');
      el.setAttribute('data-machine-ring-segment', this.data.which);
      el.setAttribute('position', x + ' 0 ' + z);
      el.setAttribute('rotation', '0 ' + rotY + ' 0');
      el.setAttribute('width', width);
      el.setAttribute('height', band);
      el.setAttribute('depth', th);
      el.setAttribute('visible', false);
      el.setAttribute('data-physx-hidden-collider', '');
      el.setAttribute('physx-body', 'type: kinematic');
      el.setAttribute('physx-material', matStr);

      if (typeof window.applyColliderDebugVisual === 'function') {
        window.applyColliderDebugVisual(el);
      }

      this.el.appendChild(el);
      this._segments.push(el);
    }

    console.log('[machine-ring-collider]', this.data.which,
      '— сегментов:', N, 'R=' + R.toFixed(3));
  },
});
