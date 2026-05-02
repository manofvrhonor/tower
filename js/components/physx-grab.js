/**
 * Grab component.
 *
 * Based on an original component by Don McCurdy in aframe-physics-system
 * Copyright (c) 2016 Don McCurdy
 *
 * Source: https://github.com/c-frame/physx/blob/v0.3.0/examples/components/grab.js
 * Locally copied for project Tower, sandbox step B.
 *
 * Tower-specific modification (Сессия 8, Задача 3, Шаг 3):
 * На время захвата на всех shape'ах кубика снимается флаг eSIMULATION_SHAPE —
 * кубик становится фантомом и свободно проходит сквозь стенки купола
 * (89 плиток-коллайдеров) и любую другую геометрию. Joint типа Fixed
 * удерживает кубик у руки независимо от коллизий. В момент release флаг
 * возвращается, кубик снова физически взаимодействует с миром.
 *
 * Shape'ы лежат в массиве body.shapes (выяснено диагностикой,
 * см. PROJECT_LOG.md, Сессия 8).
 */

AFRAME.registerComponent('physx-grab', {
  init: function () {
    this.GRABBED_STATE = 'grabbed-dynamic';

    this.grabbing = false;
    this.hitEl = null;

    this.onHit = this.onHit.bind(this);
    this.onGripOpen = this.onGripOpen.bind(this);
    this.onGripClose = this.onGripClose.bind(this);
  },

  play: function () {
    var el = this.el;
    el.addEventListener('contactbegin', this.onHit);
    el.addEventListener('gripdown', this.onGripClose);
    el.addEventListener('gripup', this.onGripOpen);
    el.addEventListener('trackpaddown', this.onGripClose);
    el.addEventListener('trackpadup', this.onGripOpen);
    el.addEventListener('triggerdown', this.onGripClose);
    el.addEventListener('triggerup', this.onGripOpen);
  },

  pause: function () {
    var el = this.el;
    el.removeEventListener('contactbegin', this.onHit);
    el.removeEventListener('gripdown', this.onGripClose);
    el.removeEventListener('gripup', this.onGripOpen);
    el.removeEventListener('trackpaddown', this.onGripClose);
    el.removeEventListener('trackpadup', this.onGripOpen);
    el.removeEventListener('triggerdown', this.onGripClose);
    el.removeEventListener('triggerup', this.onGripOpen);
  },

  onGripClose: function (evt) {
    this.grabbing = true;
  },

  onGripOpen: function (evt) {
    var hitEl = this.hitEl;
    this.grabbing = false;
    if (!hitEl) { return; }
    hitEl.removeState(this.GRABBED_STATE);
    this.hitEl = undefined;
    this.removeJoint();
  },

  onHit: function (evt) {
    var hitEl = evt.detail.otherComponent?.el;
    if (hitEl && hitEl.components['physx-body'].data.type === 'static') return;
    if (!hitEl || hitEl.is(this.GRABBED_STATE) || !this.grabbing || this.hitEl) { return; }
    hitEl.addState(this.GRABBED_STATE);
    this.hitEl = hitEl;
    this.addJoint(hitEl, evt.target);
  },

  addJoint(el, target) {
    this.removeJoint();

    this._setSimulationShape(el, false);

    this.joint = document.createElement('a-entity');
    this.joint.setAttribute("physx-joint", `type: Fixed; target: #${target.id}`);
    el.appendChild(this.joint);
  },

  removeJoint() {
    if (!this.joint) return;

    var grabbedEl = this.joint.parentElement;
    this._setSimulationShape(grabbedEl, true);

    this.joint.parentElement.removeChild(this.joint);
    this.joint = null;
  },

  /**
   * Переключает флаг eSIMULATION_SHAPE на всех shape'ах rigidBody.
   * false → тело становится фантомом, не сталкивается ни с чем.
   * true  → возвращается в нормальный режим.
   */
  _setSimulationShape(el, enabled) {
    var body = el.components['physx-body'];
    if (!body || !body.rigidBody || !body.shapes) {
      console.warn('[physx-grab] body/rigidBody/shapes не готовы для', el.id);
      return;
    }
    var PX = el.sceneEl.systems.physx.PhysX;
    if (!PX || !PX.PxShapeFlag) {
      console.error('[physx-grab] PX.PxShapeFlag недоступен');
      return;
    }
    var flag = PX.PxShapeFlag.eSIMULATION_SHAPE;
    var shapes = Array.isArray(body.shapes) ? body.shapes : [body.shapes];
    for (var i = 0; i < shapes.length; i++) {
      var s = shapes[i];
      if (s && s.setFlag) s.setFlag(flag, enabled);
    }
  }
});