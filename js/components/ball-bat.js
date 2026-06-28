/* global AFRAME, CONFIG, THREE */

/**
 * ball-bat — бита-сковородка (Этап 7).
 *
 * Float вне купола / gravity внутри (как floating-cube). Слой BAT.
 * В руке — dynamic + D6 joint; gravity off при захвате.
 */
AFRAME.registerComponent('ball-bat', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.bat) || {};
    this.domeCfg = (typeof CONFIG !== 'undefined' && CONFIG.dome) || {};
    this.floatCfg = this.cfg.float || {};
    this.state = 'float';
    this._physicsApplied = false;
    this._grabbed = false;
    this._handEl = null;
    this._prevHandPos = new THREE.Vector3();
    this._handVel = new THREE.Vector3();
    this._lastHandSampleMs = 0;
    this._worldPos = new THREE.Vector3();
    this._lastAppliedTimeScale = 1.0;
    this._tickDeltaSec = 1 / 60;
    this._physxGravityOffForSloMo = false;
    this._driftDir = null;

    this._onContactBegin = this._onContactBegin.bind(this);
    var onReady = this._tryApply.bind(this);
    this.el.addEventListener('body-loaded', onReady);
    this.el.addEventListener('physx-body-loaded', onReady);
    this._pollIntervalId = setInterval(this._tryApply.bind(this), 100);
  },

  play: function () {
    this.el.addEventListener('contactbegin', this._onContactBegin);
  },

  pause: function () {
    this.el.removeEventListener('contactbegin', this._onContactBegin);
  },

  remove: function () {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
    this.el.removeEventListener('contactbegin', this._onContactBegin);
    if (this._grabbed) this.detachFromHand();
  },

  _getPhysX: function () {
    return this.el.sceneEl.systems.physx && this.el.sceneEl.systems.physx.PhysX;
  },

  _getTimeScale: function () {
    var sys = this.el.sceneEl.systems['time-scale'];
    if (!sys || typeof sys.getScale !== 'function') return 1;
    return sys.getScale();
  },

  _useTimeScale: function () {
    var g = this.domeCfg.gravityMode || {};
    return g.useTimeScale !== false;
  },

  _tryApply: function () {
    if (this._physicsApplied) return;
    var bodyComp = this.el.components['physx-body'];
    var rb = bodyComp && bodyComp.rigidBody;
    if (!rb) return;

    this._rb = rb;
    this._applyBatCollisionLayer();
    this._enterFloatMode(true);
    this._physicsApplied = true;

    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  _getWorldPosition: function () {
    this.el.object3D.getWorldPosition(this._worldPos);
    return this._worldPos;
  },

  _isInsideDome: function (pos, forRelease) {
    var dome = this.domeCfg;
    var halfExt = this.cfg.containmentRadius !== undefined ? this.cfg.containmentRadius : 0.22;
    var R = dome.radius !== undefined ? dome.radius : 0.27;
    var wallBottomY = dome.cylinderBottomY !== undefined ? dome.cylinderBottomY : 1.0;
    var wallTopY = dome.cylinderTopY !== undefined ? dome.cylinderTopY : 1.3;
    var eps = 0.01;

    var useLenient = forRelease;
    if (forRelease && dome.releaseContainment === 'strict') {
      useLenient = false;
    }
    if (!forRelease && dome.releaseContainment === 'lenient') {
      useLenient = true;
    }

    var innerR = useLenient ? (R + halfExt) : (R - halfExt);
    if (innerR < 0.01) innerR = 0.01;

    var yOutsideBelow = wallBottomY - halfExt - eps;
    var x = pos.x;
    var y = pos.y;
    var z = pos.z;

    if (y < yOutsideBelow) return false;

    if (y <= wallTopY + eps) {
      return (x * x + z * z) <= innerR * innerR;
    }

    var dy = y - wallTopY;
    return (x * x + dy * dy + z * z) <= innerR * innerR;
  },

  _onContactBegin: function (evt) {
    if (this.state !== 'gravity' || this._grabbed) return;

    var otherEl = evt.detail.otherComponent && evt.detail.otherComponent.el;
    if (!otherEl || otherEl.id !== 'floor') return;

    this._returnToFloatFromFloor();
  },

  _returnToFloatFromFloor: function () {
    this._enterFloatMode(false);
    var rb = this._rb;
    if (!rb || typeof rb.setLinearVelocity !== 'function') return;

    var upSpeed = this.floatCfg.floorReturnSpeed !== undefined
      ? this.floatCfg.floorReturnSpeed : 0.18;
    try {
      rb.setLinearVelocity({ x: 0, y: upSpeed, z: 0 }, true);
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
      this._lastAppliedTimeScale = 1.0;
      this._driftDir = { x: 0, y: 1, z: 0 };
      this._applyTimeScaleToVelocity(rb);
    } catch (e) {
      console.warn('[ball-bat] floor return failed:', e.message);
    }
  },

  _enterGravityMode: function () {
    this.state = 'gravity';
    var rb = this._rb;
    if (!rb) return;
    this._lastAppliedTimeScale = 1.0;
    this._physxGravityOffForSloMo = false;

    var gCfg = this.domeCfg.gravityMode || {};
    var ld = gCfg.linearDamping !== undefined ? gCfg.linearDamping : 0.02;
    var ad = gCfg.angularDamping !== undefined ? gCfg.angularDamping : 0.04;
    var sysPX = this._getPhysX();

    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, false);
        if (typeof rb.wakeUp === 'function') rb.wakeUp();
      } catch (e) {
        console.warn('[ball-bat] gravity enable failed:', e.message);
      }
    }

    if (typeof rb.setLinearDamping === 'function') rb.setLinearDamping(ld);
    if (typeof rb.setAngularDamping === 'function') rb.setAngularDamping(ad);

    var sleepTh = gCfg.sleepThreshold !== undefined ? gCfg.sleepThreshold : 0.01;
    if (typeof rb.setSleepThreshold === 'function') {
      try { rb.setSleepThreshold(sleepTh); } catch (e) { /* ignore */ }
    }
  },

  _randomUnitVector: function () {
    var x; var y; var z; var len2;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len2 = x * x + y * y + z * z;
    } while (len2 > 1 || len2 < 1e-6);
    var inv = 1 / Math.sqrt(len2);
    return { x: x * inv, y: y * inv, z: z * inv };
  },

  _enterFloatMode: function (applyImpulse) {
    if (applyImpulse === undefined) applyImpulse = false;
    this.state = 'float';
    var rb = this._rb;
    if (!rb) return;

    this._physxGravityOffForSloMo = false;
    var fc = this.floatCfg;
    var ld = fc.linearDamping !== undefined ? fc.linearDamping : 0.03;
    var ad = fc.angularDamping !== undefined ? fc.angularDamping : 0.05;
    var sysPX = this._getPhysX();

    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, true);
        if (typeof rb.wakeUp === 'function') rb.wakeUp();
      } catch (e) {
        console.warn('[ball-bat] float gravity off failed:', e.message);
      }
    }

    if (typeof rb.setLinearDamping === 'function') rb.setLinearDamping(ld);
    if (typeof rb.setAngularDamping === 'function') rb.setAngularDamping(ad);
    if (typeof rb.setSleepThreshold === 'function') {
      try { rb.setSleepThreshold(0); } catch (e) { /* ignore */ }
    }

    if (applyImpulse && typeof rb.setLinearVelocity === 'function') {
      var speed = fc.initialImpulseSpeed !== undefined ? fc.initialImpulseSpeed : 0.12;
      if (speed > 0) {
        var dir = this._randomUnitVector();
        this._driftDir = { x: dir.x, y: dir.y, z: dir.z };
        try {
          rb.setLinearVelocity({
            x: dir.x * speed, y: dir.y * speed, z: dir.z * speed,
          }, true);
        } catch (e) { /* ignore */ }
      }
      var angSpeed = fc.initialAngularSpeed !== undefined ? fc.initialAngularSpeed : 0.35;
      if (angSpeed > 0 && typeof rb.setAngularVelocity === 'function') {
        var axis = this._randomUnitVector();
        try {
          rb.setAngularVelocity({
            x: axis.x * angSpeed, y: axis.y * angSpeed, z: axis.z * angSpeed,
          }, true);
        } catch (e) { /* ignore */ }
      }
      this._lastAppliedTimeScale = 1.0;
      this._applyTimeScaleToVelocity(rb);
    }
  },

  _applyGrabbedPhysics: function (rb) {
    var sysPX = this._getPhysX();
    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, true);
      } catch (e) { /* ignore */ }
    }
  },

  _applyBatCollisionLayer: function () {
    var body = this.el.components['physx-body'];
    if (!body || !body.shapes) return;
    var PX = this._getPhysX();
    if (!PX || !PX.PxFilterData) return;

    var L = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var bit = function (i) { return (1 << i) >>> 0; };

    var newWord0 = bit(L.BAT);
    var newWord1 = bit(L.WORLD) | bit(L.FLOAT_CUBE) | bit(L.GRAVITY_CUBE) |
                   bit(L.GRABBED_CUBE) | bit(L.BALL);

    var shapes = Array.isArray(body.shapes) ? body.shapes : [body.shapes];
    for (var i = 0; i < shapes.length; i++) {
      var s = shapes[i];
      if (!s || !s.setSimulationFilterData) continue;
      s.setSimulationFilterData(new PX.PxFilterData(newWord0, newWord1, 0, 0));
    }
  },

  _maintainFloatDrift: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var fc = this.floatCfg;
    var minLin = fc.minDriftSpeed !== undefined ? fc.minDriftSpeed : 0.1;
    var minAng = fc.minAngularDriftSpeed !== undefined ? fc.minAngularDriftSpeed : 0.3;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (lv && typeof rb.setLinearVelocity === 'function') {
        var fx = lv.x * invPrev;
        var fy = lv.y * invPrev;
        var fz = lv.z * invPrev;
        var speed = Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (speed < minLin) {
          if (speed > 1e-4) {
            var sc = minLin / speed;
            fx *= sc; fy *= sc; fz *= sc;
          } else {
            var dir = this._driftDir || this._randomUnitVector();
            fx = dir.x * minLin; fy = dir.y * minLin; fz = dir.z * minLin;
          }
          rb.setLinearVelocity({ x: fx, y: fy, z: fz }, false);
          this._lastAppliedTimeScale = 1.0;
        }
      }
    } catch (e) {
      if (!this._driftWarned) {
        console.warn('[ball-bat] drift maintain failed:', e.message);
        this._driftWarned = true;
      }
    }
  },

  _applyTimeScaleToVelocity: function (rb) {
    var ts = this._getTimeScale();
    if (ts >= 0.999) {
      this._lastAppliedTimeScale = 1.0;
      return;
    }
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (lv && typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({
          x: lv.x * invPrev * ts,
          y: lv.y * invPrev * ts,
          z: lv.z * invPrev * ts,
        }, false);
      }
      if (typeof rb.getAngularVelocity === 'function' && typeof rb.setAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av) {
          rb.setAngularVelocity({
            x: av.x * invPrev * ts,
            y: av.y * invPrev * ts,
            z: av.z * invPrev * ts,
          }, false);
        }
      }
      this._lastAppliedTimeScale = ts;
    } catch (e) {
      if (!this._tsWarned) {
        console.warn('[ball-bat] timeScale failed:', e.message);
        this._tsWarned = true;
      }
    }
  },

  _syncPhysXGravityFlag: function (rb, physxGravityOn) {
    var sysPX = this._getPhysX();
    var flag = sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY;
    if (!flag || typeof rb.setActorFlag !== 'function') return;

    var disable = !physxGravityOn;
    if (this._physxGravityOffForSloMo === disable) return;

    try {
      rb.setActorFlag(flag, disable);
      this._physxGravityOffForSloMo = disable;
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    } catch (e) { /* ignore */ }
  },

  _integrateScaledGravity: function (rb, ts) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var gCfg = this.domeCfg.gravityMode || {};
    var gY = gCfg.sceneGravityY !== undefined ? gCfg.sceneGravityY : -9.8;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (!lv || typeof rb.setLinearVelocity !== 'function') return;
      var worldVy = lv.y * invPrev + gY * ts * this._tickDeltaSec;
      rb.setLinearVelocity({ x: lv.x, y: worldVy * prev, z: lv.z }, false);
    } catch (e) { /* ignore */ }
  },

  _tickGravityWithTimeScale: function (rb) {
    var ts = this._getTimeScale();
    this._syncPhysXGravityFlag(rb, ts >= 0.999);
    if (ts < 0.999) {
      this._integrateScaledGravity(rb, ts);
    }
    this._applyTimeScaleToVelocity(rb);
  },

  onGrabAcquired: function () {
    this._grabbed = true;
    if (this._rb) this._applyGrabbedPhysics(this._rb);
  },

  attachToHand: function (handEl) {
    if (!handEl || !handEl.object3D) return;
    this._handEl = handEl;
    this._handVel.set(0, 0, 0);
    this._lastHandSampleMs = performance.now();
    handEl.object3D.getWorldPosition(this._prevHandPos);
  },

  detachFromHand: function () {
    if (!this._grabbed && !this._handEl) return;

    this._handEl = null;

    var rb = this._rb;
    if (rb) {
      var throwMult = this.cfg.throwVelocityScale !== undefined
        ? this.cfg.throwVelocityScale : 1.15;
      if (typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({
          x: this._handVel.x * throwMult,
          y: this._handVel.y * throwMult,
          z: this._handVel.z * throwMult,
        }, false);
      }
      this._lastAppliedTimeScale = 1.0;
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    }
  },

  onGrabReleased: function () {
    this._grabbed = false;
    this._lastAppliedTimeScale = 1.0;

    var pos = this._getWorldPosition();
    if (this._isInsideDome(pos, true)) {
      this._enterGravityMode();
    } else {
      this._enterFloatMode(false);
    }
  },

  tick: function (time, timeDelta) {
    this._tickDeltaSec = Math.min((timeDelta || 16) / 1000, 0.1);

    if (this._grabbed && this._handEl) {
      var now = performance.now();
      var handPos = new THREE.Vector3();
      this._handEl.object3D.getWorldPosition(handPos);
      var dt = (now - this._lastHandSampleMs) / 1000;
      if (dt > 1e-4 && dt < 0.2) {
        this._handVel.set(
          (handPos.x - this._prevHandPos.x) / dt,
          (handPos.y - this._prevHandPos.y) / dt,
          (handPos.z - this._prevHandPos.z) / dt
        );
      }
      this._prevHandPos.copy(handPos);
      this._lastHandSampleMs = now;
      if (this._rb && typeof this._rb.wakeUp === 'function') {
        this._rb.wakeUp();
      }
      return;
    }

    var rb = this._rb;
    if (!rb) return;

    if (this.state === 'gravity') {
      if (this._useTimeScale()) {
        this._tickGravityWithTimeScale(rb);
      }
      return;
    }

    if (typeof rb.isSleeping === 'function' && rb.isSleeping()) {
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    }
    this._maintainFloatDrift(rb);
    this._applyTimeScaleToVelocity(rb);
  },

  resetToSpawn: function () {
    if (this._grabbed) {
      this.detachFromHand();
      this._grabbed = false;
    }
    var cfg = this.cfg;
    var p = cfg.spawnPosition || { x: -0.55, y: 0.55, z: 0.15 };
    var r = cfg.spawnRotation || { x: 15, y: 40, z: 0 };
    this.el.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
    this.el.setAttribute('rotation', r.x + ' ' + r.y + ' ' + r.z);

    var rb = this._rb;
    if (rb) {
      if (typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({ x: 0, y: 0, z: 0 }, false);
      }
      if (typeof rb.setAngularVelocity === 'function') {
        rb.setAngularVelocity({ x: 0, y: 0, z: 0 }, false);
      }
      this._applyBatCollisionLayer();
      this._enterFloatMode(true);
    }
    this._handEl = null;
  },
});
