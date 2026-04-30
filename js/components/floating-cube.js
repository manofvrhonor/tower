/* global AFRAME, CONFIG */

/**
 * Компонент floating-cube
 *
 * Делает кубик «плавающим» (свойство float):
 *   - dynamic-тело без гравитации;
 *   - низкий damping → дрейф по инерции;
 *   - стартовый импульс задаётся отдельно (Шаг 4 задачи 2.2);
 *   - захват рукой работает через стандартный physx-grab.
 *
 * Состояние state хранится в компоненте:
 *   - 'float'   — текущий режим (вне купола, без гравитации);
 *   - 'gravity' — будущий режим (внутри купола, с гравитацией). Появится в задаче 2.1.
 *
 * См. CURRENT_TASK.md, задача 2.2.
 */
AFRAME.registerComponent('floating-cube', {
  schema: {
    // Пока без параметров — всё берём из CONFIG.floatingCubes.
    // Если в будущем понадобится переопределять на конкретной сущности —
    // добавим сюда поля.
  },

  init: function () {
    console.log('[floating-cube] init on', this.el.id || '(no id)');

    // Внутреннее состояние. Для задачи 2.2 всегда 'float'.
    this.state = 'float';

    // Параметры из конфига (на будущее: damping, импульс — пригодятся в Шагах 4–5).
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};

    // Применить «невесомость» нужно ПОСЛЕ того, как PhysX создал rigid body.
    // Событие 'body-loaded' эмитится компонентом physx-body, когда тело готово.
    this.el.addEventListener('body-loaded', this._onBodyLoaded.bind(this));
  },

  _onBodyLoaded: function () {
    console.log('[floating-cube] body-loaded on', this.el.id || '(no id)');
    this._applyFloatPhysics();
  },

  /**
   * Перевести тело в режим float:
   *   - выключить гравитацию;
   *   - выставить damping из CONFIG.
   *
   * Используем оба пути: атрибут physx-body (декларативно) и API rigidBody
   * (на случай, если декларативный путь не поддерживается версией физики).
   */
  _applyFloatPhysics: function () {
    var el = this.el;
    var cfg = this.cfg;

    // 1) Декларативный путь: обновить компонент physx-body.
    //    В @c-frame/physx разные сборки используют разные имена свойств,
    //    поэтому пишем то, что чаще встречается. Лишние свойства игнорируются.
    try {
      el.setAttribute('physx-body', {
        linearDamping: cfg.linearDamping !== undefined ? cfg.linearDamping : 0.1,
        angularDamping: cfg.angularDamping !== undefined ? cfg.angularDamping : 0.1,
      });
    } catch (e) {
      console.warn('[floating-cube] setAttribute physx-body failed:', e);
    }

    // 2) Прямой путь к rigidBody — гарантированный способ выключить гравитацию.
    var rb = el.components['physx-body'] && el.components['physx-body'].rigidBody;
    if (!rb) {
      console.warn('[floating-cube] rigidBody not available after body-loaded');
      return;
    }

    // PhysX SDK: ActorFlag.eDISABLE_GRAVITY = 1 << 1 = 2.
    // Доступ через PhysX, который физический модуль выкладывает в window.
    if (typeof PhysX !== 'undefined' && PhysX.PxActorFlag) {
      try {
        rb.setActorFlag(PhysX.PxActorFlag.eDISABLE_GRAVITY, true);
        console.log('[floating-cube] gravity disabled via PxActorFlag');
      } catch (e) {
        console.warn('[floating-cube] setActorFlag failed:', e);
      }
    } else {
      // Fallback: некоторые сборки имеют метод setGravityEnabled.
      if (typeof rb.setGravityEnabled === 'function') {
        rb.setGravityEnabled(false);
        console.log('[floating-cube] gravity disabled via setGravityEnabled');
      } else {
        console.warn('[floating-cube] no API to disable gravity found on rigidBody');
      }
    }

    // Damping через API (дублирует setAttribute, но надёжнее).
    var ld = cfg.linearDamping !== undefined ? cfg.linearDamping : 0.1;
    var ad = cfg.angularDamping !== undefined ? cfg.angularDamping : 0.1;
    if (typeof rb.setLinearDamping === 'function') {
      rb.setLinearDamping(ld);
    }
    if (typeof rb.setAngularDamping === 'function') {
      rb.setAngularDamping(ad);
    }

    console.log('[floating-cube] float physics applied. state =', this.state);
  },

  remove: function () {
    this.el.removeEventListener('body-loaded', this._onBodyLoaded);
  },
});