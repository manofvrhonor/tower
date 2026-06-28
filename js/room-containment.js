/* global CONFIG, AFRAME */

/**
 * room-containment.js — удержание float-тел внутри room.fogDome.
 */
(function (global) {
  var THREE = global.AFRAME && global.AFRAME.THREE;
  var _world = THREE ? new THREE.Vector3() : { x: 0, y: 0, z: 0 };
  var _local = THREE ? new THREE.Vector3() : { x: 0, y: 0, z: 0 };

  function enforceRoomDomeContainment(el, rb, bodyRadius) {
    if (!el || !rb || !global.getRoomDome) return false;

    var dome = global.getRoomDome();
    if (!dome) return false;

    var half = bodyRadius !== undefined ? bodyRadius : 0;
    var maxR = dome.radius - half - dome.margin;
    if (maxR <= 0.1) return false;

    var cx = dome.center.x;
    var cy = dome.center.y;
    var cz = dome.center.z;
    var minY = cy + half + 0.02;

    el.object3D.getWorldPosition(_world);

    var px = _world.x - cx;
    var py = _world.y - cy;
    var pz = _world.z - cz;
    var nx = 0;
    var ny = 0;
    var nz = 0;
    var outside = false;

    if (_world.y < minY) {
      _world.y = minY;
      py = _world.y - cy;
      outside = true;
    }

    var r2 = px * px + py * py + pz * pz;
    var maxR2 = maxR * maxR;

    if (r2 > maxR2 && r2 > 1e-8) {
      var invR = 1 / Math.sqrt(r2);
      nx = px * invR;
      ny = py * invR;
      nz = pz * invR;
      _world.x = cx + nx * maxR;
      _world.y = cy + ny * maxR;
      _world.z = cz + nz * maxR;
      outside = true;
    }

    if (!outside) return false;

    if (THREE && el.object3D.parent) {
      _local.copy(_world);
      el.object3D.parent.worldToLocal(_local);
      el.object3D.position.copy(_local);
    } else {
      el.object3D.position.set(_world.x, _world.y, _world.z);
    }

    if (typeof rb.getLinearVelocity !== 'function' ||
        typeof rb.setLinearVelocity !== 'function') {
      return true;
    }

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return true;
      if (r2 > maxR2) {
        var dot = lv.x * nx + lv.y * ny + lv.z * nz;
        if (dot > 0) {
          lv.x -= nx * dot * 1.05;
          lv.y -= ny * dot * 1.05;
          lv.z -= nz * dot * 1.05;
        }
      } else if (lv.y < 0) {
        lv.y = Math.abs(lv.y) * 0.35;
      }
      rb.setLinearVelocity({ x: lv.x, y: lv.y, z: lv.z }, false);
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    } catch (e) { /* ignore */ }

    return true;
  }

  global.enforceRoomDomeContainment = enforceRoomDomeContainment;
})(window);
