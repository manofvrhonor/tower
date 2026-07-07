/* global AFRAME, CONFIG, THREE */

/**
 * victory-freeze — пауза физики/движения мира при победе.
 *
 * На 'victory': стоп волн шаров, сброс velocity, sleep dynamic-тел.
 * Кольца (machine-rig tick) и co-rotation снепнутых деталей — продолжают.
 * Сброс на 'game-started' / 'return-to-menu'.
 */
AFRAME.registerComponent('victory-freeze', {
  schema: {},

  init: function () {
    this._frozen = false;
    this._onVictory = this._onVictory.bind(this);
    this._onUnfreeze = this._onUnfreeze.bind(this);
    this.el.sceneEl.addEventListener('victory', this._onVictory);
    this.el.sceneEl.addEventListener('game-started', this._onUnfreeze);
    this.el.sceneEl.addEventListener('return-to-menu', this._onUnfreeze);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('victory', this._onVictory);
    this.el.sceneEl.removeEventListener('game-started', this._onUnfreeze);
    this.el.sceneEl.removeEventListener('return-to-menu', this._onUnfreeze);
  },

  isFrozen: function () {
    return this._frozen;
  },

  _cfg: function () {
    return (typeof CONFIG !== 'undefined' && CONFIG.victory) || {};
  },

  _onVictory: function () {
    if (this._cfg().freezeWorldOnVictory === false) return;
    this._frozen = true;
    this._releaseGrabs();
    if (window.ballWaveManager && typeof window.ballWaveManager.stopWaves === 'function') {
      window.ballWaveManager.stopWaves();
    }
    this._freezeGameplayBodies();
    console.log('[victory-freeze] world paused (rings still spin)');
  },

  _onUnfreeze: function () {
    this._frozen = false;
  },

  _releaseGrabs: function () {
    var ids = ['leftHand', 'rightHand'];
    for (var i = 0; i < ids.length; i++) {
      var grab = document.getElementById(ids[i]);
      grab = grab && grab.components['physx-grab'];
      if (!grab) continue;
      if (grab.joint) grab.removeJoint();
      grab.grabbing = false;
      grab.hitEl = undefined;
    }
  },

  _zeroVelocity: function (rb) {
    if (!rb) return;
    try {
      if (typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({ x: 0, y: 0, z: 0 }, false);
      }
      if (typeof rb.setAngularVelocity === 'function') {
        rb.setAngularVelocity({ x: 0, y: 0, z: 0 }, false);
      }
      if (typeof rb.putToSleep === 'function') rb.putToSleep();
    } catch (e) { /* ignore */ }
  },

  _shouldFreezeEl: function (el) {
    if (!el || !el.components) return false;
    if (el.hasAttribute('data-machine-ring-segment')) return false;
    if (el.components['machine-rig'] || el.components['machine-ring-collider']) return false;
    var fc = el.components['floating-cube'];
    if (fc && fc.state === 'snapped') return false;
    return !!(el.components['red-ball'] || el.components['ball-bat'] ||
      (fc && fc.state !== 'snapped'));
  },

  _freezeGameplayBodies: function () {
    var roots = ['red-balls-root', 'floating-cubes-root', 'ball-bat-root'];
    for (var r = 0; r < roots.length; r++) {
      var root = document.getElementById(roots[r]);
      if (!root || !root.children) continue;
      for (var i = 0; i < root.children.length; i++) {
        var el = root.children[i];
        if (!this._shouldFreezeEl(el)) continue;
        var bc = el.components['physx-body'];
        this._zeroVelocity(bc && bc.rigidBody);
      }
    }
  },

  tick: function () {
    if (!this._frozen) return;
    this._freezeGameplayBodies();
  },
});

window.isVictoryFrozen = function () {
  var scene = document.querySelector('a-scene');
  var c = scene && scene.components['victory-freeze'];
  return !!(c && c.isFrozen && c.isFrozen());
};
