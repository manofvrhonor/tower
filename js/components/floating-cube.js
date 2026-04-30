/* global AFRAME, CONFIG */

/**
 * Компонент floating-cube
 *
 * Делает кубик «плавающим» (свойство float):
 *   - dynamic-тело без гравитации;
 *   - низкий damping → дрейф по инерции;
 *   - стартовый линейный импульс случайного направления;
 *   - стартовый угловой импульс (вращение) случайной оси;
 *   - захват рукой работает через стандартный physx-grab.
 *
 * Состояние state:
 *   - 'float'   — текущий режим;
 *   - 'gravity' — будущий режим (задача 3).
 *
 * ТЕХНИЧЕСКИЕ ЗАМЕТКИ ПО БИНДИНГУ @c-frame/physx@v0.3.0
 * (проверено в Сессиях 6–7, см. CURRENT_TASK.md):
 *
 *   1. Готовность тела ловится ТОЛЬКО поллингом rigidBody —
 *      события body-loaded / physx-body-loaded в этой версии
 *      не приходят стабильно.
 *
 *   2. Энумы PhysX (PxActorFlag и т.п.) — это объекты-обёртки
 *      с полем .value. В setActorFlag нужно передавать сам объект,
 *      а не число. Объект берётся через sceneEl.systems.physx.PhysX.
 *
 *   3. Класса PxVec3 в system.PhysX НЕТ, глобального PhysX тоже НЕТ.
 *      Методы setLinearVelocity / setAngularVelocity принимают
 *      обычный {x, y, z}-объект.
 *
 *   4. PhysX усыпляет dynamic-тела с малой кинетической энергией.
 *      Лечение: setSleepThreshold(0) + страховочный wakeUp() в tick.
 *
 *   5. Биндинг теряет ощутимую часть энергии в контакте даже при
 *      restitution=1.0 на обоих материалах и нулевом damping.
 *      Тело при этом не засыпает (isSleeping=false), но скорость
 *      падает быстрее, чем диктует закон сохранения. Природа потерь
 *      внутри биндинга/PhysX, углубляться нецелесообразно.
 *      ОБХОД: компенсируем потери начальными условиями —
 *      повышенная стартовая скорость + угловое вращение
 *      + restitution стен 0.95.
 *
 * См. CURRENT_TASK.md, задача 2.
 */
