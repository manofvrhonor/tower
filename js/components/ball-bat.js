/* global AFRAME, CONFIG, THREE */

/**
 * ball-bat — бита-сковородка (Этап 7).
 *
 * Слой BAT — отдельно от GRABBED_CUBE (куб в руке). В руке и на столе
 * остаётся BAT → всегда сталкивается с пьедestalом (WORLD).
 * В руке — dynamic + D6 joint (physx-grab), не kinematic-телепорт.
 */
AFRAME.registerComponent('ball-bat', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.bat) || {};
    this._physicsApplied = false;
    this._grabbed = false;
    this._handEl = null;
    this._prevHandPos = new THREE.Vector3();
    this._handVel = new THREE.Vector3();
    this._lastHandSampleMs = 0;

    var onReady = this._tryApply.bind(this);
    this.el.addEventListener('body-loaded', onReady);
    this.el.addEventListener('physx-body-loaded', onReady);
    this._pollIntervalId = setInterval(this._tryApply.bind(this), 100);
  },

  remove: function () {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
    if (this._grabbed) this.detachFromHand();
  },

  _getPhysX: function () {
    return this.el.sceneEl.systems.physx && this.el.sceneEl.systems.physx.PhysX;
  },

  _tryApply: function () {
    if (this._physicsApplied) return;
    var bodyComp = this.el.components['physx-body'];
    var rb = bodyComp && bodyComp.rigidBody;
    if (!rb) return;

    this._rb = rb;
    this._applyRestPhysics(rb);
    this._applyBatCollisionLayer();
    this._physicsApplied = true;

    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  _setKinematic: function (kinematic) {
    var rb = this._rb;
    var sysPX = this._getPhysX();
    if (!rb || !sysPX || !sysPX.PxRigidBodyFlag) return;
    var flag = sysPX.PxRigidBodyFlag.eKINEMATIC;
    try {
      rb.setRigidBodyFlag(flag, kinematic);
      if (kinematic) {
        if (typeof rb.setLinearVelocity === 'function') {
          rb.setLinearVelocity({ x: 0, y: 0, z: 0 }, false);
        }
        if (typeof rb.setAngularVelocity === 'function') {
          rb.setAngularVelocity({ x: 0, y: 0, z: 0 }, false);
        }
      }
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    } catch (e) {
      if (!this._kinWarned) {
        console.warn('[ball-bat] kinematic flag failed:', e.message);
        this._kinWarned = true;
      }
    }
  },

  _applyRestPhysics: function (rb) {
    var cfg = this.cfg;
    var ld = cfg.linearDamping !== undefined ? cfg.linearDamping : 0.1;
    var ad = cfg.angularDamping !== undefined ? cfg.angularDamping : 0.15;
    var sysPX = this._getPhysX();

    this._setKinematic(false);

    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, false);
      } catch (e) {
        console.warn('[ball-bat] gravity enable failed:', e.message);
      }
    }

    if (typeof rb.setLinearDamping === 'function') rb.setLinearDamping(ld);
    if (typeof rb.setAngularDamping === 'function') rb.setAngularDamping(ad);
    if (typeof rb.wakeUp === 'function') rb.wakeUp();
  },

  _applyGrabbedPhysics: function (rb) {
    var sysPX = this._getPhysX();
    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, true);
      } catch (e) { /* ignore */ }
    }
  },

  /** Маска BAT: WORLD + кубы + шары; без DOME (как GRAVITY_CUBE на столе). */
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
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    }
  },

  onGrabReleased: function () {
    this._grabbed = false;
    if (this._rb) this._applyRestPhysics(this._rb);
  },

  tick: function (time) {
    if (!this._grabbed || !this._handEl) return;

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
  },

  resetToSpawn: function () {
    if (this._grabbed) {
      this.detachFromHand();
      this._grabbed = false;
    }
    var cfg = this.cfg;
    var p = cfg.spawnPosition || { x: 0.04, y: 1.015, z: 0.05 };
    var r = cfg.spawnRotation || { x: 0, y: -35, z: 0 };
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
      this._applyRestPhysics(rb);
    }
    this._handEl = null;
  },
});
