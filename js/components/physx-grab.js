/**
 * Grab component.
 *
 * Based on an original component by Don McCurdy in aframe-physics-system
 * Copyright (c) 2016 Don McCurdy
 *
 * Source: https://github.com/c-frame/physx/blob/v0.3.0/examples/components/grab.js
 * Locally copied for project Tower, sandbox step B.
 *
 * Tower-specific modification (Сессия 9, Задача 3, Шаг 3.5 → рефакторинг 3.5.C):
 * На время захвата кубик переводится со слоя FLOAT_CUBE на слой GRABBED_CUBE.
 * Плитки купола живут на слое DOME и сталкиваются с FLOAT_CUBE|BALL,
 * не с GRAVITY_CUBE — кубик на столе может выпасть за край купола.
 * поэтому схваченный кубик (GRABBED_CUBE) свободно проходит сквозь стенку купола,
 * оставаясь нормальным физическим телом для всего остального
 * (стены/пол/потолок/пьедestal = WORLD, другие кубики, шары).
 * В момент release у floating-cube вызывается onGrabReleased() (Шаг 4) —
 * слой FLOAT_CUBE / GRAVITY_CUBE выбирает сам кубик по containment-тесту.
 *
 * Бита (ball-bat): dynamic + D6 softFixed joint, слой BAT не меняется.
 *
 * Реализация: смена SimulationFilterData на каждом shape кубика.
 *   word0 = битовая маска "к каким слоям я принадлежу" (один бит на слой)
 *   word1 = битовая маска "с какими слоями сталкиваюсь" (несколько битов)
 * Формат подтверждён диагностикой (см. PROJECT_LOG.md, Сессия 9).
 *
 * --- ВАЖНО про числа ---
 *
 * CONFIG.collisionLayers хранит ИНДЕКСЫ слоёв (0..6). Это сделано ради
 * биндинга physx-material (@c-frame/physx), который ждёт CSV из индексов
 * и сам делает (1 << index) под капотом.
 *
 * Здесь же мы работаем С PxFilterData НАПРЯМУЮ, в обход биндинга, и нам
 * нужны ГОТОВЫЕ битовые маски word0/word1. Поэтому из индекса делаем маску
 * вручную: bit(i) = (1 << i) >>> 0. Оператор >>>0 приводит результат к
 * uint32 — это страховка от переполнения int32 (1<<31 в JS даёт -2^31,
 * а PxFilterData принимает только [0, 4294967295]). Подробнее — см.
 * историю бага «−2147483648», PROJECT_LOG, Сессия 9, рефакторинг 3.5.C.
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
    // Красные шары — не хватаем (Этап 6; отбивание — Этап 7).
    if (hitEl && hitEl.components['red-ball']) return;
    if (!hitEl || hitEl.is(this.GRABBED_STATE) || !this.grabbing || this.hitEl) { return; }
    hitEl.addState(this.GRABBED_STATE);
    this.hitEl = hitEl;
    this.addJoint(hitEl, evt.target);
  },

  addJoint(el, target) {
    this.removeJoint();
    this._grabbedRoot = el;

    var bat = el.components['ball-bat'];
    if (bat && typeof bat.attachToHand === 'function') {
      bat.onGrabAcquired();
      bat.attachToHand(this._resolveHandEntity(target));
      this._jointHost = el;
      this.joint = document.createElement('a-entity');
      this.joint.setAttribute(
        'physx-joint',
        'type: D6; softFixed: true; target: #' + target.id
      );
      this._jointHost.appendChild(this.joint);
      return;
    }

    this._setGrabbedLayer(el, true);
    this._jointHost = el;

    this.joint = document.createElement('a-entity');
    this.joint.setAttribute(
      'physx-joint',
      'type: D6; softFixed: true; target: #' + target.id
    );
    this._jointHost.appendChild(this.joint);
  },

  /** Коллайдер руки → entity с physx-grab (leftHand / rightHand). */
  _resolveHandEntity: function (target) {
    var node = target;
    while (node) {
      if (node.components && node.components['physx-grab']) return node;
      node = node.parentElement;
    }
    return target;
  },

  removeJoint() {
    if (this._grabbedRoot && this._grabbedRoot.components['ball-bat']) {
      var batEl = this._grabbedRoot;
      var bat = batEl.components['ball-bat'];
      if (typeof bat.detachFromHand === 'function') bat.detachFromHand();
      if (typeof bat.onGrabReleased === 'function') bat.onGrabReleased();
      if (this.joint && this.joint.parentElement) {
        this.joint.parentElement.removeChild(this.joint);
      }
      this.joint = null;
      this._jointHost = null;
      this._grabbedRoot = null;
      return;
    }

    if (!this.joint) return;

    var grabbedEl = this._grabbedRoot;
    var fc = grabbedEl && grabbedEl.components['floating-cube'];
    if (fc && typeof fc.onGrabReleased === 'function') {
      fc.onGrabReleased();
    } else if (grabbedEl) {
      this._setGrabbedLayer(grabbedEl, false);
    }

    if (this._jointAnchor && this._jointAnchor.parentNode) {
      this._jointAnchor.parentNode.removeChild(this._jointAnchor);
    }
    this._jointAnchor = null;
    this._jointHost = null;
    this._grabbedRoot = null;

    if (this.joint && this.joint.parentElement) {
      this.joint.parentElement.removeChild(this.joint);
    }
    this.joint = null;
  },

  /**
   * Переключает слой кубика между FLOAT_CUBE и GRABBED_CUBE.
   *   grabbed=true  → кубик уходит на GRABBED_CUBE (купол его игнорирует);
   *   grabbed=false → кубик возвращается на FLOAT_CUBE (полное взаимодействие, включая купол).
   *
   * Здесь явно переключаем И word0, И word1, потому что маска
   * столкновений у двух режимов отличается на бит DOME.
   *
   * Маски строим вручную из индексов CONFIG.collisionLayers через
   * bit(i) = (1 << i) >>> 0 (см. JSDoc файла, секция "ВАЖНО про числа").
   */
  _setGrabbedLayer(el, grabbed) {
    var body = el.components['physx-body'];
    if (!body || !body.shapes) {
      console.warn('[physx-grab] body/shapes не готовы для', el.id);
      return;
    }
    var PX = el.sceneEl.systems.physx.PhysX;
    if (!PX || !PX.PxFilterData) {
      console.error('[physx-grab] PX.PxFilterData недоступен');
      return;
    }

    var L = (window.CONFIG && window.CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var bit = function (i) { return (1 << i) >>> 0; };

    var newWord0, newWord1;
    if (grabbed) {
      newWord0 = bit(L.GRABBED_CUBE);
      newWord1 = bit(L.WORLD) | bit(L.FLOAT_CUBE) | bit(L.GRAVITY_CUBE) |
                 bit(L.GRABBED_CUBE) | bit(L.BALL);
    } else {
      newWord0 = bit(L.FLOAT_CUBE);
      newWord1 = bit(L.WORLD) | bit(L.DOME) | bit(L.FLOAT_CUBE) |
                 bit(L.GRAVITY_CUBE) | bit(L.GRABBED_CUBE) | bit(L.BALL);
    }
    newWord0 = newWord0 >>> 0;
    newWord1 = newWord1 >>> 0;

    var shapes = Array.isArray(body.shapes) ? body.shapes : [body.shapes];
    for (var i = 0; i < shapes.length; i++) {
      var s = shapes[i];
      if (!s || !s.setSimulationFilterData) continue;
      var fd = new PX.PxFilterData(newWord0, newWord1, 0, 0);
      s.setSimulationFilterData(fd);
    }
  }
});
