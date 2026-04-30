/* global AFRAME, CONFIG, PhysX */

/**
 * Компонент floating-cube
 *
 * Делает кубик «плавающим» (свойство float):
 *   - dynamic-тело без гравитации;
 *   - низкий damping → дрейф по инерции;
 *   - стартовый импульс задаётся отдельно (Шаг 4 задачи 2.2);
 *   - захват рукой работает через стандартный physx-grab.
 *
 * Состояние state:
 *   - 'float'   — текущий режим;
 *   - 'gravity' — будущий режим (задача 2.1).
 *
 * Готовность тела определяется ПОЛЛИНГОМ rigidBody, а не событием —
 * имя события зависит от версии @c-frame/physx и не гарантировано.
 *
 * См. CURRENT_TASK.md, задача 2.2.
 */
AFRAME.registerComponent('floating-cube', {
  schema: {},

  init: function () {
    console.log('[floating-cube] init on', this.el.id || '(no id)');

    this.state = 'float';
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    this._physicsApplied = false;

    // План А: подписаться на возможные события готовности тела.
    var onReady = this._tryApply.bind(this);
    this.el.addEventListener('body-loaded', onReady);
    this.el.addEventListener('physx-body-loaded', onReady);
    this._onReady = onReady;

    // План Б: поллинг rigidBody. Срабатывает в любом случае.
    this._pollStartTime = performance.now();
    this._pollIntervalId = setInterval(this._tryApply.bind(this), 100);
  },

  _tryApply: function () {
    if (this._physicsApplied) return;

    var bodyComp = this.el.components['physx-body'];
    var rb = bodyComp && bodyComp.rigidBody;
    if (!rb) {
      // Тело ещё не готово. Если ждём слишком долго — предупреждаем.
      var waited = performance.now() - this._pollStartTime;
      if (waited > 5000 && !this._timeoutWarned) {
        console.warn('[floating-cube] rigidBody still not ready after 5s on', this.el.id);
        this._timeoutWarned = true;
      }
      return;
    }

    console.log('[floating-cube] rigidBody detected on', this.el.id || '(no id)');
    this._applyFloatPhysics(rb);
    this._physicsApplied = true;

    // Останавливаем поллинг.
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  /**
   * Перевести тело в режим float: выключить гравитацию + выставить damping.
   * Пробуем разные API подряд — сообщаем в консоль, какой сработал.
   */
  _applyFloatPhysics: function (rb) {
    var cfg = this.cfg;
    var ld = cfg.linearDamping !== undefined ? cfg.linearDamping : 0.1;
    var ad = cfg.angularDamping !== undefined ? cfg.angularDamping : 0.1;

    // === ОТКЛЮЧЕНИЕ ГРАВИТАЦИИ ===
    // PhysX-WASM ожидает в setActorFlag объект-обёртку enum'а (с полем .value),
    // а не голое число. Объект лежит на sceneEl.systems.physx.PhysX.PxActorFlag.
    var sys = this.el.sceneEl.systems.physx;
    var PX = sys && sys.PhysX;
    var gravityDisabled = false;

    if (PX && PX.PxActorFlag && PX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(PX.PxActorFlag.eDISABLE_GRAVITY, true);
        console.log('[floating-cube] gravity disabled via PxActorFlag.eDISABLE_GRAVITY');
        gravityDisabled = true;
      } catch (e) {
        console.error('[floating-cube] setActorFlag with enum object failed:', e);
      }
    } else {
      console.error('[floating-cube] PxActorFlag.eDISABLE_GRAVITY not found on system.PhysX');
    }

    // На всякий: разбудим тело, чтобы изменение флага применилось немедленно.
    if (gravityDisabled && typeof rb.wakeUp === 'function') {
      try { rb.wakeUp(); } catch (e) {}
    }

    // === DAMPING ===
    if (typeof rb.setLinearDamping === 'function') {
      rb.setLinearDamping(ld);
      console.log('[floating-cube] linearDamping =', ld);
    }
    if (typeof rb.setAngularDamping === 'function') {
      rb.setAngularDamping(ad);
      console.log('[floating-cube] angularDamping =', ad);
    }

    // На случай, если у кубика уже накопилась скорость падения за тики до отключения
    // гравитации — обнулим её, чтобы стартовое положение было «висит на месте».
    if (typeof rb.setLinearVelocity === 'function' && PX && PX.PxVec3) {
      try {
        var zero = new PX.PxVec3(0, 0, 0);
        rb.setLinearVelocity(zero, true);
        if (typeof zero.delete === 'function') zero.delete();
      } catch (e) {
        console.warn('[floating-cube] could not zero linear velocity:', e.message);
      }
    }

    console.log('[floating-cube] float physics applied. state =', this.state);
  },

  remove: function () {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
    }
    if (this._onReady) {
      this.el.removeEventListener('body-loaded', this._onReady);
      this.el.removeEventListener('physx-body-loaded', this._onReady);
    }
  },
});