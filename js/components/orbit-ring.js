/* global AFRAME, CONFIG, THREE */

/**
 * orbit-ring — наклонное kinematic-кольцо вокруг ядра (Фаза 2.x).
 * Сегменты на слое WORLD; от них отскакивают шары и float-inside кубы.
 */
AFRAME.registerComponent('orbit-ring', {
  schema: {
    index: { default: 0 },
  },

  init: function () {
    this._segments = [];
    this._visuals = [];
    this._spinRad = 0;
    this._cfg = this._readRingCfg();
    this._buildRing();
  },

  remove: function () {
    for (var i = 0; i < this._segments.length; i++) {
      var s = this._segments[i];
      if (s.parentNode) s.parentNode.removeChild(s);
    }
    this._segments.length = 0;
    for (var j = 0; j < this._visuals.length; j++) {
      var v = this._visuals[j];
      if (v.parentNode) v.parentNode.removeChild(v);
    }
    this._visuals.length = 0;
  },

  tick: function (time, timeDelta) {
    var dt = (timeDelta || 16) / 1000;
    var speed = THREE.MathUtils.degToRad(this._cfg.spinSpeedDeg || 0);
    this._spinRad += speed * dt;

    var r = { x: 0, y: 0, z: 0 };
    var tilt = this._cfg.tiltDeg;
    var ta = this._cfg.tiltAxis;
    if (ta === 'x') r.x = tilt;
    else if (ta === 'y') r.y = tilt;
    else r.z = tilt;

    var spinDeg = THREE.MathUtils.radToDeg(this._spinRad);
    var sa = this._cfg.spinAxis;
    if (sa === 'x') r.x += spinDeg;
    else if (sa === 'y') r.y += spinDeg;
    else r.z += spinDeg;

    this.el.setAttribute('rotation', r.x + ' ' + r.y + ' ' + r.z);
  },

  _readRingCfg: function () {
    var az = (typeof CONFIG !== 'undefined' && CONFIG.assemblyZone) || {};
    var rings = az.rings || [];
    var idx = this.data.index;
    var r = rings[idx] || rings[0] || {};
    var R = az.radius !== undefined ? az.radius : 0.30;
    return {
      radius: R,
      thickness: az.ringThickness !== undefined ? az.ringThickness : 0.02,
      segments: r.segments !== undefined ? r.segments : 72,
      tiltAxis: r.tiltAxis || 'x',
      tiltDeg: r.tiltDeg !== undefined ? r.tiltDeg : 60,
      spinAxis: r.spinAxis || 'y',
      spinSpeedDeg: r.spinSpeedDeg !== undefined ? r.spinSpeedDeg : 20,
    };
  },

  _readVisualCfg: function () {
    var az = (typeof CONFIG !== 'undefined' && CONFIG.assemblyZone) || {};
    var v = az.ringVisual || {};
    return {
      color: v.color || '#33e0ff',
      emissive: v.emissive || '#22d4f0',
      opacity: v.opacity !== undefined ? v.opacity : 0.92,
    };
  },

  _buildRing: function () {
    var c = this._cfg;
    var N = c.segments;
    var R = c.radius;
    var th = c.thickness;
    var overlap = 1.08;
    var chord = 2 * R * Math.sin(Math.PI / N);
    var width = chord * overlap;

    var layers = (CONFIG && CONFIG.collisionLayers) || {
      WORLD: 0, FLOAT_CUBE: 2, GRAVITY_CUBE: 3, GRABBED_CUBE: 4,
      BALL: 5, BAT: 7, WAVE_BALL: 8, FLOAT_INSIDE: 9,
    };
    var collides = [
      layers.FLOAT_CUBE,
      layers.GRAVITY_CUBE,
      layers.GRABBED_CUBE,
      layers.BALL,
      layers.BAT,
      layers.WAVE_BALL,
      layers.FLOAT_INSIDE,
    ].join(', ');

    var ped = (CONFIG && CONFIG.pedestal && CONFIG.pedestal.physxMaterial) || {};
    var visCfg = this._readVisualCfg();
    var matStr =
      'restitution: ' + (ped.restitution !== undefined ? ped.restitution : 0.15) +
      '; staticFriction: ' + (ped.staticFriction !== undefined ? ped.staticFriction : 0.70) +
      '; dynamicFriction: ' + (ped.dynamicFriction !== undefined ? ped.dynamicFriction : 0.60) +
      '; collisionLayers: ' + layers.WORLD +
      '; collidesWithLayers: ' + collides;

    var tilt = c.tiltDeg;
    var tiltAxis = c.tiltAxis;
    var baseRot = { x: 0, y: 0, z: 0 };
    if (tiltAxis === 'x') baseRot.x = tilt;
    else if (tiltAxis === 'z') baseRot.z = tilt;
    else baseRot.y = tilt;
    this.el.setAttribute('rotation', baseRot.x + ' ' + baseRot.y + ' ' + baseRot.z);

    for (var i = 0; i < N; i++) {
      var theta = (i / N) * Math.PI * 2;
      var x = R * Math.sin(theta);
      var z = R * Math.cos(theta);
      var rotY = THREE.MathUtils.radToDeg(Math.atan2(x, z));

      var el = document.createElement('a-box');
      el.setAttribute('data-orbit-ring-segment', '');
      el.setAttribute('position', x + ' 0 ' + z);
      el.setAttribute('rotation', '0 ' + rotY + ' 0');
      el.setAttribute('width', width);
      el.setAttribute('height', th);
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

      var visH = th * 1.15;
      var vis = document.createElement('a-box');
      vis.setAttribute('data-orbit-ring-visual', '');
      vis.setAttribute('position', x + ' 0 ' + z);
      vis.setAttribute('rotation', '0 ' + rotY + ' 0');
      vis.setAttribute('width', width);
      vis.setAttribute('height', visH);
      vis.setAttribute('depth', visH);
      vis.setAttribute('material',
        'color: ' + visCfg.color +
        '; emissive: ' + visCfg.emissive +
        '; emissiveIntensity: 0.55' +
        '; metalness: 0.25; roughness: 0.35' +
        '; transparent: true; opacity: ' + visCfg.opacity +
        '; shader: standard; side: double'
      );
      this.el.appendChild(vis);
      this._visuals.push(vis);
      if (typeof window.applyGameplayRenderOrder === 'function') {
        window.applyGameplayRenderOrder(vis);
      }
    }

    console.log('[orbit-ring]', this.data.index, '— сегментов:', N, 'R=' + R);
  },
});
