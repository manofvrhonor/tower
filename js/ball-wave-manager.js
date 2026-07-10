/* global CONFIG, THREE */

/**
 * ball-wave-manager.js — Этап 6 «атомы времени» (волны угроз, вариант D).
 *
 * Менеджер пула красных шаров. Спавнит N шаров ЗА туманом — на сфере
 * радиуса waves.spawnRadius > fogDome.radius. N = ballCount (сложность)
 * + hazardByLevel[location.hazardLevel].countBonus. Скорость float и
 * подлёта × speedScale той же таблицы. При location-changed пул
 * перезапускается под новую эпоху.
 *
 * При «выходе шара из игры» (улетел за despawnRadius / отбит наружу) red-ball шлёт
 * на сцену 'ball-retired' → менеджер удаляет шар и через respawnDelayMs спавнит
 * новый в другом месте, поддерживая активный пул = targetCount.
 *
 * Гейт: CONFIG.balls.waves.enabled. Если false — менеджер пассивен, шарами
 * управляет старый spawn-red-balls.js (выбор пути — в game-lifecycle.js).
 *
 * window API: ballWaveManager { startWaves, stopWaves, spawnOne, getActiveCount }.
 */
(function () {
  var DEG2RAD = Math.PI / 180;

  var _active = [];     // элементы шаров под управлением менеджера
  var _timers = [];     // setTimeout-id отложенных респавнов
  var _running = false;
  var _seq = 0;

  function wavesCfg() {
    return (typeof CONFIG !== 'undefined' && CONFIG.balls && CONFIG.balls.waves) || {};
  }

  function isEnabled() {
    return !!wavesCfg().enabled;
  }

  /** Параметры угрозы текущей эпохи (fallback hazardLevel=1). */
  function hazardParams() {
    var balls = (typeof CONFIG !== 'undefined' && CONFIG.balls) || {};
    var table = balls.hazardByLevel || {};
    var level = 1;
    if (typeof window.getActiveLocation === 'function') {
      var loc = window.getActiveLocation();
      if (loc && loc.hazardLevel !== undefined) level = loc.hazardLevel;
    }
    var row = table[level] || table[1] || {};
    return {
      level: level,
      countBonus: row.countBonus !== undefined ? row.countBonus : 0,
      speedScale: row.speedScale !== undefined ? row.speedScale : 1,
    };
  }

  /** Сколько шаров держать: сложность + hazard bonus → fallback waves.maxActive. */
  function targetCount() {
    var balls = (typeof CONFIG !== 'undefined' && CONFIG.balls) || {};
    var base = balls.count !== undefined
      ? balls.count
      : (wavesCfg().maxActive !== undefined ? wavesCfg().maxActive : 3);
    var n = base + hazardParams().countBonus;
    return n < 1 ? 1 : n;
  }

  function speedMult() {
    var balls = (typeof CONFIG !== 'undefined' && CONFIG.balls) || {};
    var min = balls.speedMultiplierMin !== undefined ? balls.speedMultiplierMin : 2.0;
    var max = balls.speedMultiplierMax !== undefined ? balls.speedMultiplierMax : 3.0;
    if (max < min) { var t = min; min = max; max = t; }
    var scale = hazardParams().speedScale;
    return (min + Math.random() * (max - min)) * scale;
  }

  /** CSV-строки слоёв для physx-material шара волны (слой WAVE_BALL). */
  function physxMaterialStr() {
    var balls = (typeof CONFIG !== 'undefined' && CONFIG.balls) || {};
    var layers = (typeof CONFIG !== 'undefined' && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7, WAVE_BALL: 8,
    };
    var ownLayer = layers.WAVE_BALL !== undefined ? layers.WAVE_BALL : 8;
    // Фильтр @c-frame/physx — по «ИЛИ» масок: пара сталкивается, если ЛЮБАЯ из сторон
    // перечисляет слой другой. Шар волны на отдельном слое WAVE_BALL, которого нет ни
    // в одной маске WORLD-коллайдеров → со стенами/полом/пьедесталом НЕ сталкивается
    // (летит сквозь туман). С кубами/битой сталкивается через свою маску ниже.
    var collidesWith = [
      layers.FLOAT_CUBE, layers.GRAVITY_CUBE, layers.GRABBED_CUBE, layers.HAND, layers.BAT,
    ].join(', ');
    var m = balls.material || { restitution: 0.32, staticFriction: 0.12, dynamicFriction: 0.10 };
    var contactOff = balls.contactOffset !== undefined ? balls.contactOffset : 0.017;
    return 'restitution: ' + m.restitution +
      '; staticFriction: ' + m.staticFriction +
      '; dynamicFriction: ' + m.dynamicFriction +
      '; contactOffset: ' + contactOff +
      '; collisionLayers: ' + ownLayer +
      '; collidesWithLayers: ' + collidesWith;
  }

  /** Случайная точка на сфере за туманом + направление подлёта к столу (cone-разброс). */
  function computeSpawnAndAim() {
    var w = wavesCfg();
    var R = w.spawnRadius !== undefined ? w.spawnRadius : 6.5;
    var pitchMin = (w.spawnPitchMinDeg !== undefined ? w.spawnPitchMinDeg : 8) * DEG2RAD;
    var pitchMax = (w.spawnPitchMaxDeg !== undefined ? w.spawnPitchMaxDeg : 78) * DEG2RAD;

    // Точка спавна: сфера R вокруг центра комнаты (0,0,0), угол места в [min,max] → над полом.
    var az = Math.random() * Math.PI * 2;
    var elev = pitchMin + Math.random() * (pitchMax - pitchMin);
    var cosE = Math.cos(elev);
    var sx = R * cosE * Math.sin(az);
    var sy = R * Math.sin(elev);
    var sz = R * cosE * Math.cos(az);

    // Точка-цель: сборка на столе + jitter по всем осям.
    var ty = w.targetY !== undefined ? w.targetY : 1.15;
    var j = w.targetJitter !== undefined ? w.targetJitter : 0;
    var tx = (Math.random() * 2 - 1) * j;
    var tyj = ty + (Math.random() * 2 - 1) * j;
    var tz = (Math.random() * 2 - 1) * j;

    var dx = tx - sx;
    var dy = tyj - sy;
    var dz = tz - sz;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var aim = applyConeSpread({ x: dx / len, y: dy / len, z: dz / len },
      (w.coneSpread !== undefined ? w.coneSpread : 0) * DEG2RAD);

    return { pos: { x: sx, y: sy, z: sz }, aim: aim };
  }

  /** Отклонить единичный вектор на случайный угол в пределах конуса (полуугол coneRad). */
  function applyConeSpread(dir, coneRad) {
    if (!coneRad || coneRad <= 0 || typeof THREE === 'undefined') return dir;
    var v = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    var helper = Math.abs(v.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    var perp = new THREE.Vector3().crossVectors(v, helper).normalize();
    perp.applyAxisAngle(v, Math.random() * Math.PI * 2);
    v.applyAxisAngle(perp, Math.random() * coneRad);
    return { x: v.x, y: v.y, z: v.z };
  }

  function ballMaterialStr(balls, opacity) {
    var color = balls.color || '#33e0ff';
    var emissive = balls.emissive || '#66f5ff';
    var ei = balls.emissiveIntensity !== undefined ? balls.emissiveIntensity : 1.35;
    var op = opacity !== undefined ? opacity : 1;
    return 'color: ' + color +
      '; emissive: ' + emissive +
      '; emissiveIntensity: ' + ei +
      '; transparent: true; opacity: ' + op +
      '; metalness: 0.15; roughness: 0.25; shader: standard';
  }

  function spawnOne() {
    var root = document.getElementById('red-balls-root');
    if (!root) {
      console.error('[ball-wave-manager] #red-balls-root not found');
      return null;
    }
    var balls = (typeof CONFIG !== 'undefined' && CONFIG.balls) || {};
    var sa = computeSpawnAndAim();
    var radius = balls.radius !== undefined ? balls.radius : 0.04;
    var mass = balls.mass !== undefined ? balls.mass : 2.0;
    var hz = hazardParams();

    _seq++;
    var el = document.createElement('a-entity');
    el.setAttribute('id', 'wave-ball-' + _seq);
    el.setAttribute('geometry', 'primitive: sphere; radius: ' + radius);
    // Старт невидимый — red-ball догонит fade по дистанции в первом tick.
    el.setAttribute('material', ballMaterialStr(balls, 0));
    el.setAttribute('position', sa.pos.x + ' ' + sa.pos.y + ' ' + sa.pos.z);
    el.setAttribute('physx-body', 'type: dynamic; mass: ' + mass + '; emitCollisionEvents: true');
    el.setAttribute('physx-material', physxMaterialStr());
    el.setAttribute('red-ball', 'speedMultiplier: ' + speedMult().toFixed(3));
    el.setAttribute('float-motion-trail', '');
    el.object3D.scale.set(0.001, 0.001, 0.001);

    // Метаданные для red-ball: режим волны, прицел, масштаб скорости эпохи.
    el.dataset.waveMode = '1';
    el.dataset.waveAimX = sa.aim.x.toFixed(4);
    el.dataset.waveAimY = sa.aim.y.toFixed(4);
    el.dataset.waveAimZ = sa.aim.z.toFixed(4);
    el.dataset.waveSpeedScale = String(hz.speedScale);

    root.appendChild(el);
    _active.push(el);
    return el;
  }

  function removeBall(el) {
    if (!el) return;
    var i = _active.indexOf(el);
    if (i >= 0) _active.splice(i, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  /** red-ball сообщил «шар вышел из игры» → убрать и запланировать замену. */
  function onBallRetired(evt) {
    var el = evt && evt.detail && evt.detail.el;
    removeBall(el);
    if (!_running) return;

    var delay = wavesCfg().respawnDelayMs !== undefined ? wavesCfg().respawnDelayMs : 600;
    var id = setTimeout(function () {
      var ti = _timers.indexOf(id);
      if (ti >= 0) _timers.splice(ti, 1);
      if (_running && _active.length < targetCount()) spawnOne();
    }, delay);
    _timers.push(id);
  }

  /** Прыжок эпохи → новый пул под hazardLevel (только если волны уже бегут). */
  function onLocationChanged() {
    if (!_running || !isEnabled()) return;
    startWaves();
  }

  function startWaves() {
    if (!isEnabled()) return false;
    stopWaves();
    _running = true;
    var n = targetCount();
    var hz = hazardParams();
    for (var i = 0; i < n; i++) spawnOne();
    console.log('[ball-wave-manager] waves started:', n,
      '| hazard:', hz.level, 'bonus:', hz.countBonus, 'speed×', hz.speedScale);
    return true;
  }

  function stopWaves() {
    _running = false;
    for (var i = 0; i < _timers.length; i++) clearTimeout(_timers[i]);
    _timers = [];
    for (var j = _active.length - 1; j >= 0; j--) removeBall(_active[j]);
    _active = [];
  }

  function attachListener() {
    var scene = document.querySelector('a-scene');
    if (!scene) { setTimeout(attachListener, 100); return; }
    scene.addEventListener('ball-retired', onBallRetired);
    scene.addEventListener('location-changed', onLocationChanged);
  }
  attachListener();

  window.ballWaveManager = {
    startWaves: startWaves,
    stopWaves: stopWaves,
    spawnOne: spawnOne,
    getActiveCount: function () { return _active.length; },
  };
})();
