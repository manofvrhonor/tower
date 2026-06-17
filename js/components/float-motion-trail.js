/* global AFRAME, CONFIG, THREE */

/**
 * float-motion-trail — хвост по trace пути (~40 см), blend голова→хвост.
 *
 * Буфер точек обрезается по длине пути (trailLengthM), не по времени.
 * Яркость: trailVisibility = minVis + (1-minVis)*slowFactor (10%..100%).
 * Fade вдоль пути: непрозрачно у куба → прозрачно на конце trace.
 */
AFRAME.registerComponent('float-motion-trail', {
  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.slowmoFx &&
      CONFIG.slowmoFx.trail) || {};
    this._path = [];
    this._worldPos = new THREE.Vector3();
    this._worldQuat = new THREE.Quaternion();
    this._tmpQuat = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._color = '#888888';

    var segCount = this.cfg.segmentCount !== undefined ? this.cfg.segmentCount : 10;
    this._segCount = segCount;
    this._segments = [];

    this.trailRoot = document.createElement('a-entity');
    this.trailRoot.setAttribute('visible', false);
    this.el.sceneEl.appendChild(this.trailRoot);

    for (var i = 0; i < segCount; i++) {
      var seg = document.createElement('a-box');
      seg.setAttribute('material',
        'shader: flat; transparent: true; depthWrite: false; opacity: 0');
      seg.setAttribute('visible', false);
      this.trailRoot.appendChild(seg);
      this._segments.push(seg);
    }
  },

  tick: function () {
    var fc = this.el.components['floating-cube'];
    if (!fc || fc.state !== 'float' || (this.el.is && this.el.is('grabbed-dynamic'))) {
      if (this._path.length > 0) this._path.length = 0;
      this.trailRoot.setAttribute('visible', false);
      return;
    }

    var tsSys = this.el.sceneEl.systems['time-scale'];
    if (!tsSys) return;

    var trailVis = this._getTrailVisibility(tsSys.getScale());
    if (trailVis < 0.005) {
      this.trailRoot.setAttribute('visible', false);
      return;
    }

    this._tryRecordPoint();
    this._trimPathByLength();

    if (this._path.length < 2) {
      this.trailRoot.setAttribute('visible', false);
      return;
    }

    this.trailRoot.setAttribute('visible', true);
    this._updateTrailVisuals(trailVis);
  },

  /**
   * 10% при realtime, 100% при полном slo-mo.
   */
  _getTrailVisibility: function (ts) {
    var tsCfg = (typeof CONFIG !== 'undefined' && CONFIG.timeScale) || {};
    var tsMin = tsCfg.min !== undefined ? tsCfg.min : 0.05;
    var tsMax = tsCfg.max !== undefined ? tsCfg.max : 1.0;
    var range = tsMax - tsMin;
    if (range < 1e-6) return this.cfg.minVisibility !== undefined ? this.cfg.minVisibility : 0.1;

    var slowFactor = (tsMax - ts) / range;
    if (slowFactor < 0) slowFactor = 0;
    if (slowFactor > 1) slowFactor = 1;

    var minVis = this.cfg.minVisibility !== undefined ? this.cfg.minVisibility : 0.1;
    return minVis + (1 - minVis) * slowFactor;
  },

  _tryRecordPoint: function () {
    var el = this.el;
    var cfg = this.cfg;
    var cubeCfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    var size = cubeCfg.size !== undefined ? cubeCfg.size : 0.1;
    var minStep = cfg.minSampleStep !== undefined ? cfg.minSampleStep : (size * 0.22);

    el.object3D.getWorldPosition(this._worldPos);
    el.object3D.getWorldQuaternion(this._worldQuat);

    var px = this._worldPos.x;
    var py = this._worldPos.y;
    var pz = this._worldPos.z;

    if (this._path.length > 0) {
      var last = this._path[this._path.length - 1];
      var dx = px - last.px;
      var dy = py - last.py;
      var dz = pz - last.pz;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < minStep) {
        return;
      }
    }

    this._path.push({
      px: px, py: py, pz: pz,
      qx: this._worldQuat.x, qy: this._worldQuat.y,
      qz: this._worldQuat.z, qw: this._worldQuat.w,
    });
  },

  _pathTotalLength: function () {
    var len = 0;
    for (var i = 1; i < this._path.length; i++) {
      var a = this._path[i - 1];
      var b = this._path[i];
      var dx = b.px - a.px;
      var dy = b.py - a.py;
      var dz = b.pz - a.pz;
      len += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return len;
  },

  _trimPathByLength: function () {
    var maxLen = this.cfg.trailLengthM !== undefined ? this.cfg.trailLengthM : 0.4;
    while (this._path.length > 2 && this._pathTotalLength() > maxLen) {
      this._path.shift();
    }
  },

  /**
   * Точка на пути: distFromHead метров назад от головы (конца path).
   */
  _samplePath: function (distFromHead, outPos, outQuat) {
    var path = this._path;
    var n = path.length;
    if (n === 0) return false;

    if (distFromHead <= 0 || n === 1) {
      var last = path[n - 1];
      outPos.set(last.px, last.py, last.pz);
      outQuat.set(last.qx, last.qy, last.qz, last.qw);
      return true;
    }

    var remaining = distFromHead;
    for (var i = n - 1; i > 0; i--) {
      var a = path[i];
      var b = path[i - 1];
      var dx = a.px - b.px;
      var dy = a.py - b.py;
      var dz = a.pz - b.pz;
      var segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (segLen < 1e-6) continue;

      if (remaining <= segLen) {
        var t = remaining / segLen;
        outPos.set(
          a.px + (b.px - a.px) * t,
          a.py + (b.py - a.py) * t,
          a.pz + (b.pz - a.pz) * t
        );
        outQuat.set(a.qx, a.qy, a.qz, a.qw);
        this._tmpQuat.set(b.qx, b.qy, b.qz, b.qw);
        outQuat.slerp(this._tmpQuat, t);
        return true;
      }
      remaining -= segLen;
    }

    var first = path[0];
    outPos.set(first.px, first.py, first.pz);
    outQuat.set(first.qx, first.qy, first.qz, first.qw);
    return true;
  },

  _updateTrailVisuals: function (trailVis) {
    var cfg = this.cfg;
    var cubeCfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    var size = cubeCfg.size !== undefined ? cubeCfg.size : 0.1;
    var sizeScale = cfg.sizeScale !== undefined ? cfg.sizeScale : 0.95;
    var trailSize = size * sizeScale;
    var trailLen = Math.min(
      this.cfg.trailLengthM !== undefined ? this.cfg.trailLengthM : 0.4,
      this._pathTotalLength()
    );
    var headSkip = cfg.headSkipM !== undefined ? cfg.headSkipM : (size * 0.28);
    var maxOp = cfg.maxOpacity !== undefined ? cfg.maxOpacity : 0.55;
    var fadePower = cfg.fadePower !== undefined ? cfg.fadePower : 1.35;
    var nSeg = this._segCount;

    var mat = this.el.getAttribute('material') || {};
    this._color = mat.color || '#888888';

    var samplePos = new THREE.Vector3();
    var sampleQuat = new THREE.Quaternion();

    for (var i = 0; i < nSeg; i++) {
      var seg = this._segments[i];
      var t = (nSeg <= 1) ? 0 : i / (nSeg - 1);
      var dist = headSkip + t * Math.max(0, trailLen - headSkip);

      if (!this._samplePath(dist, samplePos, sampleQuat)) {
        seg.setAttribute('visible', false);
        continue;
      }

      var alongFade = Math.pow(1 - t, fadePower);
      var opacity = maxOp * trailVis * alongFade;

      if (opacity < 0.008) {
        seg.setAttribute('visible', false);
        continue;
      }

      this._euler.setFromQuaternion(sampleQuat, 'YXZ');
      seg.setAttribute('visible', true);
      seg.setAttribute('position',
        samplePos.x + ' ' + samplePos.y + ' ' + samplePos.z);
      seg.setAttribute('rotation',
        THREE.MathUtils.radToDeg(this._euler.x) + ' ' +
        THREE.MathUtils.radToDeg(this._euler.y) + ' ' +
        THREE.MathUtils.radToDeg(this._euler.z));
      seg.setAttribute('width', trailSize);
      seg.setAttribute('height', trailSize);
      seg.setAttribute('depth', trailSize);
      seg.setAttribute('material',
        'shader: flat; color: ' + this._color +
        '; opacity: ' + opacity +
        '; transparent: true; depthWrite: false');

      if (seg.object3D) seg.object3D.renderOrder = -1;
    }
  },

  remove: function () {
    if (this.trailRoot && this.trailRoot.parentNode) {
      this.trailRoot.parentNode.removeChild(this.trailRoot);
    }
  },
});
