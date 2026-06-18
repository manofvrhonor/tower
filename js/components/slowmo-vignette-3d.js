/* global AFRAME, CONFIG, THREE */

/**
 * slowmo-vignette-3d — мягкая radial-виньетка на камере (VR / Quest).
 * Quad в локальном пространстве камеры: близко к глазам, поверх сцены.
 */
AFRAME.registerComponent('slowmo-vignette-3d', {
  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.slowmoFx &&
      CONFIG.slowmoFx.vignette) || {};
    this._materialReady = false;

    var size = this.cfg.planeSize !== undefined ? this.cfg.planeSize : 1.6;
    var dist = this.cfg.planeDistance !== undefined ? this.cfg.planeDistance : 0.18;

    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext('2d');
    var cx = 256;
    var cy = 256;
    var innerR = this.cfg.gradientInnerPx !== undefined ? this.cfg.gradientInnerPx : 28;
    var grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, cx);
    // Тёмные стопы подтянуты ближе к центру: при широком FOV Quest затемнение
    // должно попадать в поле зрения, а не уходить за край (см. задача 4b).
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.30, 'rgba(0,0,0,0.10)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    grad.addColorStop(0.80, 'rgba(0,0,0,0.90)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    this._texture = new THREE.CanvasTexture(canvas);
    this._texture.needsUpdate = true;

    this.plane = document.createElement('a-entity');
    this.plane.setAttribute('geometry', 'primitive: plane; width: ' + size + '; height: ' + size);
    // Локально перед камерой (−Z = взгляд). Поворот: normal смотрит на игрока.
    this.plane.setAttribute('position', '0 0 ' + (-dist));
    this.plane.setAttribute('rotation', '0 180 0');
    this.plane.setAttribute('visible', false);
    this.plane.setAttribute('frustum-culled', false);
    this.el.appendChild(this.plane);

    var self = this;
    this.plane.addEventListener('loaded', function () { self._setupMaterial(); });
    setTimeout(function () { self._setupMaterial(); }, 0);
  },

  _setupMaterial: function () {
    if (this._materialReady || !this.plane) return;
    var mesh = this.plane.getObject3D('mesh');
    if (!mesh) return;

    mesh.frustumCulled = false;
    mesh.renderOrder = 9999;
    mesh.material = new THREE.MeshBasicMaterial({
      map: this._texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this._materialReady = true;
  },

  tick: function () {
    if (!this.plane) return;
    if (!this._materialReady) this._setupMaterial();

    var tsSys = this.el.sceneEl.systems['time-scale'];
    if (!tsSys) return;

    var ts = tsSys.getScale();
    var tsCfg = (typeof CONFIG !== 'undefined' && CONFIG.timeScale) || {};
    var tsMin = tsCfg.min !== undefined ? tsCfg.min : 0.05;
    var tsMax = tsCfg.max !== undefined ? tsCfg.max : 1.0;
    var range = tsMax - tsMin;
    if (range < 1e-6) return;

    var slowFactor = (tsMax - ts) / range;
    if (slowFactor < 0) slowFactor = 0;
    if (slowFactor > 1) slowFactor = 1;

    var maxOp = this.cfg.maxOpacity !== undefined ? this.cfg.maxOpacity : 0.9;
    var op = maxOp * slowFactor;

    var mesh = this.plane.getObject3D('mesh');
    if (mesh && mesh.material) {
      mesh.material.opacity = op;
      mesh.material.depthTest = false;
      mesh.renderOrder = 9999;
    }
    this.plane.setAttribute('visible', op > 0.008);
  },
});
