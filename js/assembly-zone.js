/* global CONFIG, THREE */

/**
 * assembly-zone.js — геометрия сферы ядра сборки (Фаза 2.x).
 * isInsideAssemblySphere(), getAssemblySphereTarget() для floating-cube / ball-bat.
 */
(function (global) {
  var _center = { x: 0, y: 0.985, z: 0 };
  var _vec = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;

  function getCfg() {
    return (global.CONFIG && global.CONFIG.assemblyZone) || {};
  }

  function getHubEl() {
    return document.getElementById('assembly-hub');
  }

  function getSphereWorldCenter() {
    var hub = getHubEl();
    if (hub && hub.object3D && _vec) {
      hub.object3D.getWorldPosition(_vec);
      return { x: _vec.x, y: _vec.y, z: _vec.z };
    }
    var c = getCfg().hubPosition || _center;
    return { x: c.x, y: c.y, z: c.z };
  }

  /**
   * @param {object} pos — {x,y,z} мир
   * @param {boolean} [forRelease] — lenient тест (R + halfCube)
   * @param {number} [halfCube] — половина ребра куба, м
   */
  function isInsideAssemblySphere(pos, forRelease, halfCube) {
    if (!pos) return false;
    var cfg = getCfg();
    var R = cfg.radius !== undefined ? cfg.radius : 0.30;
    var eps = 0.01;
    var half = halfCube !== undefined ? halfCube : 0.05;
    var useLenient = !!forRelease;
    if (forRelease && cfg.releaseContainment === 'strict') {
      useLenient = false;
    }
    var innerR = useLenient ? (R + half + eps) : (R - half + eps);

    var c = getSphereWorldCenter();
    var dx = pos.x - c.x;
    var dy = pos.y - c.y;
    var dz = pos.z - c.z;
    return (dx * dx + dy * dy + dz * dz) <= innerR * innerR;
  }

  function getAssemblySphereTarget() {
    return getSphereWorldCenter();
  }

  function getAssemblyZoneRadius() {
    var cfg = getCfg();
    return cfg.radius !== undefined ? cfg.radius : 0.30;
  }

  global.getAssemblyZoneCfg = getCfg;
  global.getAssemblySphereTarget = getAssemblySphereTarget;
  global.getAssemblyZoneRadius = getAssemblyZoneRadius;
  global.isInsideAssemblySphere = isInsideAssemblySphere;
})(window);
