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

    this._onGameStarted = this._onGameStarted.bind(this);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);

    this._loadVisual(this.el, this._cfg.machineModel);
    if (this._ringEl) this._loadVisual(this._ringEl, this._cfg.ringModel);
    if (this._ringInnerEl) this._loadVisual(this._ringInnerEl, this._cfg.ringInnerModel);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
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
    console.log('[machine-rig] ring_inner spin:', letter.toUpperCase(),
      this._innerSpinDeg.toFixed(1), 'deg/s');
  },

  _onGameStarted: function () {
    this._rollInnerSpin();
  },

  _loadVisual: function (targetEl, url) {
    if (!targetEl || !url) return;
    var self = this;
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

  tick: function (time, timeDelta) {
    var dt = Math.min((timeDelta || 16) / 1000, 0.1);
    if (this._ringEl && this._ringSpinDeg) {
      var a = THREE.MathUtils.degToRad(this._ringSpinDeg) * dt;
      this._ringEl.object3D.rotateOnAxis(this._ringSpinAxis, a);
    }
    if (this._ringInnerEl && this._innerSpinDeg) {
      var b = THREE.MathUtils.degToRad(this._innerSpinDeg) * dt;
      this._ringInnerEl.object3D.rotateOnAxis(this._innerSpinAxis, b);
    }
  },
});
