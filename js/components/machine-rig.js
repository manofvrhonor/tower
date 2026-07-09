/* global AFRAME, CONFIG, THREE */

/**
 * machine-rig — GLB-машина времени: корпус + два вращающихся кольца.
 *
 * Заменяет процедурную cyan-зону (orbit-ring). Вешается на #machine-rig.
 *   - machine.glb  — статичный корпус (на #machine-rig, без спина).
 *   - ring.glb     — на #machine-ring, крутится вокруг своей центральной оси.
 *   - ring_inner.glb — на #machine-ring-inner (ребёнок #machine-ring), крутится
 *     в случайном направлении по случайной оси (per session). Снеп-схема
 *     (#assembly-core), сфера-визуал и купол-коллайдер — дети ring_inner и
 *     вращаются вместе с ним.
 *   - machine_COL — static PhysX на корпусе.
 *     ring / ring_inner — kinematic сегменты (machine-ring-collider.js), не convex _COL.
 *
 * Ось/знак спина ring_inner выбираются заново на каждое 'game-started'.
 * В hardcore скорость ring_inner множится на difficulties.hardcore.ringInnerSpinMult.
 */
AFRAME.registerComponent('machine-rig', {
  schema: {},

  init: function () {
    this._cfg = ((typeof CONFIG !== 'undefined' && CONFIG.machine) || {}).rig || {};
    this._loader = new THREE.GLTFLoader();
    this._loader.setCrossOrigin('anonymous');

    this._ringEl = document.getElementById('machine-ring');
    this._ringInnerEl = document.getElementById('machine-ring-inner');

    this._ringSpinAxis = this._axisVec(this._cfg.ringSpinAxis || 'y');
    this._ringSpinDeg = this._cfg.ringSpinDeg || 0;

    this._innerBaseDeg = this._cfg.ringInnerSpinDeg || 0;
    this._innerSpinAxis = new THREE.Vector3(0, 1, 0);
    this._innerSpinDeg = this._innerBaseDeg;
    this._rollInnerSpin();

    this._initPhysxMaterial();

    this._onGameStarted = this._onGameStarted.bind(this);
    this._onTravelReady = this._onTravelReady.bind(this);
    this._onLocationChanged = this._onLocationChanged.bind(this);
    this._onTravelMenuClosed = this._onTravelMenuClosed.bind(this);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.addEventListener('travel-ready', this._onTravelReady);
    this.el.sceneEl.addEventListener('location-changed', this._onLocationChanged);
    this.el.sceneEl.addEventListener('travel-menu-closed', this._onTravelMenuClosed);

    this._loadVisual(this.el, this._cfg.machineModel);
    this._loadCollider(this.el, this._cfg.machineCollider);
    if (this._ringEl) {
      this._loadVisual(this._ringEl, this._cfg.ringModel);
    }
    if (this._ringInnerEl) {
      this._loadVisual(this._ringInnerEl, this._cfg.ringInnerModel);
    }
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    this.el.sceneEl.removeEventListener('travel-ready', this._onTravelReady);
    this.el.sceneEl.removeEventListener('location-changed', this._onLocationChanged);
    this.el.sceneEl.removeEventListener('travel-menu-closed', this._onTravelMenuClosed);
  },

  _initPhysxMaterial: function () {
    var bm = (typeof CONFIG !== 'undefined' && CONFIG.world && CONFIG.world.bounceMaterial) || {};
    var layers = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, FLOAT_CUBE: 2, GRAVITY_CUBE: 3, GRABBED_CUBE: 4, BALL: 5, BAT: 7, WAVE_BALL: 8,
    };
    this._physxMaterial =
      'restitution: ' + (bm.restitution !== undefined ? bm.restitution : 0.95) +
      '; staticFriction: ' + (bm.staticFriction !== undefined ? bm.staticFriction : 0.05) +
      '; dynamicFriction: ' + (bm.dynamicFriction !== undefined ? bm.dynamicFriction : 0.05);
    // Как pedestal-builder._layerTop: WORLD + WAVE_BALL (шары волны бьются о сборку).
    this._layerSuffix =
      '; collisionLayers: ' + layers.WORLD +
      '; collidesWithLayers: ' + [
        layers.FLOAT_CUBE,
        layers.GRAVITY_CUBE,
        layers.GRABBED_CUBE,
        layers.BALL,
        layers.BAT,
        layers.WAVE_BALL,
      ].join(', ');
  },

  _axisVec: function (letter) {
    var l = (letter || 'y').toLowerCase();
    if (l === 'x') return new THREE.Vector3(1, 0, 0);
    if (l === 'z') return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(0, 1, 0);
  },

  /** Случайная ось (x/y/z) + знак направления для ring_inner. */
  _rollInnerSpin: function () {
    var axes = ['x', 'y', 'z'];
    var letter = this._cfg.ringInnerRandomAxis
      ? axes[Math.floor(Math.random() * axes.length)]
      : 'y';
    this._innerSpinAxis = this._axisVec(letter);
    var sign = Math.random() < 0.5 ? -1 : 1;

    var mult = 1;
    var diffId = (typeof window.getGameDifficulty === 'function' && window.getGameDifficulty()) || '';
    var diff = (typeof CONFIG !== 'undefined' && CONFIG.game &&
      CONFIG.game.difficulties && CONFIG.game.difficulties[diffId]) || {};
    if (diff.ringInnerSpinMult) mult = diff.ringInnerSpinMult;

    this._innerSpinDeg = this._innerBaseDeg * mult * sign;
    this._spinBoost = 1;
    this._innerBoost = 1;
    console.log('[machine-rig] ring_inner spin:', letter.toUpperCase(),
      this._innerSpinDeg.toFixed(1), 'deg/s');
  },

  _onGameStarted: function () {
    this._rollInnerSpin();
    this._spinBoost = 1;
    this._innerBoost = 1;
  },

  _onTravelReady: function () {
    var t = (typeof CONFIG !== 'undefined' && CONFIG.travel) || {};
    this._spinBoost = t.ringSpinBoostMult || 5;
    this._innerBoost = t.ringInnerSpinBoostMult || this._spinBoost;
    console.log('[machine-rig] travel spin boost:', this._spinBoost + 'x');
  },

  _onTravelMenuClosed: function () {
    this._spinBoost = 1;
    this._innerBoost = 1;
  },

  _onLocationChanged: function (evt) {
    var d = evt.detail || {};
    if (d.reason === 'travel' || d.reason === 'reset') {
      this._spinBoost = 1;
      this._innerBoost = 1;
    }
  },

  _loadVisual: function (targetEl, url) {
    if (!targetEl || !url) return;
    this._loader.load(url, function (gltf) {
      var root = gltf.scene || gltf.scenes[0];
      if (!root) return;
      root.traverse(function (node) {
        if (node.isMesh) node.frustumCulled = false;
      });
      targetEl.setObject3D('mesh', root);
    }, undefined, function (err) {
      console.error('[machine-rig] GLB load failed:', url, err);
    });
  },

  /** Low-poly machine_COL.glb → static PhysX на #machine-rig. */
  _loadCollider: function (targetEl, url) {
    if (!targetEl || !url) return;
    var self = this;
    this._loader.load(url, function (gltf) {
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

      targetEl.appendChild(colRoot);
      self._attachStaticPhysx(targetEl, url);
    }, undefined, function (err) {
      console.error('[machine-rig] COL load failed:', url, err);
    });
  },

  _attachStaticPhysx: function (targetEl, url) {
    if (targetEl.dataset && targetEl.dataset.machinePhysxReady) return;
    if (targetEl.dataset) targetEl.dataset.machinePhysxReady = 'true';

    targetEl.setAttribute('physx-material', this._physxMaterial + this._layerSuffix);
    targetEl.setAttribute('physx-body', 'type: static');

    var tries = 0;
    function rebuildWhenReady() {
      var bodyComp = targetEl.components['physx-body'];
      if (bodyComp && bodyComp.rigidBody) {
        targetEl.object3D.updateMatrixWorld(true);
        targetEl.emit('object3dset');
        if (typeof window.applyColliderDebugVisual === 'function') {
          window.applyColliderDebugVisual(targetEl);
        }
        console.log('[machine-rig] physx static:', url);
        return;
      }
      tries += 1;
      if (tries < 50) setTimeout(rebuildWhenReady, 100);
    }
    rebuildWhenReady();
  },

  tick: function (time, timeDelta) {
    var dt = Math.min((timeDelta || 16) / 1000, 0.1);
    var ringBoost = this._spinBoost || 1;
    var innerBoost = this._innerBoost || 1;
    if (this._ringEl && this._ringSpinDeg) {
      var a = THREE.MathUtils.degToRad(this._ringSpinDeg * ringBoost) * dt;
      this._ringEl.object3D.rotateOnAxis(this._ringSpinAxis, a);
    }
    if (this._ringInnerEl && this._innerSpinDeg) {
      var b = THREE.MathUtils.degToRad(this._innerSpinDeg * innerBoost) * dt;
      this._ringInnerEl.object3D.rotateOnAxis(this._innerSpinAxis, b);
    }
  },
});
