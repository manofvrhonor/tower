/* global AFRAME, CONFIG, THREE */

/**
 * menu-backdrop-vfx — cyan-искры на чёрном фоне меню.
 *
 * Привязаны к МИРУ (не к камере) и кружат вокруг игрока: каждый спрайт орбитит
 * вокруг точки игрока по своему радиусу/высоте/скорости + лёгкое покачивание.
 * Спрайты (billboard) всегда обращены к камере. При Start — радиальный взрыв.
 */
AFRAME.registerComponent('menu-backdrop-vfx', {
  schema: {},

  init: function () {
    this.cfg = (CONFIG.game && CONFIG.game.menu && CONFIG.game.menu.backdropVfx) || {};
    this.assets = (CONFIG.game && CONFIG.game.menu && CONFIG.game.menu.assets) || {};
    this._active = false;
    this._exploding = false;
    this._explodeT = 0;
    this._explodeDur = (this.cfg.explodeDurationMs || 900) / 1000;
    this._explodeCb = null;
    this._sparks = [];
    this._center = new THREE.Vector3(0, 1.6, 0);
    this._tmp = new THREE.Vector3();
    this._root = new THREE.Group();
    this._root.name = 'menu-backdrop-sparks';
    this._root.renderOrder = 8;

    this._onReturnMenu = this._onReturnMenu.bind(this);
    this._onGameStarted = this._onGameStarted.bind(this);
    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnMenu);
    this.el.sceneEl.addEventListener('game-started', this._onGameStarted);

    this.el.sceneEl.object3D.add(this._root);
    this._buildSparks();
    this.setMenuActive(true);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnMenu);
    this.el.sceneEl.removeEventListener('game-started', this._onGameStarted);
    if (this._root.parent) this._root.parent.remove(this._root);
  },

  setMenuActive: function (on) {
    this._active = !!on && !this._exploding;
    this._root.visible = this._active;
    if (this._active) this._resetSparkPositions();
  },

  playStartTransition: function (callback) {
    this._exploding = true;
    this._active = false;
    this._explodeT = 0;
    this._explodeCb = callback || null;
    this._root.visible = true;
    var spd = this.cfg.explodeSpeed !== undefined ? this.cfg.explodeSpeed : 3.2;
    var i;
    for (i = 0; i < this._sparks.length; i++) {
      var s = this._sparks[i];
      this._tmp.copy(s.pos).sub(this._center);
      if (this._tmp.lengthSq() < 1e-4) this._tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      this._tmp.normalize();
      var k = spd * (0.85 + Math.random() * 0.3);
      s.vx = this._tmp.x * k;
      s.vy = this._tmp.y * k;
      s.vz = this._tmp.z * k;
    }
  },

  tick: function (time, delta) {
    var dt = (delta || 16) / 1000;
    if (this._exploding) {
      this._tickExplode(dt);
      return;
    }
    if (!this._active) return;
    this._tickOrbit(dt, time);
  },

  _cameraWorldPos: function (out) {
    var cam = document.querySelector('#player a-camera');
    if (cam) {
      cam.object3D.getWorldPosition(out);
      return true;
    }
    return false;
  },

  _sparkTexture: function () {
    var sparkFile = this.assets.sparkParticle;
    if (sparkFile && this.assets.basePath) {
      return this.assets.basePath + sparkFile;
    }
    return null;
  },

  _buildSparks: function () {
    var count = this.cfg.sparkCount !== undefined ? this.cfg.sparkCount : 70;
    var color = this.cfg.color || '#33e0ff';
    var texUrl = this._sparkTexture();
    var matOpts = {
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    };
    if (texUrl) {
      var tex = new THREE.TextureLoader().load(texUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      matOpts.map = tex;
    }

    var i;
    for (i = 0; i < count; i++) {
      var mat = new THREE.SpriteMaterial(matOpts);
      var sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 8;
      this._root.add(sprite);
      this._sparks.push({
        sprite: sprite,
        pos: new THREE.Vector3(),
        angle: 0, rXZ: 2, yBase: 0, angSpeed: 0.1,
        bobPhase: Math.random() * Math.PI * 2, bobAmp: 0.25,
        twPhase: Math.random() * Math.PI * 2,
        baseSize: 0.05,
        vx: 0, vy: 0, vz: 0,
      });
    }
    this._resetSparkPositions();
  },

  _resetSparkPositions: function () {
    if (!this._cameraWorldPos(this._center)) this._center.set(0, 1.6, 0);
    var rMin = this.cfg.shellRadiusMin !== undefined ? this.cfg.shellRadiusMin : 1.8;
    var rMax = this.cfg.shellRadiusMax !== undefined ? this.cfg.shellRadiusMax : 5.5;
    var yMin = this.cfg.yMin !== undefined ? this.cfg.yMin : -1.4;
    var yMax = this.cfg.yMax !== undefined ? this.cfg.yMax : 3.0;
    var orbit = this.cfg.orbitSpeed !== undefined ? this.cfg.orbitSpeed : 0.12;
    var bob = this.cfg.bobAmp !== undefined ? this.cfg.bobAmp : 0.25;
    var size = this.cfg.sparkSize !== undefined ? this.cfg.sparkSize : 0.05;
    var i;
    for (i = 0; i < this._sparks.length; i++) {
      var s = this._sparks[i];
      s.angle = Math.random() * Math.PI * 2;
      s.rXZ = rMin + Math.random() * (rMax - rMin);
      s.yBase = yMin + Math.random() * (yMax - yMin);
      s.angSpeed = orbit * (0.5 + Math.random() * 0.8) * (Math.random() < 0.5 ? 1 : -1);
      s.bobPhase = Math.random() * Math.PI * 2;
      s.bobAmp = bob * (0.5 + Math.random());
      s.twPhase = Math.random() * Math.PI * 2;
      s.baseSize = size * (0.6 + Math.random() * 0.8);
      s.vx = s.vy = s.vz = 0;
      this._placeOrbit(s, 0);
      s.sprite.scale.set(s.baseSize, s.baseSize, 1);
      s.sprite.material.opacity = 0.5 + Math.random() * 0.4;
    }
  },

  _placeOrbit: function (s, t) {
    var bob = Math.sin(t * 1.3 + s.bobPhase) * s.bobAmp;
    s.pos.set(
      this._center.x + Math.cos(s.angle) * s.rXZ,
      this._center.y + s.yBase + bob,
      this._center.z + Math.sin(s.angle) * s.rXZ
    );
    s.sprite.position.copy(s.pos);
  },

  _tickOrbit: function (dt, time) {
    var t = time * 0.001;
    var i;
    for (i = 0; i < this._sparks.length; i++) {
      var s = this._sparks[i];
      s.angle += s.angSpeed * dt;
      this._placeOrbit(s, t);
      s.sprite.material.opacity = 0.4 + 0.4 * Math.sin(t * 2.2 + s.twPhase);
    }
  },

  _tickExplode: function (dt) {
    this._explodeT += dt;
    var u = this._explodeT / this._explodeDur;
    var fade = u < 0.65 ? 1 : Math.max(0, 1 - (u - 0.65) / 0.35);
    var i;
    for (i = 0; i < this._sparks.length; i++) {
      var s = this._sparks[i];
      s.pos.x += s.vx * dt;
      s.pos.y += s.vy * dt;
      s.pos.z += s.vz * dt;
      s.sprite.position.copy(s.pos);
      s.sprite.material.opacity = fade * (0.5 + 0.5 * (1 - u));
      var sc = s.baseSize * (1 + u * 0.8);
      s.sprite.scale.set(sc, sc, 1);
    }
    if (u >= 1) {
      this._exploding = false;
      this._root.visible = false;
      if (this._explodeCb) {
        var cb = this._explodeCb;
        this._explodeCb = null;
        cb();
      }
    }
  },

  _onReturnMenu: function () {
    this.setMenuActive(true);
  },

  _onGameStarted: function () {
    this.setMenuActive(false);
  },
});
