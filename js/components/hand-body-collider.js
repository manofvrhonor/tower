/**
 * hand-body-collider — compound kinematic collider на объём кулака (Фаза 3.5A).
 *
 * rotation из CONFIG запекается в position/size (PhysX convex не всегда
 * подхватывает rotation дочерних a-box). Захват — только #*HandCollider.
 */
AFRAME.registerComponent('hand-body-collider', {
  schema: {
    hand: { default: 'left', oneOf: ['left', 'right'] },
  },

  init: function () {
    this._parts = [];
    this._physxReady = false;
    this._vec = new THREE.Vector3();
    this._min = new THREE.Vector3();
    this._max = new THREE.Vector3();
    this._createParts();
  },

  play: function () {
    this._ensurePhysxBody();
  },

  /**
   * Поворот part.rotation → новый центр + axis-aligned size (видно в wireframe и PhysX).
   */
  _bakePart: function (part) {
    var pos = part.position || { x: 0, y: 0, z: 0 };
    var rot = part.rotation || { x: 0, y: 0, z: 0 };
    var size = part.size || { x: 0.05, y: 0.05, z: 0.05 };
    var euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rot.x),
      THREE.MathUtils.degToRad(rot.y),
      THREE.MathUtils.degToRad(rot.z),
      'XYZ'
    );
    var quat = new THREE.Quaternion().setFromEuler(euler);
    var hx = size.x * 0.5;
    var hy = size.y * 0.5;
    var hz = size.z * 0.5;
    var origin = new THREE.Vector3(pos.x, pos.y, pos.z);
    var corners = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz],
      [-hx, -hy, hz], [hx, -hy, hz], [-hx, hy, hz], [hx, hy, hz],
    ];
    var i;

    this._min.set(Infinity, Infinity, Infinity);
    this._max.set(-Infinity, -Infinity, -Infinity);

    for (i = 0; i < corners.length; i++) {
      this._vec.set(corners[i][0], corners[i][1], corners[i][2]).add(origin);
      this._vec.applyQuaternion(quat);
      this._min.min(this._vec);
      this._max.max(this._vec);
    }

    this._vec.addVectors(this._min, this._max).multiplyScalar(0.5);

    return {
      position: { x: this._vec.x, y: this._vec.y, z: this._vec.z },
      size: {
        x: this._max.x - this._min.x,
        y: this._max.y - this._min.y,
        z: this._max.z - this._min.z,
      },
    };
  },

  _createParts: function () {
    var handsCfg = (typeof CONFIG !== 'undefined' && CONFIG.player && CONFIG.player.hands) || {};
    var handCfg = handsCfg[this.data.hand] || {};
    var shared = handsCfg.bodyCollider || {};
    var parts = handCfg.bodyParts || shared.parts || [];
    var i;
    var part;
    var baked;
    var box;

    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      baked = this._bakePart(part);

      box = document.createElement('a-box');
      box.setAttribute('position', baked.position.x + ' ' + baked.position.y + ' ' + baked.position.z);
      box.setAttribute('width', baked.size.x);
      box.setAttribute('height', baked.size.y);
      box.setAttribute('depth', baked.size.z);
      box.setAttribute('visible', false);
      box.setAttribute('physx-hidden-collision', '');
      box.setAttribute('data-physx-hidden-collider', '');
      this.el.appendChild(box);
      this._parts.push(box);
    }
  },

  _ensurePhysxBody: function () {
    var self = this;
    var pending;
    var i;
    var box;

    if (this._physxReady || !this._parts.length) {
      return;
    }

    pending = this._parts.length;
    var onPartReady = function () {
      pending -= 1;
      if (pending > 0) {
        return;
      }
      requestAnimationFrame(function () {
        self.el.object3D.updateMatrixWorld(true);
        self._attachPhysxBody(self._materialString());
      });
    };

    for (i = 0; i < this._parts.length; i++) {
      box = this._parts[i];
      if (box.hasLoaded) {
        onPartReady();
      } else {
        box.addEventListener('loaded', onPartReady);
      }
    }
  },

  _materialString: function () {
    var layers = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      FLOAT_CUBE: 2, GRAVITY_CUBE: 3, GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var collidesWith = [
      layers.FLOAT_CUBE,
      layers.GRAVITY_CUBE,
      layers.GRABBED_CUBE,
      layers.BALL,
      layers.BAT,
    ].join(', ');
    return 'collisionLayers: ' + layers.HAND + '; collidesWithLayers: ' + collidesWith;
  },

  _attachPhysxBody: function (matStr) {
    var self = this;
    var tries = 0;

    if (this._physxReady) {
      return;
    }
    this._physxReady = true;

    this.el.setAttribute('physx-material', matStr);
    this.el.setAttribute('physx-body', 'type: kinematic');

    function rebuildWhenReady() {
      var bodyComp = self.el.components['physx-body'];
      if (bodyComp && bodyComp.rigidBody) {
        self.el.object3D.updateMatrixWorld(true);
        self.el.emit('object3dset');
        if (typeof window.applyColliderDebugVisual === 'function') {
          window.applyColliderDebugVisual();
        }
        return;
      }
      tries += 1;
      if (tries < 30) {
        setTimeout(rebuildWhenReady, 100);
      }
    }
    rebuildWhenReady();
  },

  remove: function () {
    var i;
    for (i = 0; i < this._parts.length; i++) {
      if (this._parts[i].parentNode) {
        this._parts[i].parentNode.removeChild(this._parts[i]);
      }
    }
    this._parts.length = 0;
    this._physxReady = false;
  },
});