AFRAME.registerComponent('floating-cube', {
  schema: {},

  init: function () {
    console.log('[floating-cube] init on', this.el.id || '(no id)');

    this.state = 'float';
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    this._physicsApplied = false;

    // Подписка на возможные события готовности тела (план А).
    var onReady = this._tryApply.bind(this);
    this.el.addEventListener('body-loaded', onReady);
    this.el.addEventListener('physx-body-loaded', onReady);
    this._onReady = onReady;

    // Поллинг rigidBody (план Б, основной — см. JSDoc, п. 1).
    this._pollStartTime = performance.now();
    this._pollIntervalId = setInterval(this._tryApply.bind(this), 100);
  },

  _tryApply: function () {
    if (this._physicsApplied) return;

    var bodyComp = this.el.components['physx-body'];
    var rb = bodyComp && bodyComp.rigidBody;
    if (!rb) {
      var waited = performance.now() - this._pollStartTime;
      if (waited > 5000 && !this._timeoutWarned) {
        console.warn('[floating-cube] rigidBody still not ready after 5s on', this.el.id);
        this._timeoutWarned = true;
      }
      return;
    }

    console.log('[floating-cube] rigidBody detected on', this.el.id || '(no id)');
    this._rb = rb; // сохраняем для tick
    this._applyFloatPhysics(rb);
    this._physicsApplied = true;

    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  _applyFloatPhysics: function (rb) {
    var cfg = this.cfg;
    var ld = cfg.linearDamping !== undefined ? cfg.linearDamping : 0.1;
    var ad = cfg.angularDamping !== undefined ? cfg.angularDamping : 0.1;

    // === ОТКЛЮЧЕНИЕ ГРАВИТАЦИИ === (см. JSDoc, п. 2)
    var sysPX = this.el.sceneEl.systems.physx && this.el.sceneEl.systems.physx.PhysX;

    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, true);
        if (typeof rb.wakeUp === 'function') rb.wakeUp();
      } catch (e) {
        console.error('[floating-cube] setActorFlag failed:', e);
      }
    } else {
      console.error('[floating-cube] PxActorFlag.eDISABLE_GRAVITY not found');
    }

    // === DAMPING ===
    if (typeof rb.setLinearDamping === 'function') {
      rb.setLinearDamping(ld);
    }
    if (typeof rb.setAngularDamping === 'function') {
      rb.setAngularDamping(ad);
    }

    // === SLEEP THRESHOLD: запретить засыпание === (см. JSDoc, п. 4)
    if (typeof rb.setSleepThreshold === 'function') {
      try {
        rb.setSleepThreshold(0);
      } catch (e) {
        console.warn('[floating-cube] setSleepThreshold failed:', e.message);
      }
    }

    // === ОБНУЛЕНИЕ НАКОПЛЕННОЙ СКОРОСТИ + СТАРТОВЫЙ ЛИНЕЙНЫЙ ИМПУЛЬС ===
    // (см. JSDoc, п. 3 и п. 5 — компенсируем потери в контакте.)
    if (typeof rb.setLinearVelocity === 'function') {
      try {
        rb.setLinearVelocity({ x: 0, y: 0, z: 0 }, true);
      } catch (e) {
        console.warn('[floating-cube] zero linear velocity failed:', e.message);
      }

      var speed = (cfg.initialImpulseSpeed !== undefined) ? cfg.initialImpulseSpeed : 0.3;
      if (speed > 0) {
        var dir = this._randomUnitVector();
        var vel = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
        try {
          rb.setLinearVelocity(vel, true);
        } catch (e) {
          console.warn('[floating-cube] impulse failed:', e.message);
        }
      }
    } else {
      console.warn('[floating-cube] rb.setLinearVelocity is not a function');
    }

    // === СТАРТОВЫЙ УГЛОВОЙ ИМПУЛЬС (вращение) ===
    // Случайная ось, фиксированный модуль угловой скорости из конфига.
    if (typeof rb.setAngularVelocity === 'function') {
      try {
        rb.setAngularVelocity({ x: 0, y: 0, z: 0 }, true);
      } catch (e) {
        console.warn('[floating-cube] zero angular velocity failed:', e.message);
      }

      var angSpeed = (cfg.initialAngularSpeed !== undefined) ? cfg.initialAngularSpeed : 0.8;
      if (angSpeed > 0) {
        var axis = this._randomUnitVector();
        var angVel = {
          x: axis.x * angSpeed,
          y: axis.y * angSpeed,
          z: axis.z * angSpeed
        };
        try {
          rb.setAngularVelocity(angVel, true);
        } catch (e) {
          console.warn('[floating-cube] angular velocity failed:', e.message);
        }
      }
    } else {
      console.warn('[floating-cube] rb.setAngularVelocity is not a function');
    }

    console.log('[floating-cube] float physics applied. state =', this.state);
  },

  /**
   * Tick-страховка: даже если setSleepThreshold(0) проигнорирован
   * биндингом, вручную будим тело в состоянии float.
   * См. JSDoc, п. 4.
   */
  tick: function () {
    if (this.state !== 'float') return;
    var rb = this._rb;
    if (!rb) return;

    if (typeof rb.isSleeping === 'function' && rb.isSleeping()) {
      if (typeof rb.wakeUp === 'function') {
        rb.wakeUp();
      }
    }
  },

  /**
   * Случайный единичный вектор, равномерно распределённый по сфере.
   * Метод отбраковки: точка из куба [-1,1]^3, отброс длинных и нулевых,
   * нормализация.
   */
  _randomUnitVector: function () {
    var x, y, z, len2;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len2 = x * x + y * y + z * z;
    } while (len2 > 1 || len2 < 1e-6);
    var inv = 1 / Math.sqrt(len2);
    return { x: x * inv, y: y * inv, z: z * inv };
  },

  remove: function () {
    if (this._pollIntervalId) clearInterval(this._pollIntervalId);
    if (this._onReady) {
      this.el.removeEventListener('body-loaded', this._onReady);
      this.el.removeEventListener('physx-body-loaded', this._onReady);
    }
  },
});