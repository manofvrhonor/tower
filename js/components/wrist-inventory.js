/* global AFRAME, CONFIG, THREE */

/**
 * wrist-inventory — 2 слота на #leftHand (Фаза 4, HL:Alyx).
 *
 * Store: grip/trigger up, только если удерживаемая деталь **внутри** цилиндра-кармана.
 *   (белые лучи-притяжение — только от ближайшего кармана в зоне rayRadius).
 * Retrieve: grip/trigger down правой рукой у занятого кармана на левом запястье.
 */
AFRAME.registerComponent('wrist-inventory', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.wristInventory) || {};
    this._slotCount = this.cfg.slotCount || 2;
    this._slots = [];
    this._slotEls = [];
    this._slotSphereEls = [];
    this._slotRays = [];
    this._rayTarget = { slotIdx: -1, partEl: null };
    this._handPos = new THREE.Vector3();
    this._partPos = new THREE.Vector3();
    this._slotPos = new THREE.Vector3();
    this._rayEndLocal = new THREE.Vector3();
    this._handsBound = false;

    this._onHandRelease = this._onHandRelease.bind(this);
    this._onRightPress = this._onRightPress.bind(this);
    this._onReset = this._onReset.bind(this);

    this.el.sceneEl.addEventListener('game-started', this._onReset);
    this.el.sceneEl.addEventListener('return-to-menu', this._onReset);

    this._buildSlotAnchors();
    var i;
    for (i = 0; i < this._slotCount; i++) this._slots.push(null);
  },

  play: function () {
    this._bindHandListeners();
  },

  pause: function () {
    this._unbindHandListeners();
  },

  remove: function () {
    this._unbindHandListeners();
    this.el.sceneEl.removeEventListener('game-started', this._onReset);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReset);
    this._clearSlotRefs();
    this._disposeSlotVisuals();
  },

  tick: function () {
    this._refreshRayTarget();
    var i;
    for (i = 0; i < this._slots.length; i++) {
      this._syncStoredPart(i);
      this._updateSlotRays(i);
      this._updateSlotVisual(i);
    }
  },

  _bindHandListeners: function () {
    if (this._handsBound) return;
    this._handsBound = true;
    var storeIds = ['leftHand', 'rightHand'];
    var si;
    for (si = 0; si < storeIds.length; si++) {
      var storeHand = document.getElementById(storeIds[si]);
      if (!storeHand) continue;
      storeHand.addEventListener('gripup', this._onHandRelease, true);
      storeHand.addEventListener('triggerup', this._onHandRelease, true);
    }
    var right = document.getElementById('rightHand');
    if (right) {
      right.addEventListener('gripdown', this._onRightPress, true);
      right.addEventListener('triggerdown', this._onRightPress, true);
    }
  },

  _unbindHandListeners: function () {
    if (!this._handsBound) return;
    this._handsBound = false;
    var storeIds = ['leftHand', 'rightHand'];
    var si;
    for (si = 0; si < storeIds.length; si++) {
      var storeHand = document.getElementById(storeIds[si]);
      if (!storeHand) continue;
      storeHand.removeEventListener('gripup', this._onHandRelease, true);
      storeHand.removeEventListener('triggerup', this._onHandRelease, true);
    }
    var right = document.getElementById('rightHand');
    if (right) {
      right.removeEventListener('gripdown', this._onRightPress, true);
      right.removeEventListener('triggerdown', this._onRightPress, true);
    }
  },

  _readCfg: function () {
    var c = this.cfg || {};
    var vis = c.slotVisual || {};
    return {
      pocketRadius: c.pocketRadius !== undefined ? c.pocketRadius : 0.045,
      rayRadius: c.rayRadius !== undefined ? c.rayRadius : 0.16,
      retrieveRadius: c.retrieveRadius !== undefined ? c.retrieveRadius : 0.12,
      storedScale: c.storedScale !== undefined ? c.storedScale : 0.45,
      intensityIdle: vis.intensityIdle !== undefined ? vis.intensityIdle : 0.5,
      intensityNear: vis.intensityNear !== undefined ? vis.intensityNear : 0.82,
      intensityInside: vis.intensityInside !== undefined ? vis.intensityInside : 1.0,
      intensityOccupied: vis.intensityOccupied !== undefined ? vis.intensityOccupied : 0.88,
      intensityRetrieve: vis.intensityRetrieve !== undefined ? vis.intensityRetrieve : 1.05,
      occupiedPulseSpeed: vis.occupiedPulseSpeed !== undefined ? vis.occupiedPulseSpeed : 0.007,
      occupiedPulseAmp: vis.occupiedPulseAmp !== undefined ? vis.occupiedPulseAmp : 0.22,
      rayColor: vis.rayColor || '#f0f8ff',
      rayOpacity: vis.rayOpacity !== undefined ? vis.rayOpacity : 0.48,
      rayCount: vis.rayCount !== undefined ? vis.rayCount : 12,
    };
  },

  _buildSlotAnchors: function () {
    var defs = (this.cfg && this.cfg.slots) || [
      { position: { x: -0.055, y: -0.035, z: 0.055 } },
      { position: { x: 0.055, y: -0.035, z: 0.055 } },
    ];
    var cfg = this._readCfg();
    var i;
    for (i = 0; i < this._slotCount; i++) {
      var def = defs[i] || defs[0] || {};
      var pos = def.position || {};
      var slotEl = document.createElement('a-entity');
      slotEl.setAttribute('class', 'wrist-inventory-slot');
      slotEl.setAttribute('position',
        (pos.x || 0) + ' ' + (pos.y || 0) + ' ' + (pos.z || 0));
      this.el.appendChild(slotEl);
      this._slotEls.push(slotEl);

      var pocketEl = document.createElement('a-entity');
      pocketEl.setAttribute('assembly-sphere-visual', {
        preset: 'wrist',
        shape: 'cylinder',
        radius: cfg.pocketRadius,
      });
      slotEl.appendChild(pocketEl);
      this._slotSphereEls.push(pocketEl);

      this._slotRays.push(this._buildSlotRays(slotEl, cfg));
    }
  },

  _buildSlotRays: function (slotEl, cfg) {
    var rays = [];
    var count = Math.max(1, cfg.rayCount | 0);
    var ri;
    for (ri = 0; ri < count; ri++) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      var mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(cfg.rayColor),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      var line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.renderOrder = 7;
      line.visible = false;
      slotEl.object3D.add(line);
      rays.push(line);
    }
    return rays;
  },

  _disposeSlotVisuals: function () {
    var i;
    var ri;
    for (i = 0; i < this._slotRays.length; i++) {
      var rays = this._slotRays[i] || [];
      for (ri = 0; ri < rays.length; ri++) {
        if (rays[ri].geometry) rays[ri].geometry.dispose();
        if (rays[ri].material) rays[ri].material.dispose();
      }
    }
    this._slotSphereEls.length = 0;
    this._slotRays.length = 0;
  },

  _slotSphereComp: function (slotIdx) {
    var el = this._slotSphereEls[slotIdx];
    return el && el.components['assembly-sphere-visual'];
  },

  _cleanupPartJoints: function (partEl) {
    if (!partEl) return;
    var grabIds = ['leftHand', 'rightHand'];
    var gi;
    for (gi = 0; gi < grabIds.length; gi++) {
      var hand = document.getElementById(grabIds[gi]);
      var grab = hand && hand.components['physx-grab'];
      if (grab && grab.hitEl === partEl) {
        if (typeof grab.removeJoint === 'function') grab.removeJoint();
        grab.hitEl = null;
        grab.grabbing = false;
      }
    }
    var joints = partEl.querySelectorAll('[physx-joint]');
    var ji;
    for (ji = 0; ji < joints.length; ji++) {
      var jEl = joints[ji];
      if (jEl.parentNode) jEl.parentNode.removeChild(jEl);
    }
  },

  _partMass: function (partEl) {
    var pe = partEl && partEl.components['part-entity'];
    if (pe && pe.data && pe.data.mass !== undefined) return pe.data.mass;
    return 1;
  },

  _setPartBodyType: function (partEl, type) {
    if (!partEl) return;
    var mass = this._partMass(partEl);
    partEl.setAttribute('physx-body', {
      type: type,
      mass: mass,
      emitCollisionEvents: true,
    });
  },

  _rebuildPartPhysx: function (partEl, done) {
    if (!partEl || !partEl.object3D) {
      if (done) done();
      return;
    }
    var self = this;
    var step = 0;
    var run = function () {
      self._refreshPartPhysx(partEl);
      step += 1;
      if (step < 3) {
        requestAnimationFrame(run);
      } else if (done) {
        done();
      }
    };
    requestAnimationFrame(run);
  },

  _forcePocketEmpty: function (slotIdx) {
    var pocket = this._slotSphereComp(slotIdx);
    if (!pocket) return;
    if (typeof pocket.setColorScheme === 'function') pocket.setColorScheme('empty', true);
    if (typeof pocket.setIntensity === 'function') {
      pocket.setIntensity(this._readCfg().intensityIdle);
    }
  },

  _refreshPartPhysx: function (partEl) {
    if (!partEl || !partEl.object3D) return;
    partEl.object3D.updateMatrixWorld(true);
    partEl.emit('object3dset');
    var body = partEl.components['physx-body'];
    if (body && typeof body.resetBodyPose === 'function') {
      body.resetBodyPose();
    }
    if (body && body.rigidBody && typeof body.rigidBody.wakeUp === 'function') {
      body.rigidBody.wakeUp();
    }
  },

  _rightHandCollider: function () {
    return document.getElementById('rightHandCollider');
  },

  _rightGrabComp: function () {
    var right = document.getElementById('rightHand');
    return right && right.components['physx-grab'];
  },

  _getRightHandWorldPos: function (out) {
    var col = this._rightHandCollider();
    if (col && col.object3D) {
      col.object3D.updateMatrixWorld(true);
      return col.object3D.getWorldPosition(out);
    }
    var right = document.getElementById('rightHand');
    if (right && right.object3D) {
      right.object3D.updateMatrixWorld(true);
      return right.object3D.getWorldPosition(out);
    }
    return out.set(0, 0, 0);
  },

  _slotWorldPos: function (idx, out) {
    var slotEl = this._slotEls[idx];
    if (!slotEl || !slotEl.object3D) return out.set(0, 0, 0);
    slotEl.object3D.updateMatrixWorld(true);
    return slotEl.object3D.getWorldPosition(out);
  },

  _partDistanceToSlot: function (partEl, slotIdx) {
    if (!partEl || !partEl.object3D) return Infinity;
    partEl.object3D.getWorldPosition(this._partPos);
    this._slotWorldPos(slotIdx, this._slotPos);
    return this._partPos.distanceTo(this._slotPos);
  },

  _findStoreSlot: function (partEl) {
    if (!partEl || !partEl.object3D) return -1;
    var cfg = this._readCfg();
    var bestIdx = -1;
    var bestDist = cfg.pocketRadius;
    var i;
    for (i = 0; i < this._slots.length; i++) {
      if (this._slots[i]) continue;
      var d = this._partDistanceToSlot(partEl, i);
      if (d <= bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  },

  _findRetrieveSlot: function () {
    var cfg = this._readCfg();
    this._getRightHandWorldPos(this._handPos);
    var bestIdx = -1;
    var bestDist = cfg.retrieveRadius;
    var i;
    for (i = 0; i < this._slots.length; i++) {
      if (!this._slots[i]) continue;
      this._slotWorldPos(i, this._slotPos);
      var d = this._handPos.distanceTo(this._slotPos);
      if (d <= bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  },

  _getHeldPartFromHand: function (handId) {
    var hand = document.getElementById(handId);
    var grab = hand && hand.components['physx-grab'];
    if (!grab || !grab.grabbing || !grab.hitEl) return null;
    return grab.hitEl;
  },

  /** Одна пара лучей: ближайший пустой карман ↔ удерживаемая деталь. */
  _refreshRayTarget: function () {
    var cfg = this._readCfg();
    var best = { slotIdx: -1, partEl: null, dist: Infinity };
    var handIds = ['leftHand', 'rightHand'];
    var hi;
    var si;

    for (hi = 0; hi < handIds.length; hi++) {
      var partEl = this._getHeldPartFromHand(handIds[hi]);
      if (!partEl || !this._canStore(partEl)) continue;

      for (si = 0; si < this._slots.length; si++) {
        if (this._slots[si]) continue;
        var d = this._partDistanceToSlot(partEl, si);
        if (d <= cfg.rayRadius && d < best.dist) {
          best.slotIdx = si;
          best.partEl = partEl;
          best.dist = d;
        }
      }
    }

    this._rayTarget.slotIdx = best.slotIdx;
    this._rayTarget.partEl = best.partEl;
  },

  _findRayTargetPart: function (slotIdx) {
    if (this._rayTarget.slotIdx !== slotIdx) return null;
    return this._rayTarget.partEl;
  },

  _canStore: function (partEl) {
    if (!partEl || !partEl.dataset) return false;
    if (partEl.dataset.inWristInventory === 'true') return false;
    if (partEl.dataset.fixed === 'true') return false;
    if (partEl.components['ball-bat'] || partEl.components['red-ball']) return false;
    var fc = partEl.components['floating-cube'];
    if (!fc) return false;
    if (fc.state === 'snapped' || fc.state === 'wrist-stored') return false;
    return true;
  },

  _onHandRelease: function (evt) {
    var handEl = evt.currentTarget;
    var grab = handEl && handEl.components['physx-grab'];
    var partEl = grab && grab.hitEl;
    if (!partEl || !this._canStore(partEl)) return;

    var slotIdx = this._findStoreSlot(partEl);
    if (slotIdx < 0) return;

    partEl.dataset.wristStorePending = 'true';
    var self = this;
    requestAnimationFrame(function () {
      delete partEl.dataset.wristStorePending;
      self._storeInSlot(slotIdx, partEl);
    });
  },

  _onRightPress: function () {
    var grab = this._rightGrabComp();
    if (grab && grab.hitEl) return;

    var slotIdx = this._findRetrieveSlot();
    if (slotIdx < 0) return;

    this._retrieveFromSlot(slotIdx);
  },

  _storeInSlot: function (slotIdx, partEl) {
    if (this._slots[slotIdx] || !partEl || !partEl.isConnected) return;

    this._cleanupPartJoints(partEl);

    if (partEl.is && partEl.is('grabbed-dynamic')) {
      partEl.removeState('grabbed-dynamic');
    }

    this._slots[slotIdx] = partEl;
    partEl.dataset.inWristInventory = 'true';
    partEl.dataset.wristSlot = String(slotIdx);

    var fc = partEl.components['floating-cube'];
    if (fc) {
      fc.state = 'wrist-stored';
      fc._setPartVisual('wrist-stored');
    }

    var scale = this._readCfg().storedScale;
    partEl.object3D.scale.set(scale, scale, scale);
    this._setPartBodyType(partEl, 'kinematic');
    if (fc && typeof fc._forceKinematicFlag === 'function') fc._forceKinematicFlag();
    this._rebuildPartPhysx(partEl);
    this._syncStoredPart(slotIdx);
    this._refreshRayTarget();
    this._updateSlotRays(slotIdx);
    this._updateSlotVisual(slotIdx);

    console.log('[wrist-inventory] stored', partEl.id || '(no id)', '→ slot', slotIdx);
    this.el.sceneEl.emit('wrist-stored', {
      slotIndex: slotIdx,
      partId: partEl.dataset.partId || partEl.id,
    }, false);
  },

  _retrieveFromSlot: function (slotIdx) {
    var partEl = this._slots[slotIdx];
    if (!partEl || !partEl.isConnected) {
      this._slots[slotIdx] = null;
      return;
    }

    this._slots[slotIdx] = null;
    delete partEl.dataset.inWristInventory;
    delete partEl.dataset.wristSlot;
    this._cleanupPartJoints(partEl);
    partEl.object3D.scale.set(1, 1, 1);

    var fc = partEl.components['floating-cube'];
    if (fc) {
      fc.state = 'float';
      fc._lastAppliedTimeScale = 1.0;
      fc._setPartVisual('floating');
      // ADR: без сброса setKinematic повторный store ломает collider (floating-cube.js).
      if (typeof fc._resetKinematicLatch === 'function') fc._resetKinematicLatch();
    }
    this._setPartBodyType(partEl, 'dynamic');

    var grab = this._rightGrabComp();
    var handCollider = this._rightHandCollider();
    var self = this;
    this._rebuildPartPhysx(partEl, function () {
      if (!partEl.isConnected) return;
      if (grab && handCollider) {
        grab.grabbing = true;
        partEl.addState(grab.GRABBED_STATE);
        grab.hitEl = partEl;
        grab.addJoint(partEl, handCollider, null);
      }
    });

    this._forcePocketEmpty(slotIdx);
    this._refreshRayTarget();
    this._updateSlotRays(slotIdx);
    console.log('[wrist-inventory] retrieved', partEl.id || '(no id)', '← slot', slotIdx);
    this.el.sceneEl.emit('wrist-retrieved', {
      slotIndex: slotIdx,
      partId: partEl.dataset.partId || partEl.id,
    }, false);
  },

  _syncStoredPart: function (slotIdx) {
    var partEl = this._slots[slotIdx];
    var slotEl = this._slotEls[slotIdx];
    if (!partEl || !partEl.isConnected || !slotEl) {
      if (partEl && !partEl.isConnected) this._slots[slotIdx] = null;
      return;
    }
    if (!partEl.object3D) return;

    slotEl.object3D.updateMatrixWorld(true);
    slotEl.object3D.getWorldPosition(this._slotPos);
    var slotQuat = slotEl.object3D.getWorldQuaternion(new THREE.Quaternion());

    partEl.object3D.position.copy(this._slotPos);
    partEl.object3D.quaternion.copy(slotQuat);
    partEl.object3D.updateMatrixWorld(true);

    var body = partEl.components['physx-body'];
    if (body && typeof body.resetBodyPose === 'function') {
      body.resetBodyPose();
    }
  },

  _updateSlotRays: function (slotIdx) {
    var rays = this._slotRays[slotIdx];
    if (!rays || !rays.length) return;

    var cfg = this._readCfg();
    var partEl = this._findRayTargetPart(slotIdx);
    if (!partEl) {
      var ri;
      for (ri = 0; ri < rays.length; ri++) {
        rays[ri].visible = false;
        rays[ri].material.opacity = 0;
      }
      return;
    }

    var dist = this._partDistanceToSlot(partEl, slotIdx);
    var inside = dist <= cfg.pocketRadius;
    var t = 1 - Math.min(dist / cfg.rayRadius, 1);
    var pulse = 0.72 + 0.28 * Math.sin(performance.now() * 0.008);
    var opacity = cfg.rayOpacity * (0.3 + t * 0.55) * pulse * (inside ? 1.1 : 1);

    var slotEl = this._slotEls[slotIdx];
    partEl.object3D.getWorldPosition(this._partPos);
    slotEl.object3D.worldToLocal(this._rayEndLocal.copy(this._partPos));

    var spread = cfg.pocketRadius * 0.42;
    var golden = 2.399963;
    var r;
    for (r = 0; r < rays.length; r++) {
      var line = rays[r];
      var ang = r * golden;
      var offX = Math.cos(ang) * spread;
      var offY = Math.sin(ang * 1.37) * spread * 0.65;
      var offZ = Math.sin(ang) * spread * 0.45;
      var posAttr = line.geometry.attributes.position;
      posAttr.setXYZ(0, offX, offY, offZ);
      posAttr.setXYZ(1, this._rayEndLocal.x, this._rayEndLocal.y, this._rayEndLocal.z);
      posAttr.needsUpdate = true;
      line.material.opacity = opacity * (0.55 - r * 0.028);
      line.visible = true;
    }
  },

  _updateSlotVisual: function (slotIdx) {
    var pocket = this._slotSphereComp(slotIdx);
    if (!pocket || typeof pocket.setIntensity !== 'function') return;
    var cfg = this._readCfg();
    var occupied = !!this._slots[slotIdx];

    if (occupied) {
      if (typeof pocket.setColorScheme === 'function') pocket.setColorScheme('occupied');
      var pulse = 1 + cfg.occupiedPulseAmp
        * Math.sin(performance.now() * cfg.occupiedPulseSpeed);
      var base = this._isRightHandNear(slotIdx)
        ? cfg.intensityRetrieve
        : cfg.intensityOccupied;
      pocket.setIntensity(base * pulse);
      return;
    }

    if (typeof pocket.setColorScheme === 'function') pocket.setColorScheme('empty', true);
    var intensity = cfg.intensityIdle;
    var target = this._findRayTargetPart(slotIdx);
    if (target) {
      var dist = this._partDistanceToSlot(target, slotIdx);
      intensity = dist <= cfg.pocketRadius
        ? cfg.intensityInside
        : cfg.intensityNear;
    }
    pocket.setIntensity(intensity);
  },

  _isRightHandNear: function (slotIdx) {
    var cfg = this._readCfg();
    this._slotWorldPos(slotIdx, this._slotPos);
    this._getRightHandWorldPos(this._handPos);
    return this._handPos.distanceTo(this._slotPos) <= cfg.retrieveRadius * 1.15;
  },

  _clearSlotRefs: function () {
    var i;
    for (i = 0; i < this._slots.length; i++) {
      var el = this._slots[i];
      if (el && el.isConnected) {
        delete el.dataset.inWristInventory;
        delete el.dataset.wristSlot;
        el.object3D.scale.set(1, 1, 1);
        var fc = el.components['floating-cube'];
        if (fc) {
          fc._setPartVisual('floating');
          if (typeof fc._resetKinematicLatch === 'function') fc._resetKinematicLatch();
        }
        this._setPartBodyType(el, 'dynamic');
        this._refreshPartPhysx(el);
      }
      this._forcePocketEmpty(i);
      this._slots[i] = null;
    }
  },

  _onReset: function () {
    this._clearSlotRefs();
  },

  getStoredCount: function () {
    var n = 0;
    var i;
    for (i = 0; i < this._slots.length; i++) {
      if (this._slots[i]) n++;
    }
    return n;
  },
});
