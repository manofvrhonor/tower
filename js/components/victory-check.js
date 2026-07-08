/* global AFRAME, CONFIG */

/**
 * victory-check — победа после финальной эпохи (Фаза 4, шаг 8).
 *
 * Победа только в Future (unlocks == null): все слоты A→E снепнуты,
 * квота эпохи выполнена. Present/Past → travel-ready, не victory.
 */
AFRAME.registerComponent('victory-check', {
  schema: {},

  init: function () {
    this.cfg = (typeof CONFIG !== 'undefined' && CONFIG.victory) || {};
    this._won = false;
    this._stableSince = null;
    this._assemblyCore = null;
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

  _getAssemblyCore: function () {
    var c = this._assemblyCore;
    if (c && c.el && c.el.isConnected) return c;
    var el = document.getElementById('assembly-core');
    this._assemblyCore = (el && el.components && el.components['assembly-core']) || null;
    return this._assemblyCore;
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
    var mechId = result.mechanismId || '(unknown)';
    console.log('[victory-check] MECHANISM COMPLETE:', mechId,
      '— slots:', result.slotCount);

    var detail = {
      mechanismId: mechId,
      slotCount: result.slotCount,
    };
    this.el.sceneEl.emit('mechanism-complete', detail, false);
    this.el.sceneEl.emit('victory', detail, false);
  },

  _evaluate: function () {
    var loc = typeof getActiveLocation === 'function' ? getActiveLocation() : null;
    // Present/Past — квота эпохи → travel-ready (location-manager), не победа.
    if (loc && loc.unlocks != null) {
      return { ok: false };
    }

    var core = this._getAssemblyCore();
    if (!core || typeof core.areAllSlotsOccupied !== 'function') {
      return { ok: false };
    }

    var slotCount = typeof core.getSlotCount === 'function'
      ? core.getSlotCount() : 0;
    if (slotCount < 1) return { ok: false };

    if (!core.areAllSlotsOccupied()) {
      return { ok: false };
    }

    if (loc && typeof isLocationQuotaMet === 'function' && !isLocationQuotaMet()) {
      return { ok: false };
    }

    if (!this._verifySnappedOccupancy(core)) {
      return { ok: false };
    }

    return {
      ok: true,
      mechanismId: typeof core.getMechanismId === 'function'
        ? core.getMechanismId() : null,
      slotCount: slotCount,
    };
  },

  /**
   * Каждая занятая деталь всё ещё снепнута и не схвачена рукой.
   */
  _verifySnappedOccupancy: function (core) {
    var entries = typeof core.getOccupiedSlots === 'function'
      ? core.getOccupiedSlots() : [];

    for (var i = 0; i < entries.length; i++) {
      var el = entries[i].el;
      if (!el || el === true) return false;
      if (!el.parentNode || !el.isConnected) return false;
      if (el.is && el.is('grabbed-dynamic')) return false;

      var fc = el.components['floating-cube'];
      if (!fc || fc.state !== 'snapped') return false;
    }

    return true;
  },
});
