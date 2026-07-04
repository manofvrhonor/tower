/* global AFRAME, CONFIG, THREE */



/**

 * part-entity — vis GLB + _COL GLB для детали сборки (Фаза 3.5B.1).

 *

 * Корень: physx-body БЕЗ geometry. vis — physx-no-collision; col — невидим,

 * physx-hidden-collision (wireframe ON через collider-debug-viz).

 *

 * 3.5B.3: setVisualState — floating / snapped / snapped_active / broken

 * (ghost — только assembly-core). Снеп → part-snap-energy (cyan разряды).

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

    this._visRoot = null;

    this._visMaterials = [];

    this._visualState = 'floating';

    this._brokenTimer = null;

    this.loader = new THREE.GLTFLoader();

    this.loader.setCrossOrigin('anonymous');

    this._onMechanismComplete = this._onMechanismComplete.bind(this);

  },



  play: function () {

    this.el.sceneEl.addEventListener('mechanism-complete', this._onMechanismComplete);

    if (this._loadStarted) return;

    this._loadStarted = true;

    this._loadModels();

  },



  pause: function () {

    if (this.el.sceneEl) {

      this.el.sceneEl.removeEventListener('mechanism-complete', this._onMechanismComplete);

    }

    this._clearBrokenTimer();

  },



  remove: function () {

    this._clearBrokenTimer();

    this._setEnergyMode('off');

  },



  _readVisualCfg: function (state) {

    var az = (typeof CONFIG !== 'undefined' && CONFIG.assemblyZone) || {};

    var pv = az.partVisual || {};

    return pv[state] || {};

  },



  _onMechanismComplete: function () {

    if (this._visualState === 'snapped') {

      this.setVisualState('snapped_active');

    }

  },



  _clearBrokenTimer: function () {

    if (!this._brokenTimer) return;

    clearTimeout(this._brokenTimer);

    this._brokenTimer = null;

  },



  _getEnergyComp: function () {

    if (!this.el.components['part-snap-energy']) {

      this.el.setAttribute('part-snap-energy', '');

    }

    return this.el.components['part-snap-energy'] || null;

  },



  _setEnergyMode: function (mode) {

    var energy = this._getEnergyComp();

    if (!energy) return;

    if (mode === 'off' || !this._visRoot) {

      energy.setMode('off');

      return;

    }

    energy.setMode(mode, this._visRoot);

  },



  /**

   * @param {string} state floating | snapped | snapped_active | broken

   */

  setVisualState: function (state) {

    if (state === 'ghost') return;

    this._visualState = state;

    this._clearBrokenTimer();

    this._applyVisualState(state);



    if (state === 'broken') {

      var dur = this._readVisualCfg('broken').durationMs;

      if (dur === undefined) dur = 450;

      var self = this;

      this._brokenTimer = setTimeout(function () {

        self._brokenTimer = null;

        self.setVisualState('floating');

      }, dur);

    }

  },



  getVisualState: function () {

    return this._visualState;

  },



  _prepareVisMaterials: function (root) {

    this._visRoot = root;

    this._visMaterials.length = 0;

    root.traverse(function (node) {

      if (!node.isMesh || !node.material) return;

      var src = node.material;

      if (Array.isArray(src)) {

        var cloned = [];

        for (var i = 0; i < src.length; i++) {

          cloned.push(src[i].clone());

          this._visMaterials.push(cloned[i]);

        }

        node.material = cloned;

      } else {

        var mat = src.clone();

        node.material = mat;

        this._visMaterials.push(mat);

      }

    }.bind(this));

  },



  _applyVisualState: function (state) {

    if (state === 'floating') {

      this._setEnergyMode('off');

    } else if (state === 'snapped' || state === 'snapped_active' || state === 'broken') {

      this._setEnergyMode(state);

    }



    if (!this._visMaterials.length) return;

    var cfg = this._readVisualCfg(state);

    var opacity = cfg.opacity !== undefined ? cfg.opacity : 1.0;



    if (state === 'floating' || state === 'broken') {

      for (var i = 0; i < this._visMaterials.length; i++) {

        var mat = this._visMaterials[i];

        mat.transparent = opacity < 0.999;

        mat.opacity = opacity;

        if (mat.emissive) mat.emissive.set('#000000');

        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;

        mat.needsUpdate = true;

      }

    }

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

        self._prepareVisMaterials(root);

        var visEl = document.createElement('a-entity');

        visEl.setAttribute('physx-no-collision', '');

        visEl.setObject3D('mesh', root);

        self.el.appendChild(visEl);

        self.setVisualState('floating');

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


