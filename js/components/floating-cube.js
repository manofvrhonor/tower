/* global AFRAME, CONFIG, THREE */

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
 *   - 'float'   — невесомость, слой FLOAT_CUBE;
 *   - 'gravity' — гравитация включена, слой GRAVITY_CUBE (задача 3, Шаг 4).
 *
 * При release (physx-grab → onGrabReleased) центр кубика проверяется
 * containment-тестом купола: внутри → gravity, снаружи → float.
 *
 * Контакт gravity-кубика с #floor → возврат в float (задача 3, Шаг 5).
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
    this.domeCfg = (typeof CONFIG !== 'undefined' && CONFIG.dome) || {};
    this._physicsApplied = false;
    this._worldPos = new THREE.Vector3();
    // Какой timeScale уже «вшит» в текущую velocity PhysX (см. _applyTimeScaleToVelocity).
    this._lastAppliedTimeScale = 1.0;
    this._driftDir = null; // единичный вектор «полной» скорости дрейфа (для trail seed)
    this._onContactBegin = this._onContactBegin.bind(this);

    // Подписка на возможные события готовности тела (план А).
    var onReady = this._tryApply.bind(this);
    this.el.addEventListener('body-loaded', onReady);
    this.el.addEventListener('physx-body-loaded', onReady);
    this._onReady = onReady;

    // Поллинг rigidBody (план Б, основной — см. JSDoc, п. 1).
    this._pollStartTime = performance.now();
    this._pollIntervalId = setInterval(this._tryApply.bind(this), 100);
  },

  play: function () {
    this.el.addEventListener('contactbegin', this._onContactBegin);
  },

  pause: function () {
    this.el.removeEventListener('contactbegin', this._onContactBegin);
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
    this._applyContactQuality(rb);
    this._applyFloatPhysics(rb, true);
    this._physicsApplied = true;

    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  /**
   * Вызывается из physx-grab при отпускании кубика.
   * Containment-тест по CONFIG.dome → gravity или float.
   */
  onGrabReleased: function () {
    // После joint velocity в теле «полная» — сброс для корректного масштабирования.
    this._lastAppliedTimeScale = 1.0;

    var pos = this._getWorldPosition();
    var inside = this._isInsideDome(pos, true);

    if (inside) {
      this._enterGravityMode();
    } else {
      this._enterFloatMode(false);
    }

    console.log(
      '[floating-cube] release', this.el.id || '(no id)',
      inside ? 'inside → gravity' : 'outside → float'
    );
  },

  _enterGravityMode: function () {
    this.state = 'gravity';
    var rb = this._rb;
    if (!rb) return;
    this._applyGravityPhysics(rb);
    this._applyCubeMaterial('gravity');
    this._setCollisionLayer('GRAVITY_CUBE');
  },

  /**
   * gravity-кубик коснулся #floor → снова float + импульс вверх.
   * Контакт со столом (пьедестал) не обрабатывается — у него другой id.
   */
  _onContactBegin: function (evt) {
    if (this.state !== 'gravity') return;

    // Страховка пробуждения: уснувшую стопку должен будить новый контакт
    // (упавший сверху кубик/рука). Авто-wake биндинга @c-frame/physx
    // ненадёжен (ADR-02), поэтому будим себя явно. Это безопасно — wakeUp
    // только в момент контакта, не каждый кадр, стопка снова уснёт сама.
    var rb = this._rb;
    if (rb && typeof rb.wakeUp === 'function') {
      rb.wakeUp();
    }

    var otherEl = evt.detail.otherComponent && evt.detail.otherComponent.el;
    if (!otherEl || otherEl.id !== 'floor') return;

    this._returnToFloatFromFloor();
  },

  _returnToFloatFromFloor: function () {
    this._enterFloatMode(false);

    var rb = this._rb;
    if (!rb || typeof rb.setLinearVelocity !== 'function') return;

    var upSpeed = (this.cfg.floorReturnSpeed !== undefined)
      ? this.cfg.floorReturnSpeed
      : 0.25;
    try {
      rb.setLinearVelocity({ x: 0, y: upSpeed, z: 0 }, true);
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
      this._lastAppliedTimeScale = 1.0;
      this._driftDir = { x: 0, y: 1, z: 0 };
      this._applyTimeScaleToVelocity(rb);
    } catch (e) {
      console.warn('[floating-cube] floor return impulse failed:', e.message);
    }

    console.log('[floating-cube] floor contact → float', this.el.id || '(no id)');
  },

  _enterFloatMode: function (applyImpulse) {
    this.state = 'float';
    var rb = this._rb;
    if (!rb) return;
    this._applyFloatPhysics(rb, applyImpulse);
    this._applyCubeMaterial('float');
    this._setCollisionLayer('FLOAT_CUBE');
  },

  _getWorldPosition: function () {
    this.el.object3D.getWorldPosition(this._worldPos);
    return this._worldPos;
  },

  /**
   * Центр кубика внутри капсулы купола?
   *
   * @param {object} pos — {x, y, z} мировые координаты центра.
   * @param {boolean} [forRelease] — true: мягкий тест (R + halfCube), для
   *   onGrabReleased; false/omit: строгий (R - halfCube).
   */
  _isInsideDome: function (pos, forRelease) {
    var dome = this.domeCfg;
    var halfCube = (this.cfg.size !== undefined ? this.cfg.size : 0.1) / 2;
    var R = dome.radius !== undefined ? dome.radius : 0.27;
    var wallBottomY = dome.cylinderBottomY !== undefined ? dome.cylinderBottomY : 1.0;
    var wallTopY = dome.cylinderTopY !== undefined ? dome.cylinderTopY : 1.3;
    var eps = 0.01;

    var useLenient = forRelease;
    if (forRelease && dome.releaseContainment === 'strict') {
      useLenient = false;
    }

    // lenient: хотя бы часть кубика может быть внутри (центр до R + halfCube).
    // strict:  весь кубик должен помещаться (центр до R - halfCube).
    var innerR = useLenient ? (R + halfCube + eps) : (R - halfCube + eps);
    var yOutsideBelow = useLenient
      ? (wallBottomY - halfCube - eps)
      : (wallBottomY - eps);

    var x = pos.x;
    var y = pos.y;
    var z = pos.z;

    if (y < yOutsideBelow) {
      return false;
    }

    if (y <= wallTopY + eps) {
      return (x * x + z * z) <= innerR * innerR;
    }

    var dy = y - wallTopY;
    return (x * x + dy * dy + z * z) <= innerR * innerR;
  },

  _getTimeScale: function () {
    var sys = this.el.sceneEl.systems['time-scale'];
    if (!sys || typeof sys.getScale !== 'function') return 1;
    return sys.getScale();
  },

  /**
   * Поддерживает минимальную «полную» скорость дрейфа (до timeScale).
   * Компенсирует потери энергии в контактах @c-frame/physx (см. JSDoc п.5).
   */
  _maintainFloatDrift: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var cfg = this.cfg;
    var minLin = cfg.minDriftSpeed !== undefined ? cfg.minDriftSpeed : 0.28;
    var minAng = cfg.minAngularDriftSpeed !== undefined ? cfg.minAngularDriftSpeed : 0.65;

    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;
    var changed = false;

    try {
      var lv = rb.getLinearVelocity();
      if (lv && typeof lv.x === 'number' && typeof rb.setLinearVelocity === 'function') {
        var fx = lv.x * invPrev;
        var fy = lv.y * invPrev;
        var fz = lv.z * invPrev;
        var speed = Math.sqrt(fx * fx + fy * fy + fz * fz);

        if (speed < minLin) {
          if (speed > 1e-4) {
            var scale = minLin / speed;
            fx *= scale;
            fy *= scale;
            fz *= scale;
            this._driftDir = { x: fx / minLin, y: fy / minLin, z: fz / minLin };
          } else {
            var dir = this._randomUnitVector();
            fx = dir.x * minLin;
            fy = dir.y * minLin;
            fz = dir.z * minLin;
            this._driftDir = { x: dir.x, y: dir.y, z: dir.z };
          }
          rb.setLinearVelocity({ x: fx, y: fy, z: fz }, false);
          changed = true;
        }
      }

      if (typeof rb.getAngularVelocity === 'function' && typeof rb.setAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av && typeof av.x === 'number') {
          var ax = av.x * invPrev;
          var ay = av.y * invPrev;
          var az = av.z * invPrev;
          var angSpeed = Math.sqrt(ax * ax + ay * ay + az * az);

          if (angSpeed < minAng) {
            if (angSpeed > 1e-4) {
              var angScale = minAng / angSpeed;
              ax *= angScale;
              ay *= angScale;
              az *= angScale;
            } else {
              var axis = this._randomUnitVector();
              ax = axis.x * minAng;
              ay = axis.y * minAng;
              az = axis.z * minAng;
            }
            rb.setAngularVelocity({ x: ax, y: ay, z: az }, false);
            changed = true;
          }
        }
      }

      if (changed) {
        this._lastAppliedTimeScale = 1.0;
      }
    } catch (e) {
      if (!this._driftMaintainWarned) {
        console.warn('[floating-cube] drift maintain failed:', e.message);
        this._driftMaintainWarned = true;
      }
    }
  },

  /**
   * Масштабирует linear/angular velocity float-кубика под timeScale.
   *
   * Важно: PhysX хранит уже масштабированную velocity. Каждый кадр сначала
   * восстанавливаем «полную» (÷ lastApplied), затем умножаем на текущий scale.
   * Иначе v *= ts каждый кадр → экспоненциальное затухание до нуля.
   */
  _applyTimeScaleToVelocity: function (rb) {
    var ts = this._getTimeScale();

    if (ts >= 0.999) {
      this._lastAppliedTimeScale = 1.0;
      return;
    }
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (lv && typeof lv.x === 'number' && typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({
          x: lv.x * invPrev * ts,
          y: lv.y * invPrev * ts,
          z: lv.z * invPrev * ts,
        }, false);
      }
      if (typeof rb.getAngularVelocity === 'function' && typeof rb.setAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av && typeof av.x === 'number') {
          rb.setAngularVelocity({
            x: av.x * invPrev * ts,
            y: av.y * invPrev * ts,
            z: av.z * invPrev * ts,
          }, false);
        }
      }
      this._lastAppliedTimeScale = ts;
    } catch (e) {
      if (!this._timeScaleWarned) {
        console.warn('[floating-cube] timeScale velocity scale failed:', e.message);
        this._timeScaleWarned = true;
      }
    }
  },

  _getPhysX: function () {
    return this.el.sceneEl.systems.physx && this.el.sceneEl.systems.physx.PhysX;
  },

  /**
   * CSV collidesWithLayers для FLOAT_CUBE или GRAVITY_CUBE.
   */
  _getCollidesWithCsv: function (layerName) {
    var L = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var list = [L.WORLD, L.FLOAT_CUBE, L.GRAVITY_CUBE, L.GRABBED_CUBE, L.BALL, L.BAT];
    if (layerName === 'FLOAT_CUBE') {
      list.splice(1, 0, L.DOME);
    }
    return list.join(', ');
  },

  /**
   * Переключает restitution/friction кубика (float ↔ gravity).
   * Слои коллизий дополнительно синхронизируются через _setCollisionLayer.
   */
  _applyCubeMaterial: function (mode) {
    var cfg = this.cfg;
    var mat = (mode === 'gravity')
      ? (cfg.gravityMaterial || { restitution: 0.15, staticFriction: 0.7, dynamicFriction: 0.6 })
      : (cfg.floatMaterial || { restitution: 0.9, staticFriction: 0.05, dynamicFriction: 0.05 });
    var layerName = (mode === 'gravity') ? 'GRAVITY_CUBE' : 'FLOAT_CUBE';
    var L = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };

    // contactOffset — раннее обнаружение контакта (меньше проникновения и
    // «резинового» выброса депенетрации). Float — floatContactOffset (шары малы).
    var co = -1;
    if (mode === 'float' && this.cfg.floatContactOffset !== undefined) {
      co = this.cfg.floatContactOffset;
    } else if (this.cfg.contactOffset !== undefined) {
      co = this.cfg.contactOffset;
    }
    var coStr = (co >= 0) ? ('; contactOffset: ' + co) : '';

    this.el.setAttribute('physx-material',
      'restitution: ' + mat.restitution +
      '; staticFriction: ' + mat.staticFriction +
      '; dynamicFriction: ' + mat.dynamicFriction +
      coStr +
      '; collisionLayers: ' + L[layerName] +
      '; collidesWithLayers: ' + this._getCollidesWithCsv(layerName));
  },

  /**
   * Слой FLOAT_CUBE или GRAVITY_CUBE через PxFilterData (как physx-grab).
   */
  _setCollisionLayer: function (layerName) {
    var body = this.el.components['physx-body'];
    if (!body || !body.shapes) {
      console.warn('[floating-cube] body/shapes не готовы для слоя', layerName);
      return;
    }
    var PX = this._getPhysX();
    if (!PX || !PX.PxFilterData) {
      console.error('[floating-cube] PxFilterData недоступен');
      return;
    }

    var L = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    var bit = function (i) { return (1 << i) >>> 0; };
    var layerIndex = L[layerName];
    if (layerIndex === undefined) {
      console.error('[floating-cube] неизвестный слой', layerName);
      return;
    }

    var newWord0 = bit(layerIndex);
    // FLOAT_CUBE — барьер купола; GRAVITY_CUBE — проходит сквозь купол.
    var newWord1 = bit(L.WORLD) | bit(L.FLOAT_CUBE) | bit(L.GRAVITY_CUBE) |
                   bit(L.GRABBED_CUBE) | bit(L.BALL) | bit(L.BAT);
    if (layerName === 'FLOAT_CUBE') {
      newWord1 = newWord1 | bit(L.DOME);
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
  },

  /**
   * Качество контактов для тела кубика (один раз при инициализации, общее для
   * float и gravity). Борется с продавливанием на рёберных ударах («резиновый»
   * отскок) и со скольжением стопок. Значения — в CONFIG.floatingCubes.
   * API подтверждён по исходникам @c-frame/physx@v0.3.0 (см. ADR-14):
   *   - rb.setSolverIterationCounts(pos, vel);
   *   - rb.setRigidBodyFlag(PxRigidBodyFlag.eENABLE_SPECULATIVE_CCD, true).
   */
  _applyContactQuality: function (rb) {
    var cfg = this.cfg;
    var posIters = cfg.solverPositionIterations !== undefined ? cfg.solverPositionIterations : 16;
    var velIters = cfg.solverVelocityIterations !== undefined ? cfg.solverVelocityIterations : 4;

    if (typeof rb.setSolverIterationCounts === 'function') {
      try {
        rb.setSolverIterationCounts(posIters, velIters);
      } catch (e) {
        console.warn('[floating-cube] setSolverIterationCounts failed:', e.message);
      }
    }

    if (cfg.speculativeCCD === false) return;

    var sysPX = this._getPhysX();
    var flag = sysPX && sysPX.PxRigidBodyFlag && sysPX.PxRigidBodyFlag.eENABLE_SPECULATIVE_CCD;
    if (flag && typeof rb.setRigidBodyFlag === 'function') {
      try {
        rb.setRigidBodyFlag(flag, true);
      } catch (e) {
        console.warn('[floating-cube] speculative CCD failed:', e.message);
      }
    } else if (!flag) {
      console.warn('[floating-cube] PxRigidBodyFlag.eENABLE_SPECULATIVE_CCD недоступен');
    }
  },

  _applyGravityPhysics: function (rb) {
    var gCfg = (this.domeCfg.gravityMode) || {};
    var ld = gCfg.linearDamping !== undefined ? gCfg.linearDamping : 0.05;
    var ad = gCfg.angularDamping !== undefined ? gCfg.angularDamping : 0.05;
    var sysPX = this._getPhysX();

    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, false);
        if (typeof rb.wakeUp === 'function') rb.wakeUp();
      } catch (e) {
        console.error('[floating-cube] gravity setActorFlag failed:', e);
      }
    }

    if (typeof rb.setLinearDamping === 'function') {
      rb.setLinearDamping(ld);
    }
    if (typeof rb.setAngularDamping === 'function') {
      rb.setAngularDamping(ad);
    }

    var sleepTh = gCfg.sleepThreshold !== undefined ? gCfg.sleepThreshold : 25;
    if (typeof rb.setSleepThreshold === 'function') {
      try {
        rb.setSleepThreshold(sleepTh);
      } catch (e) {
        console.warn('[floating-cube] gravity sleepThreshold failed:', e.message);
      }
    }
  },

  /**
   * @param {boolean} applyImpulse — стартовые импульсы (true только при первом спавне).
   */
  _applyFloatPhysics: function (rb, applyImpulse) {
    if (applyImpulse === undefined) applyImpulse = true;

    var cfg = this.cfg;
    var ld = cfg.linearDamping !== undefined ? cfg.linearDamping : 0.1;
    var ad = cfg.angularDamping !== undefined ? cfg.angularDamping : 0.1;

    // === ОТКЛЮЧЕНИЕ ГРАВИТАЦИИ === (см. JSDoc, п. 2)
    var sysPX = this._getPhysX();

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

    // Стартовые импульсы — только при первом спавне, не при release снаружи.
    if (applyImpulse && typeof rb.setLinearVelocity === 'function') {
      try {
        rb.setLinearVelocity({ x: 0, y: 0, z: 0 }, true);
      } catch (e) {
        console.warn('[floating-cube] zero linear velocity failed:', e.message);
      }

      var speed = (cfg.initialImpulseSpeed !== undefined) ? cfg.initialImpulseSpeed : 0.3;
      if (speed > 0) {
        var dir = this._randomUnitVector();
        this._driftDir = { x: dir.x, y: dir.y, z: dir.z };
        var vel = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
        try {
          rb.setLinearVelocity(vel, true);
        } catch (e) {
          console.warn('[floating-cube] impulse failed:', e.message);
        }
      }

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
      }

      this._lastAppliedTimeScale = 1.0;
      this._applyTimeScaleToVelocity(rb);
    }

    if (applyImpulse) {
      console.log('[floating-cube] float physics applied. state =', this.state);
    }
  },

  /**
   * Tick-страховка: даже если setSleepThreshold(0) проигнорирован
   * биндингом, вручную будим тело в состоянии float.
   * См. JSDoc, п. 4.
   */
  tick: function () {
    var rb = this._rb;
    if (!rb) return;
    if (this.el.is && this.el.is('grabbed-dynamic')) return;

    // gravity: только обрезаем «резиновый» выброс депенетрации (см. JSDoc п.5
    // и ADR-14). Остальное (gravity, контакты, сон) — на стороне PhysX.
    if (this.state === 'gravity') {
      this._clampGravityVelocity(rb);
      return;
    }

    if (typeof rb.isSleeping === 'function' && rb.isSleeping()) {
      if (typeof rb.wakeUp === 'function') {
        rb.wakeUp();
      }
    }

    this._maintainFloatDrift(rb);
    this._applyTimeScaleToVelocity(rb);
  },

  /**
   * Обрезает линейную/угловую скорость gravity-куба до потолка из
   * CONFIG.dome.gravityMode (maxLinearSpeed / maxAngularSpeed). Это страховка
   * от «резинового» выброса при депенетрации на рёберном ударе: PhysX-биндинг
   * не даёт setMaxDepenetrationVelocity, поэтому гасим скорость постфактум.
   */
  _clampGravityVelocity: function (rb) {
    var g = this.domeCfg.gravityMode || {};
    var maxLin = (g.maxLinearSpeed !== undefined) ? g.maxLinearSpeed : 2.0;
    var maxAng = (g.maxAngularSpeed !== undefined) ? g.maxAngularSpeed : 8.0;

    try {
      if (typeof rb.getLinearVelocity === 'function' && typeof rb.setLinearVelocity === 'function') {
        var lv = rb.getLinearVelocity();
        if (lv && typeof lv.x === 'number') {
          var sp = Math.sqrt(lv.x * lv.x + lv.y * lv.y + lv.z * lv.z);
          if (sp > maxLin && sp > 1e-5) {
            var k = maxLin / sp;
            rb.setLinearVelocity({ x: lv.x * k, y: lv.y * k, z: lv.z * k }, false);
          }
        }
      }
      if (typeof rb.getAngularVelocity === 'function' && typeof rb.setAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av && typeof av.x === 'number') {
          var asp = Math.sqrt(av.x * av.x + av.y * av.y + av.z * av.z);
          if (asp > maxAng && asp > 1e-5) {
            var ka = maxAng / asp;
            rb.setAngularVelocity({ x: av.x * ka, y: av.y * ka, z: av.z * ka }, false);
          }
        }
      }
    } catch (e) {
      if (!this._clampWarned) {
        console.warn('[floating-cube] gravity velocity clamp failed:', e.message);
        this._clampWarned = true;
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
    this.el.removeEventListener('contactbegin', this._onContactBegin);
    if (this._onReady) {
      this.el.removeEventListener('body-loaded', this._onReady);
      this.el.removeEventListener('physx-body-loaded', this._onReady);
    }
  },
});