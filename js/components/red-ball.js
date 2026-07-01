/* global AFRAME, CONFIG, THREE */

/**
 * red-ball — красный шар-угроза (Этап 6).
 *
 * Float-физика, слой BALL, скорости ×2 от кубиков, timeScale.
 * Не хватается. Не сталкивается с DOME — пролетает к башне.
 * После отскока от стен комнаты — разворот к куполу; задержка 0/1/2 отскока
 * заново бросается после каждого такого разворота (цикл).
 * После отскока от пола — разворот к башне (steerBounceDelays).
 * room-dome-collider: чистый отскок внутрь (roomWallBounce), без скольжения.
 * Пол: floorEscape в tick.
 */
AFRAME.registerComponent('red-ball', {
  schema: {
    speedMultiplier: { type: 'number', default: 0 },
  },

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.balls) || {};
    this._cubeCfg = (typeof CONFIG !== 'undefined' && CONFIG.floatingCubes) || {};
    this._physicsApplied = false;
    this._lastAppliedTimeScale = 1.0;
    this._beginSteerCycle();
    this._speedMult = this._resolveSpeedMultiplier();
    this._speeds = this._resolveSpeeds(this._speedMult);
    this._worldPos = new THREE.Vector3();
    this._lastCubeHitMs = 0;
    // Мировая скорость шара в предыдущем кадре — для сохранения скорости при ударе битой.
    this._preHitWorldSpeed = this._speeds.minDrift;
    // Окно удержания скорости после удара битой (см. _deflectOffBat / _clampBatDeflect).
    this._batClampUntilMs = 0;
    this._batClampSpeed = this._speeds.minDrift;
    // Ранний contactbegin (contactOffset): ждём визуального касания, не отскакиваем.
    this._pendingCubeHit = null;
    this._lastFloorEscapeMs = 0;

    // Режим волны (ball-wave-manager): подлёт по заданному прицелу, без containment,
    // homing и floorEscape. Метаданные прицела — в dataset (ставит менеджер).
    this._waveMode = !!(this.el.dataset && this.el.dataset.waveMode === '1');
    this._retired = false;
    this._waveState = 'incoming';
    if (this._waveMode) {
      var ax = parseFloat(this.el.dataset.waveAimX);
      var ay = parseFloat(this.el.dataset.waveAimY);
      var az = parseFloat(this.el.dataset.waveAimZ);
      if (isFinite(ax) && isFinite(ay) && isFinite(az) && (ax || ay || az)) {
        this._waveAim = { x: ax, y: ay, z: az };
      } else {
        this._waveMode = false;
      }
    }

    this._onContactBegin = this._onContactBegin.bind(this);
    var onReady = this._tryApply.bind(this);
    this.el.addEventListener('body-loaded', onReady);
    this.el.addEventListener('physx-body-loaded', onReady);
    this._pollIntervalId = setInterval(this._tryApply.bind(this), 100);

    if (typeof window.applyGameplayRenderOrder === 'function') {
      window.applyGameplayRenderOrder(this.el);
    }
  },

  play: function () {
    this.el.addEventListener('contactbegin', this._onContactBegin);
  },

  pause: function () {
    this.el.removeEventListener('contactbegin', this._onContactBegin);
  },

  remove: function () {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  _resolveSpeedMultiplier: function () {
    if (this.data.speedMultiplier > 0) return this.data.speedMultiplier;
    var min = this.cfg.speedMultiplierMin !== undefined ? this.cfg.speedMultiplierMin : 2.0;
    var max = this.cfg.speedMultiplierMax !== undefined ? this.cfg.speedMultiplierMax : 3.0;
    if (max < min) { var t = min; min = max; max = t; }
    return min + Math.random() * (max - min);
  },

  /** Новый цикл: случайно 0/1/2 пропуска отскока до разворота к куполу. */
  _beginSteerCycle: function () {
    var opts = this.cfg.steerBounceDelays || [0, 1, 2];
    this._steerBounceDelay = opts[Math.floor(Math.random() * opts.length)];
    this._wallBounceCount = 0;
  },

  _resolveSpeeds: function (mult) {
    var c = this._cubeCfg;
    return {
      initialImpulse: (c.initialImpulseSpeed !== undefined ? c.initialImpulseSpeed : 0.3) * mult,
      initialAngular: (c.initialAngularSpeed !== undefined ? c.initialAngularSpeed : 0.8) * mult,
      minDrift: (c.minDriftSpeed !== undefined ? c.minDriftSpeed : 0.28) * mult,
      minAngular: (c.minAngularDriftSpeed !== undefined ? c.minAngularDriftSpeed : 0.65) * mult,
    };
  },

  _tryApply: function () {
    if (this._physicsApplied) return;
    var bodyComp = this.el.components['physx-body'];
    var rb = bodyComp && bodyComp.rigidBody;
    if (!rb) return;

    this._rb = rb;
    this._applyFloatPhysics(rb);
    this._physicsApplied = true;

    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  },

  _getPhysX: function () {
    return this.el.sceneEl.systems.physx && this.el.sceneEl.systems.physx.PhysX;
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

  _getDomeTarget: function () {
    var dome = (typeof CONFIG !== 'undefined' && CONFIG.dome) || {};
    return {
      x: 0,
      y: dome.centerY !== undefined ? dome.centerY : 1.15,
      z: 0,
    };
  },

  /** Единичный вектор от шара к центру купола. */
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

  _randomUnitVector: function () {
    var x; var y; var z; var len2;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len2 = x * x + y * y + z * z;
    } while (len2 > 1 || len2 < 1e-6);
    var inv = 1 / Math.sqrt(len2);
    return { x: x * inv, y: y * inv, z: z * inv };
  },

  _getWallBounceOpts: function () {
    var prev = this._lastAppliedTimeScale;
    return {
      worldVelInvScale: prev > 0.001 ? 1 / prev : 1,
      minBounceSpeed: this._speeds.minDrift,
    };
  },

  /**
   * Задаёт направление скорости к куполу, сохраняя текущую величину (не притяжение).
   * @param {number} [upBias] — мин. Y единичного направления (floorEscape).
   */
  _setVelocityDirectionTowardDome: function (rb, upBias) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;

    var toward = this._directionTowardDome();
    if (upBias !== undefined && upBias > 0 && toward.y < upBias) {
      toward.y = upBias;
      var tl = Math.sqrt(toward.x * toward.x + toward.y * toward.y + toward.z * toward.z);
      if (tl > 1e-5) {
        toward.x /= tl;
        toward.y /= tl;
        toward.z /= tl;
      }
    }
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return;

      var fx = lv.x * invPrev;
      var fy = lv.y * invPrev;
      var fz = lv.z * invPrev;
      var speed = Math.sqrt(fx * fx + fy * fy + fz * fz);
      var minSp = this._speeds.minDrift;
      if (speed < minSp) speed = minSp;

      rb.setLinearVelocity({
        x: toward.x * speed,
        y: toward.y * speed,
        z: toward.z * speed,
      }, false);
      this._lastAppliedTimeScale = 1.0;
    } catch (e) {
      if (!this._steerWarned) {
        console.warn('[red-ball] set direction failed:', e.message);
        this._steerWarned = true;
      }
    }
  },

  _getFloorEscapeCfg: function () {
    return this.cfg.floorEscape || {};
  },

  /** Низко у пола, далеко от центра, горизонтальная скорость — «застрял у периметра». */
  _isFloorEscapeCandidate: function (rb) {
    var fe = this._getFloorEscapeCfg();
    if (fe.enabled === false) return false;

    this.el.object3D.getWorldPosition(this._worldPos);
    var y = this._worldPos.y;
    if (y > (fe.maxY !== undefined ? fe.maxY : 0.22)) return false;

    var horizDist = Math.sqrt(
      this._worldPos.x * this._worldPos.x + this._worldPos.z * this._worldPos.z
    );
    if (horizDist < (fe.minHorizDist !== undefined ? fe.minHorizDist : 0.45)) return false;

    if (!rb || typeof rb.getLinearVelocity !== 'function') return false;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return false;
      var fx = lv.x * invPrev;
      var fz = lv.z * invPrev;
      var horizSp = Math.sqrt(fx * fx + fz * fz);
      var minHoriz = fe.minHorizSpeed !== undefined ? fe.minHorizSpeed : 0.12;
      return horizSp >= minHoriz;
    } catch (e) {
      return false;
    }
  },

  /** Разворот к куполу с upBias — выход из «желоба» у пола круглой комнаты. */
  _tryFloorEscape: function (rb) {
    var fe = this._getFloorEscapeCfg();
    if (fe.enabled === false) return false;

    var cd = fe.cooldownMs !== undefined ? fe.cooldownMs : 800;
    if (performance.now() - this._lastFloorEscapeMs < cd) return false;
    if (!this._isFloorEscapeCandidate(rb)) return false;

    var upBias = fe.upBias !== undefined ? fe.upBias : 0.35;
    this._setVelocityDirectionTowardDome(rb, upBias);
    this._beginSteerCycle();
    this._lastFloorEscapeMs = performance.now();
    if (typeof rb.wakeUp === 'function') rb.wakeUp();
    return true;
  },

  /** Отскок от стен/пола/потолка комнаты — да; пьедестал и малый купол — нет. */
  _isRoomWallContact: function (otherEl) {
    if (!otherEl) return false;
    var node = otherEl;
    while (node) {
      if (node.dataset && node.dataset.orbitRingSegment !== undefined) return false;
      if (node.id && node.id.indexOf('orbit-ring-') === 0) return false;
      if (node.id === 'pedestal') return false;
      if (node.id === 'dome-collider') return false;
      node = node.parentElement;
    }
    return true;
  },

  _applyBallCCD: function (rb) {
    var cfg = this.cfg;
    if (cfg.speculativeCCD === false) return;
    var sysPX = this._getPhysX();
    var flag = sysPX && sysPX.PxRigidBodyFlag && sysPX.PxRigidBodyFlag.eENABLE_SPECULATIVE_CCD;
    if (!flag) return;
    try {
      rb.setRigidBodyFlag(flag, true);
    } catch (e) {
      if (!this._ccdWarned) {
        console.warn('[red-ball] speculative CCD failed:', e.message);
        this._ccdWarned = true;
      }
    }
  },

  _onContactBegin: function (evt) {
    var other = evt.detail.otherComponent;
    if (!other) return;

    if (other.data.type === 'dynamic' && other.el.components['floating-cube']) {
      this._onCubeContactBegin(other);
      return;
    }

    // Удар битой в руке: отскок (slo-mo — только направление; realtime — с бустом).
    if (other.el && other.el.components['ball-bat']) {
      if (other.el.is && other.el.is('grabbed-dynamic') && this._rb) {
        this._deflectOffBat(this._rb);
      }
      return;
    }

    // Волна: с куполом не сталкивается (слой WAVE_BALL), homing не нужен. С полом/
    // пьедесталом (static) сталкивается — направляем наружу-вверх, чтобы шар не катился
    // по полу (restitution низкий, gravity off), а улетел за купол и деспавнился.
    if (this._waveMode) {
      if (other.data.type === 'static' && this._rb) {
        this._deflectWaveOffSurface(this._rb);
      }
      return;
    }

    if (other.data.type !== 'static') return;
    if (!this._isRoomWallContact(other.el)) return;
    var rb = this._rb;
    if (!rb) return;

    // Стенка комнаты (room-dome-collider): сразу отскок внутрь.
    if (typeof isRoomDomeWallElement === 'function' && isRoomDomeWallElement(other.el)) {
      var br = this.cfg.radius !== undefined ? this.cfg.radius : 0.04;
      if (typeof bounceOffRoomDomeWall === 'function' &&
          bounceOffRoomDomeWall(this.el, rb, br, this._getWallBounceOpts())) {
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

  /**
   * contactbegin с кубом: импульс только при визуальном касании.
   * Раньше — pending: шар не отскакивает от «ghost»-контакта, в tick дожимаем до касания.
   */
  _onCubeContactBegin: function (otherComp) {
    // Куб в руке отбивает шар — без разгона от взмаха (как бита).
    if (otherComp.el && otherComp.el.is && otherComp.el.is('grabbed-dynamic')) {
      if (this._rb) this._deflectOffBat(this._rb);
      return;
    }

    if (this._isNearVisualCubeHit(otherComp.el)) {
      this._boostHitCube(otherComp, true, this._getInboundDir(otherComp.el));
      return;
    }
    var holdMs = this._cubeHitPendingDurationMs();
    this._pendingCubeHit = {
      el: otherComp.el,
      comp: otherComp,
      untilMs: performance.now() + holdMs,
      dir: this._getInboundDir(otherComp.el),
    };
  },

  _clearPendingCubeHit: function () {
    this._pendingCubeHit = null;
  },

  /**
   * Пока pending — каждый кадр держим шар на курсе к кубу (мировая скорость),
   * перебивая ранний отскок солвера. При dist ≤ порога — _boostHitCube.
   */
  _processPendingCubeHit: function () {
    var pending = this._pendingCubeHit;
    if (!pending) return false;

    if (performance.now() > pending.untilMs || !pending.el.parentNode) {
      this._clearPendingCubeHit();
      return false;
    }

    if (this._isNearVisualCubeHit(pending.el)) {
      this._boostHitCube(pending.comp, true, pending.dir);
      return false;
    }

    this._holdBallTowardCube(pending.el, pending.dir);
    return true;
  },

  /** Длительность pending после ghost-contactbegin; в slo-mo — дольше. */
  _cubeHitPendingDurationMs: function () {
    var base = this.cfg.cubeHitPendingMs !== undefined ? this.cfg.cubeHitPendingMs : 600;
    var ts = this._getTimeScale();
    var sloMoMax = this.cfg.cubeHitSloMoTimeScale !== undefined
      ? this.cfg.cubeHitSloMoTimeScale : 0.85;
    if (ts >= sloMoMax) return base;
    var maxHold = this.cfg.cubeHitPendingSloMoMsMax !== undefined
      ? this.cfg.cubeHitPendingSloMoMsMax : 2400;
    return Math.min(maxHold, base / Math.max(ts, 0.05));
  },

  /** Направление полёта шара (мировое), не к центру куба — без «магнита». */
  _getInboundDir: function (cubeEl) {
    var rb = this._rb;
    if (rb && typeof rb.getLinearVelocity === 'function') {
      var prev = this._lastAppliedTimeScale;
      if (!prev || prev < 0.001) prev = 1.0;
      var invPrev = 1 / prev;
      try {
        var lv = rb.getLinearVelocity();
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
    if (!cubeEl || !cubeEl.object3D) return { x: 0, y: 0, z: -1 };

    this.el.object3D.getWorldPosition(this._worldPos);
    var bx = this._worldPos.x;
    var by = this._worldPos.y;
    var bz = this._worldPos.z;
    cubeEl.object3D.getWorldPosition(this._worldPos);
    var dx = this._worldPos.x - bx;
    var dy = this._worldPos.y - by;
    var dz = this._worldPos.z - bz;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-5) return { x: 0, y: 0, z: -1 };
    return { x: dx / len, y: dy / len, z: dz / len };
  },

  /**
   * Продолжить полёт по сохранённому inbound-направлению (перебить ghost-отскок солвера).
   */
  _holdBallTowardCube: function (cubeEl, inboundDir) {
    var rb = this._rb;
    if (!rb) return;

    var nx = inboundDir && inboundDir.x !== undefined ? inboundDir.x : 0;
    var ny = inboundDir && inboundDir.y !== undefined ? inboundDir.y : 0;
    var nz = inboundDir && inboundDir.z !== undefined ? inboundDir.z : -1;
    var dirLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (dirLen < 1e-5) {
      var fb = this._getInboundDir(cubeEl);
      nx = fb.x; ny = fb.y; nz = fb.z;
    } else {
      nx /= dirLen; ny /= dirLen; nz /= dirLen;
    }

    try {
      var lv = rb.getLinearVelocity();
      if (!lv || typeof rb.setLinearVelocity !== 'function') return;

      var prev = this._lastAppliedTimeScale;
      if (!prev || prev < 0.001) prev = 1.0;
      var invPrev = 1 / prev;

      var fx = lv.x * invPrev;
      var fy = lv.y * invPrev;
      var fz = lv.z * invPrev;
      var speed = Math.sqrt(fx * fx + fy * fy + fz * fz);
      var minSp = this._speeds.minDrift;
      if (speed < minSp) speed = minSp;

      rb.setLinearVelocity({
        x: nx * speed,
        y: ny * speed,
        z: nz * speed,
      }, false);
      this._lastAppliedTimeScale = 1.0;
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    } catch (e) {
      if (!this._holdCubeWarned) {
        console.warn('[red-ball] hold toward cube failed:', e.message);
        this._holdCubeWarned = true;
      }
    }
  },

  /**
   * Доп. импульс кубу при ударе шара — чтобы валить башню, а не отскакивать.
   * skipVisualCheck — после pending или уже проверенное касание.
   */
  _boostHitCube: function (otherComp, skipVisualCheck, dirOverride) {
    var rb = this._rb;
    var cubeRb = otherComp.rigidBody;
    if (!rb || !cubeRb || typeof rb.getLinearVelocity !== 'function') return;

    if (!skipVisualCheck && !this._isNearVisualCubeHit(otherComp.el)) return;

    var now = performance.now();
    var cd = this.cfg.cubeHitCooldownMs !== undefined ? this.cfg.cubeHitCooldownMs : 90;
    if (now - this._lastCubeHitMs < cd) return;
    this._lastCubeHitMs = now;

    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return;

      var bx = lv.x * invPrev;
      var by = lv.y * invPrev;
      var bz = lv.z * invPrev;
      var speed = Math.sqrt(bx * bx + by * by + bz * bz);
      if (speed < 0.12) speed = this._speeds.minDrift;

      var nx; var ny; var nz;
      if (dirOverride && dirOverride.x !== undefined) {
        nx = dirOverride.x; ny = dirOverride.y; nz = dirOverride.z;
        var dlen = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (dlen > 1e-5) { nx /= dlen; ny /= dlen; nz /= dlen; }
        else { nx = bx / speed; ny = by / speed; nz = bz / speed; }
      } else {
        nx = bx / speed; ny = by / speed; nz = bz / speed;
      }
      var mult = this.cfg.cubeHitImpulseMultiplier !== undefined
        ? this.cfg.cubeHitImpulseMultiplier : 2.8;
      var boost = speed * mult;
      var retain = this.cfg.cubeHitBallRetain !== undefined
        ? this.cfg.cubeHitBallRetain : 0.72;

      var fc = otherComp.el && otherComp.el.components['floating-cube'];
      var fcPrev = 1.0;
      if (fc && fc._lastAppliedTimeScale) {
        fcPrev = fc._lastAppliedTimeScale;
        if (fcPrev < 0.001) fcPrev = 1.0;
      }
      var invFc = 1 / fcPrev;

      var clv = cubeRb.getLinearVelocity();
      if (clv && typeof cubeRb.setLinearVelocity === 'function') {
        var worldCx = clv.x * invFc + nx * boost;
        var worldCy = clv.y * invFc + ny * boost;
        var worldCz = clv.z * invFc + nz * boost;
        cubeRb.setLinearVelocity({
          x: worldCx,
          y: worldCy,
          z: worldCz,
        }, false);
        if (fc) fc._lastAppliedTimeScale = 1.0;
        if (typeof cubeRb.wakeUp === 'function') cubeRb.wakeUp();
      }

      if (typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({
          x: nx * speed * retain,
          y: ny * speed * retain,
          z: nz * speed * retain,
        }, false);
        this._lastAppliedTimeScale = 1.0;
      }
      this._clearPendingCubeHit();
    } catch (e) {
      if (!this._cubeHitWarned) {
        console.warn('[red-ball] cube hit boost failed:', e.message);
        this._cubeHitWarned = true;
      }
    }
  },

  _centerDistToCube: function (cubeEl) {
    if (!cubeEl || !cubeEl.object3D) return Infinity;
    this.el.object3D.getWorldPosition(this._worldPos);
    var cx = this._worldPos.x;
    var cy = this._worldPos.y;
    var cz = this._worldPos.z;
    cubeEl.object3D.getWorldPosition(this._worldPos);
    var dx = this._worldPos.x - cx;
    var dy = this._worldPos.y - cy;
    var dz = this._worldPos.z - cz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  _isNearVisualCubeHit: function (cubeEl) {
    if (!cubeEl || !cubeEl.object3D) return false;

    var ballR = this.cfg.radius !== undefined ? this.cfg.radius : 0.04;
    var cubeHalf = (this._cubeCfg.size !== undefined ? this._cubeCfg.size : 0.1) * 0.5;
    var slack = this.cfg.cubeHitVisualSlack !== undefined
      ? this.cfg.cubeHitVisualSlack : 0.012;

    return this._centerDistToCube(cubeEl) <= ballR + cubeHalf + slack;
  },

  /**
   * Отскок от биты или куба в руке.
   * Slo-mo: направление солвера, скорость = до удара (без разгона от взмаха).
   * Realtime: доударная × boost и/или доля скорости солвера (энергия взмаха).
   */
  _deflectOffBat: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;
    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return;

      var prev = this._lastAppliedTimeScale;
      if (!prev || prev < 0.001) prev = 1.0;
      var invPrev = 1 / prev;

      var wx = lv.x * invPrev;
      var wy = lv.y * invPrev;
      var wz = lv.z * invPrev;
      var solverWorld = Math.sqrt(wx * wx + wy * wy + wz * wz);

      var nx; var ny; var nz;
      if (solverWorld > 1e-5) {
        nx = wx / solverWorld; ny = wy / solverWorld; nz = wz / solverWorld;
      } else {
        var d = this._directionTowardDome();
        nx = d.x; ny = d.y; nz = d.z;
      }

      var preHit = this._preHitWorldSpeed;
      if (!preHit || preHit < this._speeds.minDrift) preHit = this._speeds.minDrift;

      var bd = this.cfg.batDeflect || {};
      var target;

      if (this._isWorldSlowMo()) {
        target = preHit;
      } else {
        var boost = bd.realtimeSpeedBoost !== undefined ? bd.realtimeSpeedBoost : 1.60;
        var swing = bd.realtimeSwingRetain !== undefined ? bd.realtimeSwingRetain : 0.45;
        target = Math.max(preHit * boost, solverWorld * swing);
        var maxSp = bd.realtimeSpeedMax !== undefined ? bd.realtimeSpeedMax : 2.8;
        if (target > maxSp) target = maxSp;
      }

      if (typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({ x: nx * target, y: ny * target, z: nz * target }, false);
        this._lastAppliedTimeScale = 1.0;
      }
      if (typeof rb.wakeUp === 'function') rb.wakeUp();

      var clampMs = bd.clampMs !== undefined ? bd.clampMs : 250;
      this._batClampSpeed = target;
      this._batClampUntilMs = performance.now() + clampMs;
    } catch (e) {
      if (!this._batHitWarned) {
        console.warn('[red-ball] bat deflect failed:', e.message);
        this._batHitWarned = true;
      }
    }
  },

  /**
   * Пока активно окно после удара битой — удерживаем «мировую» скорость шара
   * на доударной (_batClampSpeed), сохраняя направление, которое дал солвер.
   * Это переживает многокадровый «доразгон» от kinematic-биты.
   */
  _clampBatDeflect: function (rb) {
    if (performance.now() >= this._batClampUntilMs) return false;
    if (!rb || typeof rb.getLinearVelocity !== 'function') return false;
    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return false;
      var rawSpeed = Math.sqrt(lv.x * lv.x + lv.y * lv.y + lv.z * lv.z);
      if (rawSpeed < 1e-5) return true;

      var ts = this._getTimeScale();
      var targetRaw = this._batClampSpeed * ts;
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
      if (!this._batClampWarned) {
        console.warn('[red-ball] bat clamp failed:', e.message);
        this._batClampWarned = true;
      }
    }
    return true;
  },

  /** Текущая «мировая» (timeScale-нормированная) скорость шара. */
  _currentWorldSpeed: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return this._speeds.minDrift;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;
    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return this._speeds.minDrift;
      var fx = lv.x * invPrev;
      var fy = lv.y * invPrev;
      var fz = lv.z * invPrev;
      return Math.sqrt(fx * fx + fy * fy + fz * fz);
    } catch (e) {
      return this._speeds.minDrift;
    }
  },

  _applyFloatPhysics: function (rb) {
    var cfg = this.cfg;
    var ld = cfg.linearDamping !== undefined ? cfg.linearDamping : 0.03;
    var ad = cfg.angularDamping !== undefined ? cfg.angularDamping : 0.05;
    var sysPX = this._getPhysX();
    var speeds = this._speeds;

    if (sysPX && sysPX.PxActorFlag && sysPX.PxActorFlag.eDISABLE_GRAVITY) {
      try {
        rb.setActorFlag(sysPX.PxActorFlag.eDISABLE_GRAVITY, true);
        if (typeof rb.wakeUp === 'function') rb.wakeUp();
      } catch (e) {
        console.error('[red-ball] setActorFlag failed:', e);
      }
    }

    if (typeof rb.setLinearDamping === 'function') rb.setLinearDamping(ld);
    if (typeof rb.setAngularDamping === 'function') rb.setAngularDamping(ad);

    if (typeof rb.setSleepThreshold === 'function') {
      try { rb.setSleepThreshold(0); } catch (e) { /* ignore */ }
    }

    this._applyBallCCD(rb);

    if (typeof rb.setLinearVelocity === 'function') {
      var dx; var dy; var dz; var sp;
      if (this._waveMode) {
        // Волна: летим по прицелу к столу со скоростью подлёта (мировая, prev=1.0).
        dx = this._waveAim.x; dy = this._waveAim.y; dz = this._waveAim.z;
        var w = cfg.waves || {};
        sp = w.incomingSpeed !== undefined ? w.incomingSpeed : 1.4;
      } else {
        var rnd = this._randomUnitVector();
        dx = rnd.x; dy = rnd.y; dz = rnd.z;
        sp = speeds.initialImpulse;
      }
      var dlen = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      try {
        rb.setLinearVelocity({
          x: (dx / dlen) * sp,
          y: (dy / dlen) * sp,
          z: (dz / dlen) * sp,
        }, true);
      } catch (e) {
        console.warn('[red-ball] impulse failed:', e.message);
      }
    }

    if (typeof rb.setAngularVelocity === 'function' && speeds.initialAngular > 0) {
      var axis = this._randomUnitVector();
      var ang = speeds.initialAngular;
      try {
        rb.setAngularVelocity({
          x: axis.x * ang, y: axis.y * ang, z: axis.z * ang,
        }, true);
      } catch (e) { /* ignore */ }
    }

    this._lastAppliedTimeScale = 1.0;
    this._applyTimeScaleToVelocity(rb);
  },

  _maintainFloatDrift: function (rb) {
    if (!rb || typeof rb.getLinearVelocity !== 'function') return;
    var speeds = this._speeds;
    var minLin = speeds.minDrift;
    var minAng = speeds.minAngular;
    var prev = this._lastAppliedTimeScale;
    if (!prev || prev < 0.001) prev = 1.0;
    var invPrev = 1 / prev;
    var changed = false;

    try {
      var lv = rb.getLinearVelocity();
      if (lv && typeof rb.setLinearVelocity === 'function') {
        var fx = lv.x * invPrev;
        var fy = lv.y * invPrev;
        var fz = lv.z * invPrev;
        var speed = Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (speed < minLin) {
          if (speed > 1e-4) {
            var linScale = minLin / speed;
            fx *= linScale;
            fy *= linScale;
            fz *= linScale;
          } else {
            var d = this._randomUnitVector();
            fx = d.x * minLin;
            fy = d.y * minLin;
            fz = d.z * minLin;
          }
          rb.setLinearVelocity({ x: fx, y: fy, z: fz }, false);
          changed = true;
        }
      }

      if (typeof rb.getAngularVelocity === 'function' && typeof rb.setAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av) {
          var ax = av.x * invPrev;
          var ay = av.y * invPrev;
          var az = av.z * invPrev;
          var angSp = Math.sqrt(ax * ax + ay * ay + az * az);
          if (angSp < minAng) {
            if (angSp > 1e-4) {
              var asc = minAng / angSp;
              ax *= asc; ay *= asc; az *= asc;
            } else {
              var axd = this._randomUnitVector();
              ax = axd.x * minAng; ay = axd.y * minAng; az = axd.z * minAng;
            }
            rb.setAngularVelocity({ x: ax, y: ay, z: az }, false);
            changed = true;
          }
        }
      }

      if (changed) this._lastAppliedTimeScale = 1.0;
    } catch (e) {
      if (!this._driftWarned) {
        console.warn('[red-ball] drift maintain failed:', e.message);
        this._driftWarned = true;
      }
    }
  },

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
      if (lv && typeof rb.setLinearVelocity === 'function') {
        rb.setLinearVelocity({
          x: lv.x * invPrev * ts,
          y: lv.y * invPrev * ts,
          z: lv.z * invPrev * ts,
        }, false);
      }
      if (typeof rb.getAngularVelocity === 'function' && typeof rb.setAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av) {
          rb.setAngularVelocity({
            x: av.x * invPrev * ts,
            y: av.y * invPrev * ts,
            z: av.z * invPrev * ts,
          }, false);
        }
      }
      this._lastAppliedTimeScale = ts;
    } catch (e) {
      if (!this._tsWarned) {
        console.warn('[red-ball] timeScale failed:', e.message);
        this._tsWarned = true;
      }
    }
  },

  /**
   * Волна: после удара о пол/пьедестал направить шар НАРУЖУ и ВВЕРХ (мировая скорость),
   * чтобы не катился по полу, а ушёл за купол → деспавн. timeScale применяется в _waveTick.
   */
  _deflectWaveOffSurface: function (rb) {
    if (!rb || typeof rb.setLinearVelocity !== 'function') return;
    this.el.object3D.getWorldPosition(this._worldPos);
    var hx = this._worldPos.x;
    var hz = this._worldPos.z;
    var hlen = Math.sqrt(hx * hx + hz * hz);
    var ox; var oz;
    if (hlen > 1e-3) {
      ox = hx / hlen; oz = hz / hlen;
    } else {
      var a = Math.random() * Math.PI * 2;
      ox = Math.cos(a); oz = Math.sin(a);
    }
    // Наружу по горизонтали + заметно вверх.
    var dir = { x: ox * 0.6, y: 0.8, z: oz * 0.6 };
    var dl = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
    dir.x /= dl; dir.y /= dl; dir.z /= dl;

    var w = this.cfg.waves || {};
    var sp = w.incomingSpeed !== undefined ? w.incomingSpeed : 1.4;

    try {
      rb.setLinearVelocity({ x: dir.x * sp, y: dir.y * sp, z: dir.z * sp }, false);
      this._lastAppliedTimeScale = 1.0;
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    } catch (e) {
      if (!this._surfaceWarned) {
        console.warn('[red-ball] wave surface deflect failed:', e.message);
        this._surfaceWarned = true;
      }
    }
  },

  /** Шар вышел из игры (улетел наружу / отбит) — сообщить менеджеру для респавна. */
  _retire: function () {
    if (this._retired) return;
    this._retired = true;
    this._waveState = 'retiring';
    if (this.el.sceneEl) {
      this.el.sceneEl.emit('ball-retired', { el: this.el }, false);
    }
  },

  /**
   * Tick для wave-режима: без containment/homing/floorEscape. Летит сквозь туман,
   * бьёт детали, отбивается битой/кубом; деспавн за despawnRadius → 'ball-retired'.
   */
  _waveTick: function (rb) {
    if (this._retired) return;

    if (typeof rb.isSleeping === 'function' && rb.isSleeping()) {
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    }

    this.el.object3D.getWorldPosition(this._worldPos);
    var dist = Math.sqrt(
      this._worldPos.x * this._worldPos.x +
      this._worldPos.y * this._worldPos.y +
      this._worldPos.z * this._worldPos.z
    );
    var room = (typeof CONFIG !== 'undefined' && CONFIG.room) || {};
    var fogR = (room.fogDome && room.fogDome.radius !== undefined) ? room.fogDome.radius : 2.0;
    if (this._waveState === 'incoming' && dist < fogR) {
      this._waveState = 'active';
    } else if (this._waveState === 'active' && dist > fogR) {
      this._waveState = 'retiring';
    }

    var w = this.cfg.waves || {};
    var despawnR = w.despawnRadius !== undefined ? w.despawnRadius : 3.6;
    if (dist > despawnR) { this._retire(); return; }

    // Поддержка минимальной скорости (только магнитуда, без редиректа) — чтобы не зависал.
    this._maintainFloatDrift(rb);

    var inBatClamp = performance.now() < this._batClampUntilMs;
    var heldPending = inBatClamp ? false : this._processPendingCubeHit();

    this._applyTimeScaleToVelocity(rb);

    if (this._clampBatDeflect(rb)) return;
    if (heldPending) return;

    this._preHitWorldSpeed = this._currentWorldSpeed(rb);
  },

  tick: function () {
    var rb = this._rb;
    if (!rb) return;

    if (this._waveMode) { this._waveTick(rb); return; }

    if (typeof rb.isSleeping === 'function' && rb.isSleeping()) {
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    }

    var r = this.cfg.radius !== undefined ? this.cfg.radius : 0.04;
    var bounceOpts = this._getWallBounceOpts();
    if (typeof enforceRoomDomeContainment === 'function') {
      if (enforceRoomDomeContainment(this.el, rb, r, bounceOpts) === 'sphere') {
        this._lastAppliedTimeScale = 1.0;
      }
    }
    if (typeof enforceRoomDomeWallBounce === 'function' &&
        enforceRoomDomeWallBounce(this.el, rb, r, bounceOpts)) {
      this._lastAppliedTimeScale = 1.0;
    }

    this._maintainFloatDrift(rb);

    // Hold/boost задают «мировую» скорость (prev=1.0) — timeScale применяем следом.
    var inBatClamp = performance.now() < this._batClampUntilMs;
    var heldPending = inBatClamp ? false : this._processPendingCubeHit();

    if (!inBatClamp && !heldPending) {
      this._tryFloorEscape(rb);
    }

    this._applyTimeScaleToVelocity(rb);

    // Окно после удара битой: держим скорость на доударной и НЕ обновляем
    // _preHitWorldSpeed завышенным значением (иначе следующий удар «запомнит» разгон).
    if (this._clampBatDeflect(rb)) return;

    if (heldPending) return;

    // Запоминаем скорость, с которой шар входит в этот кадр симуляции —
    // если в tock'е он столкнётся с битой, восстановим именно её.
    this._preHitWorldSpeed = this._currentWorldSpeed(rb);
  },
});
