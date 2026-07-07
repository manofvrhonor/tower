/* global AFRAME, CONFIG, THREE */

/**
 * menu-world-veil — чёрный fullscreen в menu; скрывает мир до Start.
 */
AFRAME.registerComponent('menu-world-veil', {
  schema: {},

  init: function () {
    this.cfg = (CONFIG.game && CONFIG.game.menu && CONFIG.game.menu.veil) || {};
    this._hideIds = this.cfg.hideIds || [
      'world-sky', 'room-fog-dome', 'outside-scenery', 'room-floor-fog',
      'assembly-hub', 'ghost-tower-hint',
    ];
    this._veilMesh = null;
    this._veilMat = null;
    this._revealing = false;
    this._revealT = 0;
    this._revealDur = 0.55;
    this._onRevealDone = null;

    this._onReturnMenu = this._onReturnMenu.bind(this);
    this.el.sceneEl.addEventListener('return-to-menu', this._onReturnMenu);

    this._attachVeil();
    this.setMenuMode(true);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('return-to-menu', this._onReturnMenu);
    this._detachVeil();
  },

  tick: function (time, delta) {
    if (!this._revealing || !this._veilMat) return;
    var dt = (delta || 16) / 1000;
    this._revealT += dt;
    var u = Math.min(1, this._revealT / this._revealDur);
    this._veilMat.opacity = 1 - u;
    if (u >= 1) {
      this._revealing = false;
      this._veilMesh.visible = false;
      this._setWorldVisible(true);
      if (this._onRevealDone) {
        var cb = this._onRevealDone;
        this._onRevealDone = null;
        cb();
      }
    }
  },

  setMenuMode: function (on) {
    this._revealing = false;
    this._revealT = 0;
    if (this._veilMat) this._veilMat.opacity = 1;
    if (this._veilMesh) this._veilMesh.visible = !!on;
    this._setWorldVisible(!on);
  },

  revealWorld: function (callback) {
    if (!this._veilMesh || !this._veilMat) {
      this._setWorldVisible(true);
      if (callback) callback();
      return;
    }
    this._onRevealDone = callback || null;
    this._revealing = true;
    this._revealT = 0;
    this._veilMesh.visible = true;
    this._veilMat.opacity = 1;
  },

  _attachVeil: function () {
    var cam = document.querySelector('#player a-camera');
    if (!cam) return;

    var radius = this.cfg.radius !== undefined ? this.cfg.radius : 48;
    var geo = new THREE.SphereGeometry(radius, 32, 24);
    this._veilMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
    });
    this._veilMesh = new THREE.Mesh(geo, this._veilMat);
    this._veilMesh.renderOrder = 4;
    this._veilMesh.name = 'menu-black-veil';
    cam.object3D.add(this._veilMesh);
  },

  _detachVeil: function () {
    if (!this._veilMesh) return;
    var cam = document.querySelector('#player a-camera');
    if (cam) cam.object3D.remove(this._veilMesh);
    if (this._veilMesh.geometry) this._veilMesh.geometry.dispose();
    if (this._veilMat) this._veilMat.dispose();
    this._veilMesh = null;
    this._veilMat = null;
  },

  _setWorldVisible: function (visible) {
    for (var i = 0; i < this._hideIds.length; i++) {
      var node = document.getElementById(this._hideIds[i]);
      if (node) node.setAttribute('visible', visible);
    }
  },

  _onReturnMenu: function () {
    this.setMenuMode(true);
  },
});
