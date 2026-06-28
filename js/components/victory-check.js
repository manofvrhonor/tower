/* global AFRAME, CONFIG, THREE */

/**
 * victory-check — проверка условия победы (Этап 5).
 *
 * Победа: N цветных кубов (data-is-target) в gravity, не в руке, стоят башней
 * на пьедестале; N = CONFIG.victory.stackHeight; цвета = stackColors (shuffle при старте).
 *
 * При успехе и удержании stableDurationMs → событие 'victory' на сцене
 * (feedback — отдельный шаг 3).
 */
AFRAME.registerComponent('victory-check', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory) || {};
    this._won = false;
    this._stableSince = null;
    this._tick = this._tick.bind(this);
  },

  play: function () {
    var interval = this.cfg.checkIntervalMs || 200;
    this._intervalId = setInterval(this._tick, interval);
  },

  pause: function () {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  },

  /** Сброс для «Заново» без reload страницы. */
  reset: function () {
    this._won = false;
    this._stableSince = null;
  },

  _tick: function () {
    if (this._won) return;

    var result = this._evaluate();
    if (!result.ok) {
      this._stableSince = null;
      return;
    }

    var now = performance.now();
    if (!this._stableSince) {
      this._stableSince = now;
      return;
    }

    var hold = this.cfg.stableDurationMs || 1000;
    if (now - this._stableSince < hold) return;

    this._won = true;
    console.log('[victory-check] VICTORY — stack colors (bottom→top):',
      result.colors.join(' → '));
    this.el.sceneEl.emit('victory', { stack: result.stack }, false);
  },

  _evaluate: function () {
    var cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory) || this.cfg;
    var need = cfg.stackHeight || 4;
    var expected = cfg.stackColors || [];
    if (expected.length < need) {
      return { ok: false };
    }

    var candidates = this._collectCandidates(cfg);
    if (candidates.length < need) {
      return { ok: false };
    }

    var chain = this._findLongestStack(candidates, cfg);
    if (chain.length < need) {
      return { ok: false };
    }

    var stack = chain.slice(0, need);
    var colors = stack.map(function (c) { return c.color; });

    for (var i = 0; i < need; i++) {
      if (!this._colorsMatch(colors[i], expected[i])) {
        return { ok: false };
      }
    }

    for (var j = 0; j < stack.length; j++) {
      if (!this._isStable(stack[j].el, cfg)) {
        return { ok: false };
      }
    }

    return { ok: true, stack: stack, colors: colors };
  },

  _collectCandidates: function (cfg) {
    var cubes = this.el.sceneEl.querySelectorAll('[data-is-target="true"]');
    var half = ((CONFIG.floatingCubes && CONFIG.floatingCubes.size) || 0.1) / 2;
    var topY = cfg.pedestalTopY !== undefined ? cfg.pedestalTopY : 1.0;
    var maxR = cfg.pedestalRadiusXZ !== undefined ? cfg.pedestalRadiusXZ : 0.25;
    var minY = topY - half - 0.02;
    var list = [];

    for (var i = 0; i < cubes.length; i++) {
      var el = cubes[i];
      var fc = el.components['floating-cube'];
      if (!fc || fc.state !== 'gravity') continue;
      if (el.is('grabbed-dynamic')) continue;

      var pos = new THREE.Vector3();
      el.object3D.getWorldPosition(pos);
      var r2 = pos.x * pos.x + pos.z * pos.z;
      if (r2 > maxR * maxR || pos.y < minY) continue;

      list.push({
        el: el,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        color: this._getColor(el),
      });
    }

    return list;
  },

  _findLongestStack: function (candidates, cfg) {
    var cubeSize = (CONFIG.floatingCubes && CONFIG.floatingCubes.size) || 0.1;
    var maxXZ = cfg.stackMaxHorizontalOffset !== undefined
      ? cfg.stackMaxHorizontalOffset : 0.07;
    var minDy = cfg.stackMinVerticalStep !== undefined
      ? cfg.stackMinVerticalStep : 0.07;
    var maxDy = cfg.stackMaxVerticalStep !== undefined
      ? cfg.stackMaxVerticalStep : 0.13;

    candidates.sort(function (a, b) { return a.y - b.y; });

    var best = [];

    for (var s = 0; s < candidates.length; s++) {
      var chain = [candidates[s]];
      var top = candidates[s];

      while (true) {
        var next = this._findCubeAbove(candidates, top, chain, maxXZ, minDy, maxDy);
        if (!next) break;
        chain.push(next);
        top = next;
      }

      if (chain.length > best.length) {
        best = chain;
      }
    }

    return best;
  },

  _findCubeAbove: function (all, base, used, maxXZ, minDy, maxDy) {
    var best = null;
    var bestDy = Infinity;

    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (used.indexOf(c) !== -1) continue;

      var dy = c.y - base.y;
      if (dy < minDy || dy > maxDy) continue;

      var dx = c.x - base.x;
      var dz = c.z - base.z;
      if (dx * dx + dz * dz > maxXZ * maxXZ) continue;

      if (dy < bestDy) {
        bestDy = dy;
        best = c;
      }
    }

    return best;
  },

  _isStable: function (el, cfg) {
    var bodyComp = el.components['physx-body'];
    var rb = bodyComp && bodyComp.rigidBody;
    if (!rb) return false;

    var maxLin = cfg.maxLinearSpeed !== undefined ? cfg.maxLinearSpeed : 0.08;
    var maxAng = cfg.maxAngularSpeed !== undefined ? cfg.maxAngularSpeed : 0.6;

    try {
      if (typeof rb.getLinearVelocity === 'function') {
        var lv = rb.getLinearVelocity();
        if (!lv) return false;
        var speed = Math.sqrt(lv.x * lv.x + lv.y * lv.y + lv.z * lv.z);
        if (speed > maxLin) return false;
      }
      if (typeof rb.getAngularVelocity === 'function') {
        var av = rb.getAngularVelocity();
        if (av) {
          var ang = Math.sqrt(av.x * av.x + av.y * av.y + av.z * av.z);
          if (ang > maxAng) return false;
        }
      }
    } catch (e) {
      return false;
    }

    return true;
  },

  _getColor: function (el) {
    var comp = el.components.material;
    if (comp && comp.data && comp.data.color) {
      return String(comp.data.color).toLowerCase();
    }
    var attr = el.getAttribute('material');
    if (attr && typeof attr === 'object' && attr.color) {
      return String(attr.color).toLowerCase();
    }
    if (typeof attr === 'string') {
      var m = attr.match(/color:\s*(#[0-9a-fA-F]{3,8})/);
      if (m) return m[1].toLowerCase();
    }
    return '';
  },

  _colorsMatch: function (a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  },
});
