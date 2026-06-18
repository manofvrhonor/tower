/* global AFRAME, CONFIG, THREE */

/**
 * float-motion-trail — хвост-«змейка» по trace пути куба.
 *
 * Сегментов фиксированное число (segmentCount), каждый сидит на ПОСТОЯННОМ
 * отставании от головы: dist_i = headSkipM + i*trailSpacingM. Голова — живая
 * мировая позиция куба каждый кадр, поэтому хвост плавно тянется по траектории
 * и не «спрыгивает» при обрезке буфера. Буфер trace (trailLengthM) держим
 * длиннее самого дальнего сегмента, чтобы он всегда интерполировался внутри пути.
 *
 * Яркость: trailVisibility = minVis + (maxVis-minVis)*slowFactor (10%..15%).
 * Размер: линейный blend headSizeScale → tailSizeScale вдоль хвоста.
 * Fade opacity вдоль хвоста: непрозрачно у куба → прозрачно на конце.
 */
AFRAME.registerComponent('float-motion-trail', {
  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.slowmoFx &&
      CONFIG.slowmoFx.trail) || {};
    this._path = [];
    this._worldPos = new THREE.Vector3();
    this._worldQuat = new THREE.Quaternion();
    this._tmpQuat = new THREE.Quaternion();
    this._prevQuat = new THREE.Quaternion();
    this._samplePos = new THREE.Vector3();
    this._sampleQuat = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._color = '#888888';
    this._pathReady = false;

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
      this._pathReady = false;
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

    if (!this._pathReady) {
      this._seedInitialPath();
    }

    this._trimPathByLength();

    if (this._path.length < 2) {
      this.trailRoot.setAttribute('visible', false);
      return;
    }

    this.trailRoot.setAttribute('visible', true);
    this._updateTrailVisuals(trailVis);
  },

  /**
   * 10% при realtime, 15% при полном slo-mo.
   */
  _getTrailVisibility: function (ts) {
    var tsCfg = (typeof CONFIG !== 'undefined' && CONFIG.timeScale) || {};
    var tsMin = tsCfg.min !== undefined ? tsCfg.min : 0.05;
    var tsMax = tsCfg.max !== undefined ? tsCfg.max : 1.0;
    var range = tsMax - tsMin;
    if (range < 1e-6) {
      return this.cfg.minVisibility !== undefined ? this.cfg.minVisibility : 0.1;
    }

    var slowFactor = (tsMax - ts) / range;
    if (slowFactor < 0) slowFactor = 0;
    if (slowFactor > 1) slowFactor = 1;

    var minVis = this.cfg.minVisibility !== undefined ? this.cfg.minVisibility : 0.1;
    var maxVis = this.cfg.maxVisibility !== undefined ? this.cfg.maxVisibility : 0.15;
    return minVis + (maxVis - minVis) * slowFactor;
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

  /**
   * Заполняет буфер trace «фальшивой» историей вдоль −driftDir,
   * чтобы хвост был готов сразу (без появления сегментов скачками).
   * Направление берётся из floating-cube._driftDir (импульс при спавне),
   * а не из getLinearVelocity — на старте PhysX отдаёт некорректный вектор.
   */
  _seedInitialPath: function () {
    if (this._pathReady) return;

    var fc = this.el.components['floating-cube'];
    if (!fc || !fc._physicsApplied || !fc._driftDir) return;

    var el = this.el;
    el.object3D.getWorldPosition(this._worldPos);
    el.object3D.getWorldQuaternion(this._worldQuat);

    var drift = fc._driftDir;
    // Хвост — позади куба, против направления дрейфа.
    var dx = -drift.x;
    var dy = -drift.y;
    var dz = -drift.z;

    var cfg = this.cfg;
    var headSkip = cfg.headSkipM !== undefined ? cfg.headSkipM : 0.028;
    var spacing = cfg.trailSpacingM !== undefined ? cfg.trailSpacingM : 0.02;
    var nSeg = this._segCount;
    var sampleStep = cfg.minSampleStep !== undefined ? cfg.minSampleStep : 0.022;
    var bufferLen = cfg.trailLengthM !== undefined ? cfg.trailLengthM : 0.5;
    var neededLen = headSkip + (nSeg - 1) * spacing;
    var seedLen = Math.min(neededLen, bufferLen);

    var px = this._worldPos.x;
    var py = this._worldPos.y;
    var pz = this._worldPos.z;
    var qx = this._worldQuat.x;
    var qy = this._worldQuat.y;
    var qz = this._worldQuat.z;
    var qw = this._worldQuat.w;

    this._path.length = 0;
    for (var dist = seedLen; dist >= sampleStep; dist -= sampleStep) {
      this._path.push({
        px: px + dx * dist,
        py: py + dy * dist,
        pz: pz + dz * dist,
        qx: qx, qy: qy, qz: qz, qw: qw,
      });
    }

    if (this._path.length >= 2) {
      this._pathReady = true;
    }
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
   * Точка на trace: distFromHead метров назад от ЖИВОЙ головы (текущая позиция
   * куба this._worldPos/_worldQuat), затем по записанным точкам от свежих к старым.
   * Возвращает false, если distFromHead больше доступной длины пути (сегмент прячем).
   */
  _samplePath: function (distFromHead, outPos, outQuat) {
    var path = this._path;
    var n = path.length;

    if (distFromHead <= 0 || n === 0) {
      outPos.copy(this._worldPos);
      outQuat.copy(this._worldQuat);
      return n !== 0 || distFromHead <= 0;
    }

    var remaining = distFromHead;
    var prevX = this._worldPos.x;
    var prevY = this._worldPos.y;
    var prevZ = this._worldPos.z;
    this._prevQuat.copy(this._worldQuat);

    for (var i = n - 1; i >= 0; i--) {
      var p = path[i];
      var dx = prevX - p.px;
      var dy = prevY - p.py;
      var dz = prevZ - p.pz;
      var segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (segLen >= 1e-6) {
        if (remaining <= segLen) {
          var t = remaining / segLen;
          outPos.set(
            prevX + (p.px - prevX) * t,
            prevY + (p.py - prevY) * t,
            prevZ + (p.pz - prevZ) * t
          );
          this._tmpQuat.set(p.qx, p.qy, p.qz, p.qw);
          outQuat.copy(this._prevQuat).slerp(this._tmpQuat, t);
          return true;
        }
        remaining -= segLen;
      }

      prevX = p.px;
      prevY = p.py;
      prevZ = p.pz;
      this._prevQuat.set(p.qx, p.qy, p.qz, p.qw);
    }

    // distFromHead за пределами trace — сегмент не показываем (старт дрейфа).
    return false;
  },

  _updateTrailVisuals: function (trailVis) {
    var cfg = this.cfg;
    var cubeCfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    var size = cubeCfg.size !== undefined ? cubeCfg.size : 0.1;
    var sizeScale = cfg.sizeScale !== undefined ? cfg.sizeScale : 0.95;
    var trailSize = size * sizeScale;
    var headSizeScale = cfg.headSizeScale !== undefined ? cfg.headSizeScale : 0.95;
    var tailSizeScale = cfg.tailSizeScale !== undefined ? cfg.tailSizeScale : 0.85;
    var headSkip = cfg.headSkipM !== undefined ? cfg.headSkipM : (size * 0.28);
    var spacing = cfg.trailSpacingM !== undefined ? cfg.trailSpacingM : 0.02;
    var maxOp = cfg.maxOpacity !== undefined ? cfg.maxOpacity : 1.0;
    var fadePower = cfg.fadePower !== undefined ? cfg.fadePower : 1.35;
    var nSeg = this._segCount;

    var mat = this.el.getAttribute('material') || {};
    this._color = mat.color || '#888888';

    var samplePos = this._samplePos;
    var sampleQuat = this._sampleQuat;

    for (var i = 0; i < nSeg; i++) {
      var seg = this._segments[i];
      var t = (nSeg <= 1) ? 0 : i / (nSeg - 1);
      // Фиксированное отставание: сегмент i всегда на одном расстоянии за головой.
      var dist = headSkip + i * spacing;

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

      // Линейный blend размера: старт −5%, конец −15% от базового trailSize.
      var segSizeScale = headSizeScale + t * (tailSizeScale - headSizeScale);
      var segSize = trailSize * segSizeScale;

      this._euler.setFromQuaternion(sampleQuat, 'YXZ');
      seg.setAttribute('visible', true);
      seg.setAttribute('position',
        samplePos.x + ' ' + samplePos.y + ' ' + samplePos.z);
      seg.setAttribute('rotation',
        THREE.MathUtils.radToDeg(this._euler.x) + ' ' +
        THREE.MathUtils.radToDeg(this._euler.y) + ' ' +
        THREE.MathUtils.radToDeg(this._euler.z));
      seg.setAttribute('width', segSize);
      seg.setAttribute('height', segSize);
      seg.setAttribute('depth', segSize);
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
