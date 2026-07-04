/* global AFRAME, CONFIG, THREE */

/**
 * part-entity — vis GLB + _COL GLB для детали сборки (Фаза 3.5B.1).
 *
 * Корень: physx-body БЕЗ geometry. vis — physx-no-collision; col — невидим,
 * physx-hidden-collision (wireframe ON через collider-debug-viz).
 */
AFRAME.registerComponent('part-entity', {
  schema: {
    partId: { type: 'string', default: '' },
    model: { type: 'string', default: '' },
    colliderModel: { type: 'string', default: '' },
    mass: { type: 'number', default: 1 },
  },

  init: function () {
    this._physxAttached = false;
    this._loadStarted = false;
    this.loader = new THREE.GLTFLoader();
    this.loader.setCrossOrigin('anonymous');
  },

  play: function () {
    if (this._loadStarted) return;
    this._loadStarted = true;
    this._loadModels();
  },

  _loadModels: function () {
    var self = this;
    var visUrl = this.data.model;
    var colUrl = this.data.colliderModel;

    if (visUrl) {
      this.loader.load(visUrl, function (gltf) {
        var root = gltf.scene || gltf.scenes[0];
        if (!root) return;
        root.traverse(function (node) {
          if (node.isMesh) node.frustumCulled = false;
        });
        var visEl = document.createElement('a-entity');
        visEl.setAttribute('physx-no-collision', '');
        visEl.setObject3D('mesh', root);
        self.el.appendChild(visEl);
      }, undefined, function (err) {
        console.error('[part-entity] vis load failed:', self.data.partId, err);
      });
    }

    if (!colUrl) {
      console.warn('[part-entity] no colliderModel:', this.data.partId);
      return;
    }

    this.loader.load(colUrl, function () {
      self._onColLoaded.apply(self, arguments);
    }, undefined, function (err) {
      console.error('[part-entity] COL load failed:', self.data.partId, err);
    });
  },

  _onColLoaded: function (gltf) {
    var colRoot = document.createElement('a-entity');
    colRoot.setAttribute('visible', false);
    colRoot.setAttribute('physx-hidden-collision', '');
    colRoot.setAttribute('data-physx-hidden-collider', '');

    var mesh = gltf.scene || gltf.scenes[0];
    if (mesh) {
      mesh.traverse(function (node) {
        if (node.isMesh) node.frustumCulled = false;
      });
      colRoot.setObject3D('mesh', mesh);
    }
    this.el.appendChild(colRoot);

    if (this._physxAttached) return;
    this._attachPhysxBody();
  },

  _attachPhysxBody: function () {
    var self = this;
    this._physxAttached = true;
    var mass = this.data.mass;

    this.el.setAttribute('physx-body',
      'type: dynamic; mass: ' + mass + '; emitCollisionEvents: true');

    var tries = 0;
    function rebuildWhenReady() {
      var bodyComp = self.el.components['physx-body'];
      if (bodyComp && bodyComp.rigidBody) {
        self.el.object3D.updateMatrixWorld(true);
        self.el.emit('object3dset');
        if (typeof window.applyColliderDebugVisual === 'function') {
          window.applyColliderDebugVisual(self.el);
        }
        console.log('[part-entity] physx ready:', self.data.partId);
        return;
      }
      tries += 1;
      if (tries < 50) {
        setTimeout(rebuildWhenReady, 100);
      }
    }
    rebuildWhenReady();
  },
});
