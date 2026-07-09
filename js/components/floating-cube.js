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
 *   - 'float'        — float снаружи сферы ядра, слой FLOAT_CUBE (барьер DOME);
 *   - 'float-inside' — float внутри сферы, слой FLOAT_INSIDE (сквozь DOME);
 *   - 'gravity'      — legacy; в зоне ядра больше не включается при release;
 *   - 'snapped' — деталь зафиксирована в слоте сборки, тело kinematic
 *                 (Фаза 1, шаг 1.3). Поза держится из object3D, tick её не трогает.
 *   - 'wrist-stored' — в инвентаре #leftHand (wrist-inventory.js), kinematic, полупрозрачная.
 *
 * При release (physx-grab → onGrabReleased):
 *   - важная деталь (dataset.isTarget==='true') рядом со свободным слотом
 *     механизма → СНЕП в слот (kinematic-lock), см. _trySnapToSlot;
 *   - иначе центр кубика проверяется containment-тестом купола:
 *     внутри сферы ядра → float-inside, снаружи → float-outside. Серый мусор не снепится.
 *
 * Контакт gravity-кубика с #floor → возврат в float (задача 3, Шаг 5).
 * Float: после 2–5 отскоков от стен комнаты — разворот к куполу (как red-ball).
 *
 * Снепнутая деталь (state 'snapped'): удар red-ball (BALL / WAVE_BALL) → слом
 * сборки (Фаза 1.4): releaseSlot, dynamic + breakImpulse, float/gravity по куполу.
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
    this._assemblyCfg = (typeof CONFIG !== 'undefined' && CONFIG.assembly) || {};
    this._physicsApplied = false;
    this._worldPos = new THREE.Vector3();
    // Какой timeScale уже «вшит» в текущую velocity PhysX (см. _applyTimeScaleToVelocity).
    this._lastAppliedTimeScale = 1.0;
    this._driftDir = null; // единичный вектор «полной» скорости дрейфа (для trail seed)
    this._tickDeltaSec = 1 / 60;
    this._gravityScaleDiagDone = false;
    this._physxGravityOffForSloMo = false;
    this._onContactBegin = this._onContactBegin.bind(this);
    this._onStateAdded = this._onStateAdded.bind(this);
    // Slo-mo: удар grabbed-кубом/битой — перенаправление без разгона (как шар).
    this._preHitWorldSpeed = 0;
    this._strikerClampUntilMs = 0;
    this._strikerClampSpeed = 0;
    this._strikeCfg = (typeof CONFIG !== 'undefined' && CONFIG.inHandStrike) || {};
    // Снеп в слот сборки (Фаза 1, шаг 1.3).
    this._assemblyCore = null;
    this._snappedSlotId = null;
    // fixed — предустановленная деталь (сложность): несбиваемая, неснимаемая.
    this._isFixed = false;
    this._spawnImpulseAt = 0;
    this._beginSteerCycle();

    // Подписка на возможные события готовности тела (план А).
    var onReady = this._tryApply.bind(this);
    this.el.addEventListener('body-loaded', onReady);
    this.el.addEventListener('physx-body-loaded', onReady);
    this._onReady = onReady;

    // Поллинг rigidBody (план Б, основной — см. JSDoc, п. 1).
    this._pollStartTime = performance.now();
    this._pollIntervalId = setInterval(this._tryApply.bind(this), 100);

    if (typeof window.applyGameplayRenderOrder === 'function') {
      window.applyGameplayRenderOrder(this.el);
    }
  },

  play: function () {
    this.el.addEventListener('contactbegin', this._onContactBegin);
    // Захват снепнутой детали рукой → ручное разъединение (см. _onStateAdded).
    this.el.addEventListener('stateadded', this._onStateAdded);
  },

  pause: function () {
    this.el.removeEventListener('contactbegin', this._onContactBegin);
    this.el.removeEventListener('stateadded', this._onStateAdded);
  },

  /**
   * Игрок схватил рукой деталь, уже стоящую в слоте → отщёлкиваем её из слота
   * (Фаза 1: ручной разбор сборки; пригодится для деталей-обманок). physx-grab
   * вешает состояние 'grabbed-dynamic' при захвате; ловим его и возвращаем тело
   * в dynamic, слот освобождаем. Дальше работает обычный захват/release.
   *
   * РИСК (на проверку в Quest): рука — kinematic, снепнутая деталь — kinematic.
   * Если PhysX не генерит контакт для пары kinematic↔kinematic, захват детали не
   * сработает и сюда мы не попадём — тогда нужен запасной путь (proximity-grab).
   */
  _onStateAdded: function (evt) {
    var st = (evt.detail && evt.detail.state) ? evt.detail.state : evt.detail;
    if (st !== 'grabbed-dynamic') return;
    if (this.state !== 'snapped') return;
    if (this._isFixed) return; // предустановленную / time-locked деталь рукой не снять
    this._unsnapFromSlot({ cascade: true });
  },

  /**
   * Снять деталь со слота. cascade:true — сорвать все стадии выше по цепочке A→B→C.
   * skipEmit:true — не слать stage-unsnapped (каскад шлёт сам по каждой).
   */
  _unsnapFromSlot: function (opts) {
    opts = opts || {};
    var slotId = this._snappedSlotId;
    var stageId = this._stageIdFromSlot(slotId);
    var core = this._getAssemblyCore();
    var order = 0;
    if (core && slotId && typeof core.getSlotOrder === 'function') {
      order = core.getSlotOrder(slotId);
    }

    if (opts.cascade && core && typeof core.getOccupiedAboveOrder === 'function') {
      this._cascadeUnsnapAbove(core, order);
    }

    if (core && slotId && typeof core.releaseSlot === 'function') {
      core.releaseSlot(slotId);
    }
    this._snappedSlotId = null;
    this._isFixed = false;
    if (this.el.dataset) delete this.el.dataset.fixed;

    if (!opts.skipEmit) this._emitStageUnsnapped(stageId, slotId);

    this._reparentToFloatingRoot();
    this.state = 'float';
    this._lastAppliedTimeScale = 1.0;
    this.el.setAttribute('physx-body', 'type: dynamic');
    this._resetKinematicLatch();
    this._setPartVisual('floating');
    console.log('[floating-cube] un-snapped', this.el.id || '(no id)',
      opts.cascade ? '(cascade root)' : '');
  },

  /** Сорвать все детали с order > afterOrder (кончик цепочки первым). */
  _cascadeUnsnapAbove: function (core, afterOrder) {
    var above = core.getOccupiedAboveOrder(afterOrder);
    var i;
    for (i = 0; i < above.length; i++) {
      var entry = above[i];
      var el = entry.el;
      if (!el || el === true || !el.components) continue;
      var fc = el.components['floating-cube'];
      if (!fc || fc.state !== 'snapped') continue;
      if (fc._isFixed) continue;
      fc._breakSnapLoose();
    }
  },

  /**
   * Сорвать снеп без каскада (для деталей выше по цепочке / break от шара).
   * Импульс не даём — деталь просто отпускается в float.
   */
  _breakSnapLoose: function () {
    if (this.state !== 'snapped') return;
    if (this._isFixed) return;

    var slotId = this._snappedSlotId;
    var stageId = this._stageIdFromSlot(slotId);
    var core = this._getAssemblyCore();
    if (core && slotId && typeof core.releaseSlot === 'function') {
      core.releaseSlot(slotId);
    }
    this._snappedSlotId = null;
    this._emitStageUnsnapped(stageId, slotId);
    this._reparentToFloatingRoot();

    this.el.setAttribute('physx-body', 'type: dynamic');
    this._resetKinematicLatch();

    var pos = this._getWorldPosition();
    var inside = this._isInsideDome(pos, true);
    if (inside) {
      this._enterFloatInsideMode(false);
    } else {
      this._enterFloatMode(false);
    }
    this._setPartVisual('floating');
    console.log('[floating-cube] cascade unsnap', this.el.id || '(no id)');
  },

  _emitStageUnsnapped: function (stageId, slotId) {
    if (!stageId || !this.el.sceneEl) return;
    this.el.sceneEl.emit('stage-unsnapped', {
      stageId: stageId,
      slotId: slotId || null,
    }, false);
  },

  /** Закрепить снепнутую деталь «временем» (после travel) — несбиваемая. */
  lockToTime: function () {
    if (this.state !== 'snapped') return false;
    this._isFixed = true;
    if (this.el.dataset) this.el.dataset.fixed = 'true';
    this._setPartVisual('snapped');
    return true;
  },

  /** Визуальное состояние GLB-детали (3.5B.3, part-entity). */
  _setPartVisual: function (state) {
    var pe = this.el.components['part-entity'];
    if (pe && typeof pe.setVisualState === 'function') {
      pe.setVisualState(state);
    }
  },

  /** red-ball (обычный или волна WAVE_BALL) — опасный объект для слома снепа. */
  _isDangerBall: function (otherEl) {
    return !!(otherEl && otherEl.components && otherEl.components['red-ball']);
  },

  /**
   * Направление разлёта детали при сломе: курс шара (world-space) или
   * вектор шар→куб, если шар почти стоит.
   */
  _getBallBreakDir: function (otherEl) {
    var ball = otherEl && otherEl.components && otherEl.components['red-ball'];
    var ballRb = ball && ball._rb;
    if (ballRb && typeof ballRb.getLinearVelocity === 'function') {
      var prev = ball._lastAppliedTimeScale;
      if (!prev || prev < 0.001) prev = 1.0;
      var invPrev = 1 / prev;
      try {
        var lv = ballRb.getLinearVelocity();
        if (lv) {
          var fx = lv.x * invPrev;
          var fy = lv.y * invPrev;
          var fz = lv.z * invPrev;
          var speed = Math.sqrt(fx * fx + fy * fy + fz * fz);
          if (speed > 0.05) {
            return { x: fx / speed, y: fy / speed, z: fz / speed };
          }
        }
      } catch (e) { /* fallback below */ }
    }

    if (!otherEl || !otherEl.object3D) return { x: 0, y: 0, z: -1 };
    otherEl.object3D.getWorldPosition(this._worldPos);
    var bx = this._worldPos.x;
    var by = this._worldPos.y;
    var bz = this._worldPos.z;
    this.el.object3D.getWorldPosition(this._worldPos);
    var dx = this._worldPos.x - bx;
    var dy = this._worldPos.y - by;
    var dz = this._worldPos.z - bz;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-5) return { x: 0, y: 0, z: -1 };
    return { x: dx / len, y: dy / len, z: dz / len };
  },

  /** Мировая скорость шара (до timeScale) для усиления импульса слома. */
  _getBallWorldSpeed: function (otherEl) {
    var ball = otherEl && otherEl.components && otherEl.components['red-ball'];
    var ballRb = ball && ball._rb;
    if (!ballRb || typeof ballRb.getLinearVelocity !== 'function') return 0;
    var prev = ball._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;
    try {
      var lv = ballRb.getLinearVelocity();
      if (!lv) return 0;
      var fx = lv.x * invPrev;
      var fy = lv.y * invPrev;
      var fz = lv.z * invPrev;
      return Math.sqrt(fx * fx + fy * fy + fz * fz);
    } catch (e) {
      return 0;
    }
  },

  /**
   * Шар сбил снепнутую деталь: освободить слот, dynamic, импульс breakImpulse,
   * state float/gravity по containment (как onGrabReleased без снепа).
   */
  _breakSnapFromHit: function (otherEl) {
    if (this.state !== 'snapped') return;
    if (this._isFixed) return;

    this._setPartVisual('broken');

    var slotId = this._snappedSlotId;
    var stageId = this._stageIdFromSlot(slotId);
    var core = this._getAssemblyCore();
    var order = 0;
    if (core && slotId && typeof core.getSlotOrder === 'function') {
      order = core.getSlotOrder(slotId);
    }
    if (core && typeof core.getOccupiedAboveOrder === 'function') {
      this._cascadeUnsnapAbove(core, order);
    }
    if (core && slotId && typeof core.releaseSlot === 'function') {
      core.releaseSlot(slotId);
    }
    this._snappedSlotId = null;
    this._emitStageUnsnapped(stageId, slotId);
    this._reparentToFloatingRoot();

    this.el.setAttribute('physx-body', 'type: dynamic');
    this._resetKinematicLatch();

    var pos = this._getWorldPosition();
    var inside = this._isInsideDome(pos, true);
    if (inside) {
      this._enterFloatInsideMode(false);
    } else {
      this._enterFloatMode(false);
    }

    var rb = this._rb;
    if (rb) {
      var dir = this._getBallBreakDir(otherEl);
      var asm = this._assemblyCfg;
      var base = asm.breakImpulse !== undefined ? asm.breakImpulse : 1.5;
      var ballSp = this._getBallWorldSpeed(otherEl);
      var impulse = Math.max(base, base + ballSp * 0.35);

      try {
        if (typeof rb.wakeUp === 'function') rb.wakeUp();
        if (typeof rb.setLinearVelocity === 'function') {
          rb.setLinearVelocity({
            x: dir.x * impulse,
            y: dir.y * impulse,
            z: dir.z * impulse,
          }, false);
          this._lastAppliedTimeScale = 1.0;
          this._applyTimeScaleToVelocity(rb);
          if (this.state === 'float' || this.state === 'float-inside') {
            this._driftDir = { x: dir.x, y: dir.y, z: dir.z };
          }
        }
      } catch (e) {
        console.warn('[floating-cube] break snap impulse failed:', e.message);
      }
    }

    console.log(
      '[floating-cube] break snap from ball',
      this.el.id || '(no id)',
      inside ? '→ float-inside' : '→ float'
    );
  },

  /**
   * Сброс защёлки physx-body.setKinematic.
   *
   * @c-frame/physx@0.3.0 выставляет флаг eKINEMATIC в tock() ОДИН раз:
   * `if (type === 'kinematic' && !this.setKinematic) { eKINEMATIC=true; setKinematic=true }`
   * (physics.js, ~стр.1257). Обратно защёлку не сбрасывает. Поэтому без этого
   * сброса ПОВТОРНЫЙ снеп (type→kinematic) не станет настоящим kinematic: тело
   * останется dynamic, визуал (object3D) разойдётся с физ-телом → объекты проходят
   * сквозь деталь и её нельзя снова взять рукой. Сбрасываем при возврате в dynamic.
   */
  _resetKinematicLatch: function () {
    var bodyComp = this.el.components['physx-body'];
    if (bodyComp) bodyComp.setKinematic = false;
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
    this._rb = rb;
    this._applyContactQuality(rb);

    var startSnapped = this.el.dataset && this.el.dataset.startSnapped === 'true' &&
      this.el.dataset.startSlot;

    if (startSnapped) {
      this.snapToSlotById(this.el.dataset.startSlot, true);
      this._physicsApplied = true;
      if (this._pollIntervalId) {
        clearInterval(this._pollIntervalId);
        this._pollIntervalId = null;
      }
      return;
    }

    this._reclampSpawnPosition();
    this._applyFloatPhysics(rb, false);
    this._zeroBodyMotion(rb);

    var spawnCfg = (typeof CONFIG !== 'undefined' && CONFIG.spawn) || {};
    var delay = spawnCfg.impulseDelayMs !== undefined ? spawnCfg.impulseDelayMs : 200;
    this._spawnImpulseAt = performance.now() + delay;

    this._physicsApplied = true;

    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  /**
   * Вызывается из physx-grab при отпускании кубика.
   * Сначала пытаемся снепнуть важную деталь в слот (1.3); иначе
   * containment-тест по CONFIG.dome → gravity или float.
   */
  onGrabReleased: function () {
    if (this.el.dataset && this.el.dataset.wristStorePending === 'true') {
      return;
    }

    // Time-locked / уже в слоте: не уводить в float (иначе отваливается от ring).
    if (this._isFixed && this.state === 'snapped') {
      this._followSlot();
      this._forceKinematicFlag();
      return;
    }
    if (this.state === 'snapped' && this._snappedSlotId) {
      this._followSlot();
      this._forceKinematicFlag();
      return;
    }

    // После joint velocity в теле «полная» — сброс для корректного масштабирования.
    this._lastAppliedTimeScale = 1.0;

    // Важная деталь рядом со свободным слотом → снеп (Фаза 1, шаг 1.3).
    if (this._trySnapToSlot()) return;

    var pos = this._getWorldPosition();
    var inside = this._isInsideDome(pos, true);

    if (inside) {
      this._enterFloatInsideMode(false);
    } else {
      this._enterFloatMode(false);
    }

    console.log(
      '[floating-cube] release', this.el.id || '(no id)',
      inside ? 'inside → float-inside' : 'outside → float'
    );
  },

  /** Компонент assembly-core (#assembly-core), с кэшем. */
  _getAssemblyCore: function () {
    var c = this._assemblyCore;
    if (c && c.el && c.el.isConnected) return c;
    var el = document.getElementById('assembly-core');
    this._assemblyCore = (el && el.components && el.components['assembly-core']) || null;
    return this._assemblyCore;
  },

  /**
   * Снеп важной детали в ближайший свободный слот при release.
   * Серый мусор (dataset.isTarget!=='true') не снепится.
   * @returns {boolean} true — деталь снепнута (containment-логику пропускаем).
   */
  _trySnapToSlot: function () {
    if (!this.el.dataset || this.el.dataset.isTarget !== 'true') return false;
    var core = this._getAssemblyCore();
    if (!core || typeof core.findFreeSlotNear !== 'function') return false;

    var partId = this.el.dataset && this.el.dataset.partId;
    var slot = core.findFreeSlotNear(this._getWorldPosition(), partId);
    if (!slot) return false;

    this._snapToSlot(core, slot);
    return true;
  },

  /**
   * Ставит деталь в МИРОВУЮ позу слота и замораживает её kinematic-телом.
   *
   * БЕЗ DOM-реперента под #assembly-core: перевес entity рушит physx-тело
   * (@c-frame/physx дёргает disconnectedCallback → remove body → «table index
   * out of bounds», деталь теряет kinematic и улетает). Деталь остаётся под
   * #floating-cubes-root; co-rotation даёт tick (_followSlot): каждый кадр
   * ставим деталь в текущую мировую позу слота, который крутится с ring_inner.
   */
  _snapToSlot: function (core, slot, fixed) {
    this._setObjWorldPose(slot.position, slot.quaternion);

    this.state = 'snapped';
    this._snappedSlotId = slot.slotId;
    this._isFixed = !!fixed;
    if (fixed) this.el.dataset.fixed = 'true';
    this.el.setAttribute('physx-body', 'type: kinematic');
    this._forceKinematicFlag();
    core.occupySlot(slot.slotId, this.el);
    this._setPartVisual('snapped');
    // Сразу привязать к слоту — до travel-ready / freeze в том же кадре.
    this._followSlot();

    console.log('[floating-cube] snapped', this.el.id || '(no id)', '→ slot',
      slot.slotId, fixed ? '(fixed)' : '');

    var stageId = this._stageIdFromSlot(slot.slotId);
    if (stageId && this.el.sceneEl) {
      this.el.sceneEl.emit('stage-snapped', {
        stageId: stageId,
        slotId: slot.slotId,
        fixed: !!fixed,
      }, false);
    }
  },

  /** stageId из slotId (slot_A → A) через session или префикс. */
  _stageIdFromSlot: function (slotId) {
    if (!slotId) return null;
    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    if (session && session.assemblySlots) {
      var i;
      for (i = 0; i < session.assemblySlots.length; i++) {
        var s = session.assemblySlots[i];
        if (s.id === slotId) return s.stageId || null;
      }
    }
    if (slotId.indexOf('slot_') === 0) return slotId.slice(5);
    return null;
  },

  /**
   * Принудительно выставляет флаг eKINEMATIC на теле детали.
   *
   * Биндинг ставит его в tock только по латчу (type==='kinematic' &&
   * !setKinematic), но после снепа этот путь не всегда срабатывает — тело
   * остаётся dynamic и physx пишет мировую позу в локальный object3D. Дожимаем
   * флаг явно, чтобы деталь стала настоящим kinematic и держалась позой.
   */
  _forceKinematicFlag: function () {
    var bodyComp = this.el.components['physx-body'];
    var rb = (bodyComp && bodyComp.rigidBody) || this._rb;
    if (!rb || typeof rb.setRigidBodyFlag !== 'function') return;
    var PX = this._getPhysX();
    var flag = PX && PX.PxRigidBodyFlag && PX.PxRigidBodyFlag.eKINEMATIC;
    if (!flag) return;
    try {
      rb.setRigidBodyFlag(flag, true);
      if (bodyComp) bodyComp.setKinematic = true;
    } catch (e) {
      console.warn('[floating-cube] force kinematic failed:', e.message);
    }
  },

  /** Ставит object3D детали в заданную МИРОВУЮ позу (с учётом родителя). */
  _setObjWorldPose: function (wp, wq) {
    var obj = this.el.object3D;
    var parent = obj.parent;
    if (parent) {
      parent.updateMatrixWorld(true);
      obj.position.copy(parent.worldToLocal(wp.clone()));
      var pq = this._tmpParentQuat || (this._tmpParentQuat = new THREE.Quaternion());
      parent.getWorldQuaternion(pq);
      obj.quaternion.copy(pq.invert().multiply(wq));
    } else {
      obj.position.copy(wp);
      obj.quaternion.copy(wq);
    }
    obj.updateMatrixWorld(true);
  },

  /** Удержание снепнутой детали в текущей мировой позе её слота (co-rotation). */
  _followSlot: function () {
    if (!this._snappedSlotId) return;
    var core = this._getAssemblyCore();
    if (!core || typeof core.getSlotPose !== 'function') return;
    var slot = core.getSlotPose(this._snappedSlotId);
    if (!slot) return;
    this._setObjWorldPose(slot.position, slot.quaternion);
    // Kinematic PhysX: синхрон позы тела со слотом (после неудачного grab).
    var body = this.el.components['physx-body'];
    if (body && typeof body.resetBodyPose === 'function') {
      body.resetBodyPose();
    }
  },

  /** Снеп напрямую в слот по id (предустановленные детали на старте). */
  snapToSlotById: function (slotId, fixed) {
    var core = this._getAssemblyCore();
    if (!core || typeof core.getSlotPose !== 'function') return false;
    var slot = core.getSlotPose(slotId);
    if (!slot) return false;
    this._snapToSlot(core, slot, fixed);
    return true;
  },

  /** Вернуть деталь под #floating-cubes-root, сохранив мировую позу. */
  _reparentToFloatingRoot: function () {
    var root = document.getElementById('floating-cubes-root');
    if (!root || this.el.parentNode === root) return;
    var obj = this.el.object3D;
    var wp = new THREE.Vector3();
    var wq = new THREE.Quaternion();
    obj.getWorldPosition(wp);
    obj.getWorldQuaternion(wq);
    root.appendChild(this.el);
    var parent = root.object3D;
    parent.updateMatrixWorld(true);
    obj.position.copy(parent.worldToLocal(wp.clone()));
    var pq = new THREE.Quaternion();
    parent.getWorldQuaternion(pq);
    obj.quaternion.copy(pq.invert().multiply(wq));
    obj.updateMatrixWorld(true);
  },

  _enterFloatInsideMode: function (applyImpulse) {
    this.state = 'float-inside';
    this._beginSteerCycle();
    var rb = this._rb;
    if (!rb) return;
    this._applyFloatPhysics(rb, applyImpulse);
    this._applyCubeMaterial('float-inside');
    this._setCollisionLayer('FLOAT_INSIDE');
  },

  _enterGravityMode: function () {
    this.state = 'gravity';
    var rb = this._rb;
    if (!rb) return;
    this._lastAppliedTimeScale = 1.0;
    this._applyGravityPhysics(rb);
    this._applyCubeMaterial('gravity');
    this._setCollisionLayer('GRAVITY_CUBE');
    if (this._useGravityTimeScale()) {
      this._logGravityScaleDiag(rb);
    }
  },

  /**
   * gravity-кубик коснулся #floor → снова float + импульс вверх.
   * Контакт со столом (пьедестал) не обрабатывается — у него другой id.
   */
  _onContactBegin: function (evt) {
    var otherComp = evt.detail.otherComponent;
    var otherEl = otherComp && otherComp.el;

    // Фаза 1.4: шар (BALL / WAVE_BALL) сбивает снепнутую деталь со слота.
    if (this.state === 'snapped' && this._isDangerBall(otherEl)) {
      if (this._isFixed) return; // предустановленную деталь шаром не сбить
      this._breakSnapFromHit(otherEl);
      return;
    }

    // Striker в руке — обрабатываем жертву здесь (надёжнее victim-side).
    if (this.el.is && this.el.is('grabbed-dynamic')) {
      this._applyGrabbedStrikeToVictim(otherComp, otherEl);
    }

    // Victim-side (backup): slo-mo — только перенаправление от grabbed-удара.
    if (otherEl && this._isGrabbedStriker(otherEl) && this._rb && this._isWorldSlowMo()) {
      this.receiveGrabbedStrikerHit();
    }

    if (this.state === 'float') {
      this._handleFloatWallSteer(otherComp);
      return;
    }

    if (this.state !== 'gravity') return;

    // Страховка пробуждения: уснувшую стопку должен будить новый контакт
    var rb = this._rb;
    if (rb && typeof rb.wakeUp === 'function') {
      rb.wakeUp();
    }

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
    this._beginSteerCycle();
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
   * Центр кубика внутри сферы ядра?
   */
  _isInsideDome: function (pos, forRelease) {
    var halfCube = (this.cfg.size !== undefined ? this.cfg.size : 0.1) / 2;
    if (typeof window.isInsideAssemblySphere === 'function') {
      return window.isInsideAssemblySphere(pos, forRelease, halfCube);
    }

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

  _isWorldSlowMo: function () {
    var sys = this.el.sceneEl.systems['time-scale'];
    if (!sys || typeof sys.isWorldSlowMo !== 'function') {
      return this._getTimeScale() < 0.999;
    }
    return sys.isWorldSlowMo();
  },

  /** Новый цикл homing: случайно 2–5 пропусков отскока до разворота к куполу. */
  _beginSteerCycle: function () {
    var steer = this.cfg.steerTowardDome || {};
    var min = steer.bounceDelayMin !== undefined ? steer.bounceDelayMin : 2;
    var max = steer.bounceDelayMax !== undefined ? steer.bounceDelayMax : 5;
    if (max < min) { var tmp = min; min = max; max = tmp; }
    this._steerBounceDelay = min + Math.floor(Math.random() * (max - min + 1));
    this._wallBounceCount = 0;
  },

  _getDomeTarget: function () {
    if (typeof window.getAssemblySphereTarget === 'function') {
      return window.getAssemblySphereTarget();
    }
    var dome = this.domeCfg || {};
    return {
      x: 0,
      y: dome.centerY !== undefined ? dome.centerY : 1.15,
      z: 0,
    };
  },

  _directionTowardDome: function () {
    this.el.object3D.getWorldPosition(this._worldPos);
    var t = this._getDomeTarget();
    var dx = t.x - this._worldPos.x;
    var dy = t.y - this._worldPos.y;
    var dz = t.z - this._worldPos.z;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-4) {
      return { x: 0, y: -0.3, z: 0.96 };
    }
    return { x: dx / len, y: dy / len, z: dz / len };
  },

  /** Отскок от стен комнаты — да; кольца ядра и сфера DOME — нет (homing). */
  _isRoomWallContact: function (otherEl) {
    if (!otherEl) return false;
    var node = otherEl;
    while (node) {
      if (node.dataset && node.dataset.orbitRingSegment !== undefined) return false;
      if (node.id === 'dome-collider') return false;
      if (node.id && node.id.indexOf('orbit-ring-') === 0) return false;
      node = node.parentElement;
    }
    return true;
  },

  _setVelocityDirectionTowardDome: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var toward = this._directionTowardDome();
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;
    var minSp = this.cfg.minDriftSpeed !== undefined ? this.cfg.minDriftSpeed : 0.28;

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return;

      var fx = lv.x * invPrev;
      var fy = lv.y * invPrev;
      var fz = lv.z * invPrev;
      var speed = Math.sqrt(fx * fx + fy * fy + fz * fz);
      if (speed < minSp) speed = minSp;

      fx = toward.x * speed;
      fy = toward.y * speed;
      fz = toward.z * speed;
      rb.setLinearVelocity({ x: fx, y: fy, z: fz }, false);
      this._lastAppliedTimeScale = 1.0;
      this._driftDir = { x: toward.x, y: toward.y, z: toward.z };
    } catch (e) {
      if (!this._steerWarned) {
        console.warn('[floating-cube] steer toward dome failed:', e.message);
        this._steerWarned = true;
      }
    }
  },

  _handleFloatWallSteer: function (otherComp) {
    if (!otherComp || otherComp.data.type !== 'static') return;
    if (!this._isRoomWallContact(otherComp.el)) return;

    var rb = this._rb;
    if (!rb) return;

    if (typeof isRoomDomeWallElement === 'function' && isRoomDomeWallElement(otherComp.el)) {
      var half = (this.cfg.size !== undefined ? this.cfg.size : 0.1) / 2;
      if (typeof bounceOffRoomDomeWall === 'function' &&
          bounceOffRoomDomeWall(this.el, rb, half, this._getWallBounceOpts())) {
        this._lastAppliedTimeScale = 1.0;
      }
      return;
    }

    this._wallBounceCount++;
    if (this._wallBounceCount <= this._steerBounceDelay) {
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
      return;
    }

    this._setVelocityDirectionTowardDome(rb);
    this._beginSteerCycle();
    if (typeof rb.wakeUp === 'function') rb.wakeUp();
  },

  _getWallBounceOpts: function () {
    var prev = this._lastAppliedTimeScale;
    return {
      worldVelInvScale: prev > 0.001 ? 1 / prev : 1,
      minBounceSpeed: this.cfg.minDriftSpeed !== undefined ? this.cfg.minDriftSpeed : 0.28,
    };
  },

  /** Радиус для room-containment: dataset.spawnRadius (из _COL) или size/2. */
  _getBodyHalf: function () {
    var ds = this.el.dataset && this.el.dataset.spawnRadius;
    if (ds !== undefined && ds !== '') {
      var r = parseFloat(ds);
      if (!isNaN(r) && r > 0) return r;
    }
    return (this.cfg.size !== undefined ? this.cfg.size : 0.1) / 2;
  },

  _spawnRadiusForClamp: function () {
    var r = this._getBodyHalf();
    var spawnCfg = (typeof CONFIG !== 'undefined' && CONFIG.spawn) || {};
    var mult = spawnCfg.radiusSafetyMult !== undefined ? spawnCfg.radiusSafetyMult : 1.1;
    return r * mult;
  },

  _reclampSpawnPosition: function () {
    if (typeof clampPositionToRoomDome !== 'function') return;
    var r = this._spawnRadiusForClamp();
    var wp = this._getWorldPosition();
    var clamped = clampPositionToRoomDome({ x: wp.x, y: wp.y, z: wp.z }, r);
    var parent = this.el.object3D.parent;
    if (parent) {
      parent.updateMatrixWorld(true);
      var tmp = new THREE.Vector3(clamped.x, clamped.y, clamped.z);
      this.el.object3D.position.copy(parent.worldToLocal(tmp));
    } else {
      this.el.object3D.position.set(clamped.x, clamped.y, clamped.z);
    }
    this.el.object3D.updateMatrixWorld(true);
  },

  _zeroBodyMotion: function (rb) {
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

  _applySpawnImpulse: function (rb) {
    if (!rb) return;
    var cfg = this.cfg;
    var speed = (cfg.initialImpulseSpeed !== undefined) ? cfg.initialImpulseSpeed : 0.3;
    if (speed > 0 && typeof rb.setLinearVelocity === 'function') {
      var dir = this._randomUnitVector();
      this._driftDir = { x: dir.x, y: dir.y, z: dir.z };
      try {
        rb.setLinearVelocity({
          x: dir.x * speed, y: dir.y * speed, z: dir.z * speed,
        }, true);
      } catch (e) {
        console.warn('[floating-cube] impulse failed:', e.message);
      }
    }
    if (typeof rb.setAngularVelocity === 'function') {
      var angSpeed = (cfg.initialAngularSpeed !== undefined) ? cfg.initialAngularSpeed : 0.8;
      if (angSpeed > 0) {
        var axis = this._randomUnitVector();
        try {
          rb.setAngularVelocity({
            x: axis.x * angSpeed, y: axis.y * angSpeed, z: axis.z * angSpeed,
          }, true);
        } catch (e) {
          console.warn('[floating-cube] angular velocity failed:', e.message);
        }
      }
    }
    if (typeof rb.wakeUp === 'function') rb.wakeUp();
    this._lastAppliedTimeScale = 1.0;
    this._applyTimeScaleToVelocity(rb);
    console.log('[floating-cube] spawn impulse on', this.el.id || '(no id)');
  },

  _applyRoomWallBounceTick: function (rb, bodyHalf) {
    var bounceOpts = this._getWallBounceOpts();
    if (typeof enforceRoomDomeContainment === 'function') {
      if (enforceRoomDomeContainment(this.el, rb, bodyHalf, bounceOpts) === 'sphere') {
        this._lastAppliedTimeScale = 1.0;
      }
    }
    if (typeof enforceRoomDomeWallBounce === 'function' &&
        enforceRoomDomeWallBounce(this.el, rb, bodyHalf, bounceOpts)) {
      this._lastAppliedTimeScale = 1.0;
    }
  },

  /** Куб или бита в захвате — «ударная» рука. */
  _isGrabbedStriker: function (el) {
    if (!el || !el.is || !el.is('grabbed-dynamic')) return false;
    return !!(el.components['floating-cube'] || el.components['ball-bat']);
  },

  /** «Мировая» скорость до timeScale-масштабирования. */
  _currentWorldSpeed: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return 0;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;
    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return 0;
      var fx = lv.x * invPrev;
      var fy = lv.y * invPrev;
      var fz = lv.z * invPrev;
      return Math.sqrt(fx * fx + fy * fy + fz * fz);
    } catch (e) {
      return 0;
    }
  },

  /**
   * Slo-mo: отскок от grabbed-куба/биты — направление солвера, величина до удара.
   * Kinematic-рука разгоняет жертву несколько кадров — держим clamp в tick.
   */
  _deflectOffGrabbedStriker: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;
    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return;

      var rawSpeed = Math.sqrt(lv.x * lv.x + lv.y * lv.y + lv.z * lv.z);
      var nx; var ny; var nz;
      if (rawSpeed > 1e-5) {
        nx = lv.x / rawSpeed; ny = lv.y / rawSpeed; nz = lv.z / rawSpeed;
      } else {
        nx = 0; ny = 1; nz = 0;
      }

      var target = this._preHitWorldSpeed;
      if (target < 0) target = 0;

      if (typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({ x: nx * target, y: ny * target, z: nz * target }, false);
        this._lastAppliedTimeScale = 1.0;
      }
      if (typeof rb.wakeUp === 'function') rb.wakeUp();

      var clampMs = this._strikeCfg.sloMoDeflectClampMs !== undefined
        ? this._strikeCfg.sloMoDeflectClampMs : 250;
      this._strikerClampSpeed = target;
      this._strikerClampUntilMs = performance.now() + clampMs;
    } catch (e) {
      if (!this._strikerDeflectWarned) {
        console.warn('[floating-cube] striker deflect failed:', e.message);
        this._strikerDeflectWarned = true;
      }
    }
  },

  /** Окно после slo-mo удара: удерживаем доударную скорость, направление — от солвера. */
  _clampStrikerDeflect: function (rb) {
    if (performance.now() >= this._strikerClampUntilMs) return false;
    if (!rb || typeof rb.getLinearVelocity !== 'function') return false;
    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return false;
      var rawSpeed = Math.sqrt(lv.x * lv.x + lv.y * lv.y + lv.z * lv.z);
      if (rawSpeed < 1e-5) return true;

      var ts = this._getTimeScale();
      var targetRaw = this._strikerClampSpeed * ts;
      var scale = targetRaw / rawSpeed;

      if (typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({
          x: lv.x * scale,
          y: lv.y * scale,
          z: lv.z * scale,
        }, false);
        this._lastAppliedTimeScale = ts;
      }
    } catch (e) {
      if (!this._strikerClampWarned) {
        console.warn('[floating-cube] striker clamp failed:', e.message);
        this._strikerClampWarned = true;
      }
    }
    return true;
  },

  /** Вызывается striker-side или victim-side; не дублирует активный clamp. */
  receiveGrabbedStrikerHit: function () {
    if (performance.now() < this._strikerClampUntilMs) return;
    if (this._rb) this._deflectOffGrabbedStriker(this._rb);
  },

  /** Grabbed-куб/бита в руке ударила dynamic-жертву в slo-mo. */
  _applyGrabbedStrikeToVictim: function (otherComp, otherEl) {
    if (!otherEl || !otherComp || otherComp.data.type === 'static') return;
    if (!this._isWorldSlowMo()) return;
    if (otherEl.components['red-ball']) return;

    var fc = otherEl.components['floating-cube'];
    if (fc && typeof fc.receiveGrabbedStrikerHit === 'function') {
      fc.receiveGrabbedStrikerHit();
      return;
    }

    var bat = otherEl.components['ball-bat'];
    if (bat && !bat._grabbed && typeof bat.receiveGrabbedStrikerHit === 'function') {
      bat.receiveGrabbedStrikerHit();
    }
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
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7, WAVE_BALL: 8, FLOAT_INSIDE: 9,
    };
    var list = [L.WORLD, L.FLOAT_CUBE, L.GRAVITY_CUBE, L.GRABBED_CUBE, L.BALL, L.BAT];
    if (layerName === 'FLOAT_CUBE') {
      list.splice(1, 0, L.DOME);
    }
    if (layerName === 'FLOAT_INSIDE') {
      list.push(L.FLOAT_INSIDE);
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
    var layerName = 'FLOAT_CUBE';
    if (mode === 'gravity') layerName = 'GRAVITY_CUBE';
    if (mode === 'float-inside') layerName = 'FLOAT_INSIDE';
    var L = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7, WAVE_BALL: 8, FLOAT_INSIDE: 9,
    };

    // contactOffset — раннее обнаружение контакта (меньше проникновения и
    // «резинового» выброса депенетрации). Float — floatContactOffset (шары малы).
    var co = -1;
    if (mode !== 'gravity' && this.cfg.floatContactOffset !== undefined) {
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
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7, WAVE_BALL: 8, FLOAT_INSIDE: 9,
    };
    var bit = function (i) { return (1 << i) >>> 0; };
    var layerIndex = L[layerName];
    if (layerIndex === undefined) {
      console.error('[floating-cube] неизвестный слой', layerName);
      return;
    }

    var newWord0 = bit(layerIndex);
    var newWord1 = bit(L.WORLD) | bit(L.FLOAT_CUBE) | bit(L.GRAVITY_CUBE) |
                   bit(L.GRABBED_CUBE) | bit(L.BALL) | bit(L.BAT) | bit(L.FLOAT_INSIDE);
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
   * Tick-страховка: float — wakeUp + drift + timeScale.
   * gravity — timeScale (ADR-12 v2) + clamp; grabbed — realtime (early return).
   */
  tick: function (time, timeDelta) {
    this._tickDeltaSec = Math.min((timeDelta || 16) / 1000, 0.1);

    // Co-rotation первым: снепнутые детали крутятся с ring_inner даже при
    // travel-freeze и до готовности rb / снятия grabbed-dynamic.
    if (this.state === 'snapped') {
      this._followSlot();
      return;
    }
    if (this.state === 'wrist-stored') {
      return;
    }

    var rb = this._rb;
    if (!rb) return;
    if (this.el.is && this.el.is('grabbed-dynamic')) return;

    if (typeof window.isVictoryFrozen === 'function' && window.isVictoryFrozen()) {
      return;
    }

    if (this._spawnImpulseAt) {
      if (performance.now() < this._spawnImpulseAt) {
        this._zeroBodyMotion(rb);
        return;
      }
      this._spawnImpulseAt = 0;
      this._applySpawnImpulse(rb);
    }

    if (this.state === 'float-inside') {
      var posIn = this._getWorldPosition();
      if (!this._isInsideDome(posIn, false)) {
        this._enterFloatMode(false);
      }
    }

    if (this.state === 'gravity') {
      if (this._useGravityTimeScale()) {
        this._tickGravityWithTimeScale(rb);
      } else {
        this._clampGravityVelocity(rb);
      }
      var gHalf = this._getBodyHalf();
      this._applyRoomWallBounceTick(rb, gHalf);
      if (this._clampStrikerDeflect(rb)) return;
      if (performance.now() >= this._strikerClampUntilMs) {
        this._preHitWorldSpeed = this._currentWorldSpeed(rb);
      }
      return;
    }

    if (this.state === 'float' || this.state === 'float-inside') {
      if (typeof rb.isSleeping === 'function' && rb.isSleeping()) {
        if (typeof rb.wakeUp === 'function') {
          rb.wakeUp();
        }
      }

      var halfF = this._getBodyHalf();
      this._applyRoomWallBounceTick(rb, halfF);

      this._maintainFloatDrift(rb);
      this._applyTimeScaleToVelocity(rb);
      if (this._clampStrikerDeflect(rb)) return;
      if (performance.now() >= this._strikerClampUntilMs) {
        this._preHitWorldSpeed = this._currentWorldSpeed(rb);
      }
      return;
    }
  },

  _useGravityTimeScale: function () {
    var g = this.domeCfg.gravityMode || {};
    return g.useTimeScale !== false;
  },

  /** Диагностика @c-frame/physx@0.3.0 — один раз на сессию. */
  _logGravityScaleDiag: function (rb) {
    if (this._gravityScaleDiagDone) return;
    this._gravityScaleDiagDone = true;
    if (typeof rb.setGravityScale === 'function') {
      console.log('[floating-cube] setGravityScale доступен на rigidBody');
    } else {
      console.log('[floating-cube] setGravityScale нет — manual gravity × timeScale');
    }
  },

  /**
   * gravity + timeScale: slo-mo отключает PhysX-gravity, интегрируем g×ts;
   * velocity × timeScale; clamp в world-space.
   */
  _tickGravityWithTimeScale: function (rb) {
    if (!this._gravityScaleDiagDone) {
      this._logGravityScaleDiag(rb);
    }

    var ts = this._getTimeScale();

    if (typeof rb.setGravityScale === 'function') {
      try {
        rb.setGravityScale(ts);
        this._syncPhysXGravityFlag(rb, true);
      } catch (e) {
        if (!this._gravityScaleWarned) {
          console.warn('[floating-cube] setGravityScale failed:', e.message);
          this._gravityScaleWarned = true;
        }
        this._syncPhysXGravityFlag(rb, ts >= 0.999);
        if (ts < 0.999) {
          this._integrateScaledGravity(rb, ts);
        }
      }
    } else {
      this._syncPhysXGravityFlag(rb, ts >= 0.999);
      if (ts < 0.999) {
        this._integrateScaledGravity(rb, ts);
      }
    }

    this._applyTimeScaleToVelocity(rb);
    this._clampGravityVelocity(rb);
  },

  /** true = PhysX scene gravity ON; false = OFF (ручная g×ts в slo-mo). */
  _syncPhysXGravityFlag: function (rb, physxGravityOn) {
    var sysPX = this._getPhysX();
    var flag = sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY;
    if (!flag || typeof rb.setActorFlag !== 'function') return;

    var disable = !physxGravityOn;
    if (this._physxGravityOffForSloMo === disable) return;

    try {
      rb.setActorFlag(flag, disable);
      this._physxGravityOffForSloMo = disable;
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    } catch (e) {
      if (!this._syncGravWarned) {
        console.warn('[floating-cube] sync gravity flag failed:', e.message);
        this._syncGravWarned = true;
      }
    }
  },

  /** Ручная g×ts по Y (fallback без setGravityScale). */
  _integrateScaledGravity: function (rb, ts) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var gCfg = this.domeCfg.gravityMode || {};
    var gY = gCfg.sceneGravityY !== undefined ? gCfg.sceneGravityY : -9.8;
    var dt = this._tickDeltaSec;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (!lv || typeof rb.setLinearVelocity !== 'function') return;

      var worldVy = lv.y * invPrev + gY * ts * dt;
      rb.setLinearVelocity({
        x: lv.x,
        y: worldVy * prev,
        z: lv.z,
      }, false);
    } catch (e) {
      if (!this._scaledGravWarned) {
        console.warn('[floating-cube] scaled gravity failed:', e.message);
        this._scaledGravWarned = true;
      }
    }
  },

  /**
   * Обрезает скорость gravity-куба до потолка (world-space → scaled PhysX).
   */
  _clampGravityVelocity: function (rb) {
    var g = this.domeCfg.gravityMode || {};
    var maxLin = (g.maxLinearSpeed !== undefined) ? g.maxLinearSpeed : 2.0;
    var maxAng = (g.maxAngularSpeed !== undefined) ? g.maxAngularSpeed : 8.0;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      if (typeof rb.getLinearVelocity === 'function' && typeof rb.setLinearVelocity === 'function') {
        var lv = rb.getLinearVelocity();
        if (lv && typeof lv.x === 'number') {
          var wx = lv.x * invPrev;
          var wy = lv.y * invPrev;
          var wz = lv.z * invPrev;
          var wsp = Math.sqrt(wx * wx + wy * wy + wz * wz);
          if (wsp > maxLin && wsp > 1e-5) {
            var k = maxLin / wsp;
            rb.setLinearVelocity({
              x: wx * k * prev,
              y: wy * k * prev,
              z: wz * k * prev,
            }, false);
          }
        }
      }
      if (typeof rb.getAngularVelocity === 'function' && typeof rb.setAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av && typeof av.x === 'number') {
          var ax = av.x * invPrev;
          var ay = av.y * invPrev;
          var az = av.z * invPrev;
          var wasp = Math.sqrt(ax * ax + ay * ay + az * az);
          if (wasp > maxAng && wasp > 1e-5) {
            var ka = maxAng / wasp;
            rb.setAngularVelocity({
              x: ax * ka * prev,
              y: ay * ka * prev,
              z: az * ka * prev,
            }, false);
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