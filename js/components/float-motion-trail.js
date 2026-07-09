/* global AFRAME, CONFIG, THREE */

/**
 * float-motion-trail — сплошной loft-хвост по trace пути куба.
 *
 * Развёртывание (deploy): якорь кончика фиксирован в мире, голова — у куба;
 * хвост тянется между ними, пока куб не пройдёт deployLengthM → follow по path.
 * Fade вдоль хвоста — по реальной длине mesh (без двойного growFactor).
 * Grab — fade-out за grabFadeOutSec (замороженный path).
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
    this._corner = new THREE.Vector3();
    this._curveEvalPos = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._tangentPrev = new THREE.Vector3();
    this._tangentNext = new THREE.Vector3();
    this._refAxis = new THREE.Vector3();
    this._profileRight = new THREE.Vector3();
    this._profileUp = new THREE.Vector3();
    this._headBase = new THREE.Vector3();
    this._color = '#888888';
    this._grabFadeOutActive = false;
    this._grabFadeOutElapsed = 0;
    this._frozenPath = null;
    this._frozenHeadPos = new THREE.Vector3();
    this._frozenHeadQuat = new THREE.Quaternion();
    this._deployActive = false;
    this._deployPending = true;
    this._deployTravel = 0;
    this._deployAnchorPos = new THREE.Vector3();
    this._deployAnchorQuat = new THREE.Quaternion();
    this._prevDeployPos = new THREE.Vector3();
    this._ballTrailCfg = null;

    this._resolveProfileSettings();
    var nSec = this._sectionCount;

    this._curvePoints = [];
    this._curveQuats = [];
    for (var i = 0; i < nSec; i++) {
      this._curvePoints.push(new THREE.Vector3());
      this._curveQuats.push(new THREE.Quaternion());
    }

    this._buildLoftMesh();

    this.trailRoot = document.createElement('a-entity');
    this.trailRoot.setAttribute('visible', false);
    this.el.sceneEl.appendChild(this.trailRoot);
    this.trailRoot.object3D.add(this._mesh);
  },

  _buildLoftMesh: function () {
    var nSec = this._sectionCount;
    var pv = this._profileVerts;
    var vertCount = nSec * pv;

    this._positions = new Float32Array(vertCount * 3);
    this._uvs = new Float32Array(vertCount * 2);

    var indices = [];
    for (var s = 0; s < nSec - 1; s++) {
      for (var j = 0; j < pv; j++) {
        var jNext = (j + 1) % pv;
        var i0 = s * pv + j;
        var i1 = s * pv + jNext;
        var i2 = (s + 1) * pv + j;
        var i3 = (s + 1) * pv + jNext;
        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    this._geometry = new THREE.BufferGeometry();
    this._geometry.setAttribute('position',
      new THREE.BufferAttribute(this._positions, 3));
    this._geometry.setAttribute('uv',
      new THREE.BufferAttribute(this._uvs, 2));
    this._geometry.setIndex(indices);

    var canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);
    this._fadeTexture = new THREE.CanvasTexture(canvas);
    this._fadeTexture.needsUpdate = true;

    this._material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: this._fadeTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this._mesh = new THREE.Mesh(this._geometry, this._material);
    this._mesh.frustumCulled = false;
    this._mesh.renderOrder = -1;
    this._mesh.visible = false;
  },

  _getTrailParam: function (name, fallback) {
    if (this._ballTrailCfg && this._ballTrailCfg[name] !== undefined) {
      return this._ballTrailCfg[name];
    }
    if (this.cfg[name] !== undefined) return this.cfg[name];
    return fallback;
  },

  _resolveProfileSettings: function () {
    var defaultSec = this.cfg.loftSectionCount !== undefined ? this.cfg.loftSectionCount : 14;
    var geo = this.el.getAttribute('geometry') || {};
    if (geo.primitive === 'sphere') {
      var bt = (typeof CONFIG !== 'undefined' && CONFIG.balls && CONFIG.balls.trail) || {};
      this._ballTrailCfg = bt;
      this._profileVerts = bt.profileVerts !== undefined ? bt.profileVerts : 10;
      this._trailSizeScale = bt.sizeScale !== undefined ? bt.sizeScale : 0.52;
      this._trailHeadSizeScale = bt.headSizeScale !== undefined ? bt.headSizeScale : 0.95;
      this._trailTailSizeScale = bt.tailSizeScale !== undefined ? bt.tailSizeScale : 0.5;
      this._trailHeadSkipM = bt.headSkipM;
      this._sectionCount = bt.loftSectionCount !== undefined ? bt.loftSectionCount : defaultSec;
      return;
    }
    this._ballTrailCfg = null;
    this._profileVerts = 4;
    this._trailSizeScale = null;
    this._trailHeadSizeScale = null;
    this._trailTailSizeScale = null;
    this._trailHeadSkipM = null;
    this._sectionCount = defaultSec;
  },

  _profileOffset: function (c, pv, half) {
    if (pv === 4) {
      var sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      return { x: sq[c][0] * half, y: sq[c][1] * half };
    }
    var angle = (c / pv) * Math.PI * 2;
    return { x: Math.cos(angle) * half, y: Math.sin(angle) * half };
  },

  _getObjectSize: function () {
    var geo = this.el.getAttribute('geometry') || {};
    if (geo.primitive === 'sphere' && geo.radius !== undefined) {
      return geo.radius * 2;
    }
    if (geo.width !== undefined) return geo.width;
    var cubeCfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    return cubeCfg.size !== undefined ? cubeCfg.size : 0.1;
  },

  tick: function (time, timeDelta) {
    var dt = Math.min((timeDelta || 16) / 1000, 0.1);
    var fc = this.el.components['floating-cube'];
    var ballComp = this.el.components['red-ball'];
    var isGrabbed = !!(this.el.is && this.el.is('grabbed-dynamic'));
    var isFloat = (fc && fc.state === 'float') || !!ballComp;

    var tsSys = this.el.sceneEl.systems['time-scale'];
    if (!tsSys) return;

    var trailVis = this._getTrailVisibility(tsSys.getScale());

    // Wave-шар: хвост гаснет вместе с fade scale/opacity.
    if (ballComp && ballComp._fadeT !== undefined && ballComp._fadeT < 0.999) {
      trailVis *= Math.max(0, ballComp._fadeT);
    }

    if (isFloat && !isGrabbed && this._grabFadeOutActive) {
      this._endGrabFadeOut();
    }

    if (this._grabFadeOutActive) {
      var duration = this.cfg.grabFadeOutSec !== undefined ? this.cfg.grabFadeOutSec : 2.5;
      this._grabFadeOutElapsed += dt;
      var k = 1 - this._grabFadeOutElapsed / duration;
      if (k <= 0 || trailVis < 0.005) {
        this._endGrabFadeOut();
        return;
      }
      this.trailRoot.setAttribute('visible', true);
      this._updateLoftVisuals(trailVis, { opacityMult: k, frozen: true });
      return;
    }

    if (isGrabbed) {
      if (this._path.length >= 2) {
        this._beginGrabFadeOut();
        this.trailRoot.setAttribute('visible', true);
        this._updateLoftVisuals(trailVis, { opacityMult: 1, frozen: true });
      } else {
        this._clearTrail();
      }
      return;
    }

    if (!isFloat) {
      this._clearTrail();
      return;
    }

    if (trailVis < 0.005) {
      this.trailRoot.setAttribute('visible', false);
      this._mesh.visible = false;
      return;
    }

    this.el.object3D.getWorldPosition(this._worldPos);
    this.el.object3D.getWorldQuaternion(this._worldQuat);

    if (this._deployPending) {
      this._beginDeploy();
    }

    if (this._deployActive) {
      this._updateDeployTravel();
    }

    this._tryRecordPoint();
    this._trimPathByLength();

    var canShow = this._deployActive ||
      (this._path.length >= 2 && !this._deployPending);
    if (!canShow) {
      this.trailRoot.setAttribute('visible', false);
      this._mesh.visible = false;
      return;
    }

    this.trailRoot.setAttribute('visible', true);
    this._updateLoftVisuals(trailVis);
  },

  _clearTrail: function () {
    this._path.length = 0;
    this._grabFadeOutActive = false;
    this._grabFadeOutElapsed = 0;
    this._frozenPath = null;
    this._deployActive = false;
    this._deployPending = true;
    this._deployTravel = 0;
    this.trailRoot.setAttribute('visible', false);
    this._mesh.visible = false;
  },

  _beginDeploy: function () {
    this.el.object3D.getWorldPosition(this._deployAnchorPos);
    this.el.object3D.getWorldQuaternion(this._deployAnchorQuat);
    this._prevDeployPos.copy(this._deployAnchorPos);
    this._deployTravel = 0;
    this._deployActive = true;
    this._deployPending = false;
  },

  _updateDeployTravel: function () {
    var step = this._worldPos.distanceTo(this._prevDeployPos);
    this._deployTravel += step;
    this._prevDeployPos.copy(this._worldPos);

    var deployLen = this.cfg.deployLengthM !== undefined ? this.cfg.deployLengthM : 0.42;
    if (this._deployTravel >= deployLen) {
      this._deployActive = false;
    }
  },

  _beginGrabFadeOut: function () {
    this._frozenPath = this._path.slice();
    this.el.object3D.getWorldPosition(this._frozenHeadPos);
    this.el.object3D.getWorldQuaternion(this._frozenHeadQuat);
    this._path.length = 0;
    this._grabFadeOutActive = true;
    this._grabFadeOutElapsed = 0;
    this._deployActive = false;
    this._deployPending = true;
    this._deployTravel = 0;
  },

  _endGrabFadeOut: function () {
    this._grabFadeOutActive = false;
    this._grabFadeOutElapsed = 0;
    this._frozenPath = null;
    this._deployPending = true;
    this.trailRoot.setAttribute('visible', false);
    this._mesh.visible = false;
  },

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
    var cfg = this.cfg;
    var size = this._getObjectSize();
    var minStep = cfg.minSampleStep !== undefined ? cfg.minSampleStep : (size * 0.22);

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

  _pathTotalLength: function (pathOverride) {
    var path = pathOverride || this._path;
    var len = 0;
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1];
      var b = path[i];
      var dx = b.px - a.px;
      var dy = b.py - a.py;
      var dz = b.pz - a.pz;
      len += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return len;
  },

  _getTargetSpan: function (spacing, nSec) {
    return (nSec - 1) * spacing;
  },

  _trimPathByLength: function () {
    var maxLen = this._getTrailParam('trailLengthM', 0.4);
    while (this._path.length > 2 && this._pathTotalLength() > maxLen) {
      this._path.shift();
    }
  },

  _samplePath: function (distFromHead, outPos, outQuat, sampleOpts) {
    sampleOpts = sampleOpts || {};
    var path = sampleOpts.path || this._path;
    var headPos = sampleOpts.headPos || this._worldPos;
    var headQuat = sampleOpts.headQuat || this._worldQuat;
    var n = path.length;

    if (distFromHead <= 0 || n === 0) {
      outPos.copy(headPos);
      outQuat.copy(headQuat);
      return n !== 0 || distFromHead <= 0;
    }

    var remaining = distFromHead;
    var prevX = headPos.x;
    var prevY = headPos.y;
    var prevZ = headPos.z;
    this._prevQuat.copy(headQuat);

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

    return false;
  },

  /**
   * Deploy: якорь (кончик) фиксирован, голова у куба; сечения — lerp.
   * Возвращает текущую длину span (м) или 0 если слишком коротко.
   */
  _fillCurvePointsDeploy: function (headSkip) {
    var anchor = this._deployAnchorPos;
    var head = this._worldPos;
    var dx = head.x - anchor.x;
    var dy = head.y - anchor.y;
    var dz = head.z - anchor.z;
    var span = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (span < 0.004) return 0;

    var inv = 1 / span;
    var dirX = dx * inv;
    var dirY = dy * inv;
    var dirZ = dz * inv;

    this._headBase.set(
      head.x - dirX * headSkip,
      head.y - dirY * headSkip,
      head.z - dirZ * headSkip
    );

    var nSec = this._sectionCount;
    var headQ = this._worldQuat;
    var anchorQ = this._deployAnchorQuat;

    for (var i = 0; i < nSec; i++) {
      var u = (nSec <= 1) ? 0 : i / (nSec - 1);
      var pt = this._curvePoints[i];
      pt.set(
        this._headBase.x + (anchor.x - this._headBase.x) * u,
        this._headBase.y + (anchor.y - this._headBase.y) * u,
        this._headBase.z + (anchor.z - this._headBase.z) * u
      );
      this._tmpQuat.copy(anchorQ);
      this._curveQuats[i].copy(headQ).slerp(this._tmpQuat, u);
    }

    return Math.max(0, span - headSkip);
  },

  /** Follow: сечения по path от головы. Возвращает число сечений. */
  _fillCurvePointsFollow: function (headSkip, spacing, nSec, sampleOpts) {
    var samplePos = this._samplePos;
    var sampleQuat = this._sampleQuat;
    var visibleSections = 0;

    for (var i = 0; i < nSec; i++) {
      var dist = headSkip + i * spacing;
      if (!this._samplePath(dist, samplePos, sampleQuat, sampleOpts)) {
        break;
      }
      this._curvePoints[i].copy(samplePos);
      this._curveQuats[i].copy(sampleQuat);
      visibleSections = i + 1;
    }

    return visibleSections;
  },

  _evalCatmullRomPoint: function (t, count, out) {
    var pts = this._curvePoints;
    if (count <= 1) {
      out.copy(pts[0]);
      return;
    }
    if (count === 2) {
      out.copy(pts[0]).lerp(pts[1], t);
      return;
    }

    var u = t * (count - 1);
    var i = Math.floor(u);
    if (i >= count - 1) {
      out.copy(pts[count - 1]);
      return;
    }
    var f = u - i;
    var p0 = pts[i > 0 ? i - 1 : i];
    var p1 = pts[i];
    var p2 = pts[i + 1];
    var p3 = pts[i + 2 < count ? i + 2 : count - 1];
    var t2 = f * f;
    var t3 = t2 * f;

    out.set(
      0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      0.5 * ((2 * p1.z) + (-p0.z + p2.z) * f +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
    );
  },

  _evalCatmullRomQuat: function (t, count, out) {
    var quats = this._curveQuats;
    if (count <= 1) {
      out.copy(quats[0]);
      return;
    }
    var u = t * (count - 1);
    var i = Math.floor(u);
    if (i >= count - 1) {
      out.copy(quats[count - 1]);
      return;
    }
    var f = u - i;
    this._tmpQuat.copy(quats[i + 1]);
    out.copy(quats[i]).slerp(this._tmpQuat, f);
  },

  _buildProfileFrame: function (t, count, outRight, outUp) {
    var eps = 0.02;
    var t0 = Math.max(0, t - eps);
    var t1 = Math.min(1, t + eps);
    this._evalCatmullRomPoint(t0, count, this._tangentPrev);
    this._evalCatmullRomPoint(t1, count, this._tangentNext);
    this._tangent.subVectors(this._tangentNext, this._tangentPrev);

    if (this._tangent.lengthSq() < 1e-10 && count >= 2) {
      this._tangent.subVectors(this._curvePoints[1], this._curvePoints[0]);
    }
    if (this._tangent.lengthSq() < 1e-10) {
      this._tangent.set(0, 0, -1);
    }
    this._tangent.normalize();

    this._evalCatmullRomQuat(t, count, this._sampleQuat);
    this._refAxis.set(0, 1, 0).applyQuaternion(this._sampleQuat);
    var dot = this._refAxis.dot(this._tangent);
    this._refAxis.x -= this._tangent.x * dot;
    this._refAxis.y -= this._tangent.y * dot;
    this._refAxis.z -= this._tangent.z * dot;

    if (this._refAxis.lengthSq() < 1e-8) {
      this._refAxis.set(0, 1, 0);
      dot = this._refAxis.dot(this._tangent);
      this._refAxis.x -= this._tangent.x * dot;
      this._refAxis.y -= this._tangent.y * dot;
      this._refAxis.z -= this._tangent.z * dot;
    }
    if (this._refAxis.lengthSq() < 1e-8) {
      this._refAxis.set(1, 0, 0);
      dot = this._refAxis.dot(this._tangent);
      this._refAxis.x -= this._tangent.x * dot;
      this._refAxis.y -= this._tangent.y * dot;
      this._refAxis.z -= this._tangent.z * dot;
    }
    this._refAxis.normalize();

    outRight.crossVectors(this._tangent, this._refAxis).normalize();
    outUp.crossVectors(outRight, this._tangent).normalize();
  },

  /**
   * Альфа вдоль хвоста: 0 → пик на headFadeInM → 0 на конце meshSpan.
   */
  _alongTrailAlpha: function (d, meshSpan) {
    var headIn = this.cfg.headFadeInM !== undefined ? this.cfg.headFadeInM : 0.1;
    var fadePower = this.cfg.fadePower !== undefined ? this.cfg.fadePower : 1.35;

    if (d <= 0 || meshSpan <= 0) return 0;
    if (d < headIn) {
      return d / headIn;
    }
    if (d >= meshSpan) return 0;

    var tailLen = meshSpan - headIn;
    if (tailLen < 1e-6) return 0;

    var tailT = (d - headIn) / tailLen;
    return Math.pow(1 - tailT, fadePower);
  },

  _updateLoftVisuals: function (trailVis, renderOpts) {
    renderOpts = renderOpts || {};
    var opacityMult = renderOpts.opacityMult !== undefined ? renderOpts.opacityMult : 1;
    var sampleOpts = renderOpts.frozen ? {
      path: this._frozenPath,
      headPos: this._frozenHeadPos,
      headQuat: this._frozenHeadQuat,
    } : null;

    var cfg = this.cfg;
    var size = this._getObjectSize();
    var sizeScale = this._trailSizeScale !== null && this._trailSizeScale !== undefined
      ? this._trailSizeScale
      : (cfg.sizeScale !== undefined ? cfg.sizeScale : 0.95);
    var trailSize = size * sizeScale;
    var headSizeScale = this._trailHeadSizeScale !== null && this._trailHeadSizeScale !== undefined
      ? this._trailHeadSizeScale
      : (cfg.headSizeScale !== undefined ? cfg.headSizeScale : 0.95);
    var tailSizeScale = this._trailTailSizeScale !== null && this._trailTailSizeScale !== undefined
      ? this._trailTailSizeScale
      : (cfg.tailSizeScale !== undefined ? cfg.tailSizeScale : 0.475);
    var headSkip = this._trailHeadSkipM !== null && this._trailHeadSkipM !== undefined
      ? this._trailHeadSkipM
      : (cfg.headSkipM !== undefined ? cfg.headSkipM : (size * 0.28));
    var spacing = this._getTrailParam('trailSpacingM', 0.02);
    var maxOp = cfg.maxOpacity !== undefined ? cfg.maxOpacity : 1.0;
    var nSec = this._sectionCount;
    var pv = this._profileVerts;
    var targetSpan = this._getTargetSpan(spacing, nSec);

    var meshSpan = targetSpan;
    var sectionCount = nSec;

    if (sampleOpts) {
      sectionCount = this._fillCurvePointsFollow(headSkip, spacing, nSec, sampleOpts);
      if (sectionCount < 2) {
        this._mesh.visible = false;
        return;
      }
      meshSpan = (sectionCount - 1) * spacing;
    } else if (this._deployActive) {
      meshSpan = this._fillCurvePointsDeploy(headSkip);
      if (meshSpan < 0.006) {
        this._mesh.visible = false;
        return;
      }
      sectionCount = nSec;
    } else {
      sectionCount = this._fillCurvePointsFollow(headSkip, spacing, nSec, null);
      if (sectionCount < 2) {
        this._mesh.visible = false;
        return;
      }
      meshSpan = (sectionCount - 1) * spacing;
    }

    var mat = this.el.getAttribute('material') || {};
    this._color = mat.color || '#888888';
    this._material.color.set(this._color);
    this._material.opacity = maxOp * trailVis * opacityMult;

    var positions = this._positions;
    var uvs = this._uvs;

    var posIdx = 0;
    var uvIdx = 0;
    for (var s = 0; s < sectionCount; s++) {
      var t = (sectionCount <= 1) ? 0 : s / (sectionCount - 1);
      var d = t * meshSpan;
      this._evalCatmullRomPoint(t, sectionCount, this._curveEvalPos);
      this._buildProfileFrame(t, sectionCount, this._profileRight, this._profileUp);
      var sizeT = (targetSpan > 1e-6) ? (d / targetSpan) : 0;
      if (sizeT > 1) sizeT = 1;
      var segSizeScale = headSizeScale + sizeT * (tailSizeScale - headSizeScale);
      var half = trailSize * segSizeScale * 0.5;
      var v = this._alongTrailAlpha(d, meshSpan);

      for (var c = 0; c < pv; c++) {
        var off = this._profileOffset(c, pv, half);
        this._corner.set(this._curveEvalPos.x, this._curveEvalPos.y, this._curveEvalPos.z);
        this._corner.x += this._profileRight.x * off.x + this._profileUp.x * off.y;
        this._corner.y += this._profileRight.y * off.x + this._profileUp.y * off.y;
        this._corner.z += this._profileRight.z * off.x + this._profileUp.z * off.y;

        positions[posIdx++] = this._corner.x;
        positions[posIdx++] = this._corner.y;
        positions[posIdx++] = this._corner.z;

        uvs[uvIdx++] = c / pv;
        uvs[uvIdx++] = v;
      }
    }

    this._geometry.attributes.position.needsUpdate = true;
    this._geometry.attributes.uv.needsUpdate = true;
    this._geometry.setDrawRange(0, (sectionCount - 1) * pv * 6);
    this._mesh.visible = true;
  },

  remove: function () {
    if (this._geometry) this._geometry.dispose();
    if (this._material) this._material.dispose();
    if (this._fadeTexture) this._fadeTexture.dispose();
    if (this.trailRoot && this.trailRoot.parentNode) {
      this.trailRoot.parentNode.removeChild(this.trailRoot);
    }
  },
});
