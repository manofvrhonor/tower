/* global AFRAME, CONFIG, THREE */

/**
 * Система time-scale (SUPERHOT-механика, Этап 4).
 *
 * Каждый кадр измеряет скорость головы (a-camera) и обеих рук (#leftHand,
 * #rightHand) через delta world position / delta time. Берётся max из трёх
 * (с фильтром дрожания: deadband + мягкий вход для рук). По сглаженной
 * скорости вычисляется целевой timeScale (min..max), затем плавно
 * интерполируется к нему.
 *
 * Потребители: floating-cube.js (float + gravity), будущие шары/враги/объекты мира.
 * Gravity-кубики на столе — тоже × getScale() (см. floating-cube._tickGravityWithTimeScale).
 * Контракт: любое «мировое» движение × getScale(). Руки и rig — реальное время.
 *
 * API: sceneEl.systems['time-scale'].getScale() → number 0.05..1.0
 * isWorldSlowMo() — slo-mo-сессия по recentMinScale (не мгновенный scale при взмахе).
 */
AFRAME.registerSystem('time-scale', {
  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.timeScale) || {};
    this.scale = this.cfg.min !== undefined ? this.cfg.min : 0.05;
    this._smoothedSpeed = 0;
    this._hasPrev = false;
    this._worldPos = new THREE.Vector3();
    this._prevPos = {
      camera: new THREE.Vector3(),
      leftHand: new THREE.Vector3(),
      rightHand: new THREE.Vector3(),
    };
    this._debugLastLog = 0;
    this._recentMinScale = 1.0;
    this._recentMinSince = 0;
    this._travelMenuSlowMo = false;

    var player = document.getElementById('player');
    this.tracked = {
      camera: player && player.querySelector('a-camera'),
      leftHand: document.getElementById('leftHand'),
      rightHand: document.getElementById('rightHand'),
    };
  },

  /**
   * Forced slo-mo пока открыто travel-меню (независимо от движения игрока).
   */
  setTravelMenuSlowMo: function (on) {
    this._travelMenuSlowMo = !!on;
    if (on) {
      var travel = (typeof CONFIG !== 'undefined' && CONFIG.travel) || {};
      var forced = travel.menuSlowMoScale !== undefined ? travel.menuSlowMoScale : 0.12;
      this.scale = forced;
      this._recentMinScale = forced;
      this._recentMinSince = performance.now();
    }
  },

  isTravelMenuSlowMo: function () {
    return !!this._travelMenuSlowMo;
  },

  /**
   * Текущий коэффициент времени для скриптового/«мирового» движения.
   * @returns {number}
   */
  getScale: function () {
    if (this._travelMenuSlowMo) {
      var travel = (typeof CONFIG !== 'undefined' && CONFIG.travel) || {};
      return travel.menuSlowMoScale !== undefined ? travel.menuSlowMoScale : 0.12;
    }
    return this.scale;
  },

  getRecentMinScale: function () {
    return this._recentMinScale;
  },

  /** true, если игрок недавно был в slo-mo (min scale за окно < порога). */
  isWorldSlowMo: function () {
    var strikeCfg = (typeof CONFIG !== 'undefined' && CONFIG.inHandStrike) || {};
    var th = strikeCfg.worldSlowMoThreshold !== undefined
      ? strikeCfg.worldSlowMoThreshold
      : (this.cfg.worldSlowMoThreshold !== undefined ? this.cfg.worldSlowMoThreshold : 0.5);
    return this._recentMinScale < th;
  },

  tick: function (time, dt) {
    if (typeof window.isVictoryFrozen === 'function' && window.isVictoryFrozen()) return;
    if (!dt || dt <= 0) return;

    var dtSec = dt / 1000;
    var rawSpeed = this._measureMaxSpeed(dtSec);

    if (this._travelMenuSlowMo) {
      var travel = (typeof CONFIG !== 'undefined' && CONFIG.travel) || {};
      this.scale = travel.menuSlowMoScale !== undefined ? travel.menuSlowMoScale : 0.12;
      this._trackRecentMin();
      this._hasPrev = true;
      this._debugLog(time);
      return;
    }

    if (this._hasPrev) {
      var cfg = this.cfg;
      var actRate = rawSpeed > this._smoothedSpeed
        ? (cfg.activityResponseUp !== undefined ? cfg.activityResponseUp : 5)
        : (cfg.activityResponseDown !== undefined ? cfg.activityResponseDown : 14);
      var actAlpha = 1 - Math.exp(-actRate * dtSec);
      this._smoothedSpeed += actAlpha * (rawSpeed - this._smoothedSpeed);

      var target = this._speedToScale(this._smoothedSpeed);
      var scaleRate = this._getScaleResponseRate(target);
      var scaleAlpha = 1 - Math.exp(-scaleRate * dtSec);
      this.scale += scaleAlpha * (target - this.scale);
    }

    this._trackRecentMin();
    this._hasPrev = true;
    this._debugLog(time);
  },

  _trackRecentMin: function () {
    var now = performance.now();
    var strikeCfg = (typeof CONFIG !== 'undefined' && CONFIG.inHandStrike) || {};
    var windowMs = strikeCfg.recentMinWindowMs !== undefined
      ? strikeCfg.recentMinWindowMs
      : (this.cfg.recentMinWindowMs !== undefined ? this.cfg.recentMinWindowMs : 600);

    if (!this._recentMinSince || (now - this._recentMinSince) > windowMs) {
      this._recentMinScale = this.scale;
      this._recentMinSince = now;
      return;
    }
    if (this.scale < this._recentMinScale) {
      this._recentMinScale = this.scale;
    }
  },

  /**
   * Максимальная «эффективная» скорость среди камеры и рук, м/с.
   * Дрожание рук/головы гасится deadband + softWidth (см. CONFIG.timeScale).
   */
  _measureMaxSpeed: function (dtSec) {
    var cfg = this.cfg;
    var headDb = cfg.headJitterDeadband !== undefined ? cfg.headJitterDeadband : 0.03;
    var headSoft = cfg.headJitterSoftWidth !== undefined ? cfg.headJitterSoftWidth : 0.04;
    var handDb = cfg.handJitterDeadband !== undefined ? cfg.handJitterDeadband : 0.11;
    var handSoft = cfg.handJitterSoftWidth !== undefined ? cfg.handJitterSoftWidth : 0.08;

    var headSpeed = this._measureSourceSpeed('camera', dtSec);
    var leftSpeed = this._measureSourceSpeed('leftHand', dtSec);
    var rightSpeed = this._measureSourceSpeed('rightHand', dtSec);

    headSpeed = this._applyJitterFilter(headSpeed, headDb, headSoft);
    leftSpeed = this._applyJitterFilter(leftSpeed, handDb, handSoft);
    rightSpeed = this._applyJitterFilter(rightSpeed, handDb, handSoft);

    return Math.max(headSpeed, leftSpeed, rightSpeed);
  },

  /**
   * Сырая скорость одного трекера, м/с.
   */
  _measureSourceSpeed: function (key, dtSec) {
    var el = this.tracked[key];
    if (!el || !el.object3D) return 0;

    el.object3D.getWorldPosition(this._worldPos);
    var prev = this._prevPos[key];
    var speed = 0;

    if (this._hasPrev) {
      var dx = this._worldPos.x - prev.x;
      var dy = this._worldPos.y - prev.y;
      var dz = this._worldPos.z - prev.z;
      speed = Math.sqrt(dx * dx + dy * dy + dz * dz) / dtSec;
    }

    prev.copy(this._worldPos);
    return speed;
  },

  /**
   * Гасит микродвижения: ниже deadband → 0; до deadband+softWidth — квадратичный вход.
   */
  _applyJitterFilter: function (speed, deadband, softWidth) {
    if (speed <= deadband) return 0;
    var excess = speed - deadband;
    if (!softWidth || softWidth <= 0 || excess >= softWidth) return excess;
    var t = excess / softWidth;
    return excess * t * t;
  },

  /**
   * Скорость интерполяции timeScale к цели.
   * Вниз (заморозка) — быстро; вверх (разморозка) — медленнее и пропорционально
   * интенсивности движения игрока.
   */
  _getScaleResponseRate: function (target) {
    var cfg = this.cfg;

    if (target <= this.scale) {
      return cfg.scaleResponseDown !== undefined ? cfg.scaleResponseDown : 10;
    }

    var baseUp = cfg.scaleResponseUp !== undefined ? cfg.scaleResponseUp : 3;
    var still = cfg.stillSpeed !== undefined ? cfg.stillSpeed : 0.02;
    var move = cfg.moveSpeed !== undefined ? cfg.moveSpeed : 0.12;
    var range = move - still;
    if (range < 1e-6) return baseUp;

    var intensity = (this._smoothedSpeed - still) / range;
    if (intensity < 0) intensity = 0;
    if (intensity > 1) intensity = 1;

    var minFactor = cfg.scaleUpIntensityMin !== undefined ? cfg.scaleUpIntensityMin : 0.25;
    return baseUp * (minFactor + (1 - minFactor) * intensity);
  },

  /**
   * Скорость activity → целевой timeScale (линейная интерполяция между порогами).
   */
  _speedToScale: function (speed) {
    var cfg = this.cfg;
    var min = cfg.min !== undefined ? cfg.min : 0.05;
    var max = cfg.max !== undefined ? cfg.max : 1.0;
    var still = cfg.stillSpeed !== undefined ? cfg.stillSpeed : 0.02;
    var move = cfg.moveSpeed !== undefined ? cfg.moveSpeed : 0.12;

    if (speed <= still) return min;
    if (speed >= move) return max;
    var t = (speed - still) / (move - still);
    return min + t * (max - min);
  },

  _debugLog: function (time) {
    if (!this.cfg.debug) return;
    if (time - this._debugLastLog < 500) return;
    this._debugLastLog = time;
    console.log(
      '[time-scale] speed=', this._smoothedSpeed.toFixed(3),
      'scale=', this.scale.toFixed(3)
    );
  },
});
