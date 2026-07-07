/* global CONFIG, AFRAME */

/**
 * room-containment.js — удержание float-тел внутри room.fogDome + отскок от стенки
 * комнаты (room-dome-collider): отражение от нормали сферы, v' = v − (1+e)(v·n)n.
 */
(function (global) {
  var THREE = global.AFRAME && global.AFRAME.THREE;
  var _world = THREE ? new THREE.Vector3() : { x: 0, y: 0, z: 0 };
  var _local = THREE ? new THREE.Vector3() : { x: 0, y: 0, z: 0 };

  function getWallBounceCfg() {
    var room = global.CONFIG && global.CONFIG.room;
    return (room && room.wallBounce) || {};
  }

  function getRoomWallSurfaceInfo(el, bodyRadius) {
    if (!el || !el.object3D || !global.getRoomDome) return null;

    var dome = global.getRoomDome();
    if (!dome) return null;

    var half = bodyRadius !== undefined ? bodyRadius : 0;
    var inset = dome.containmentMargin !== undefined ? dome.containmentMargin : 0.01;
    var maxR = dome.radius - half - inset;
    if (maxR <= 0.1) return null;

    el.object3D.getWorldPosition(_world);
    var cx = dome.center.x;
    var cy = dome.center.y;
    var cz = dome.center.z;
    var px = _world.x - cx;
    var py = _world.y - cy;
    var pz = _world.z - cz;
    var dist = Math.sqrt(px * px + py * py + pz * pz);
    if (dist < 1e-5) return null;

    var inv = 1 / dist;
    return {
      nx: px * inv,
      ny: py * inv,
      nz: pz * inv,
      dist: dist,
      maxR: maxR,
    };
  }

  function isRoomDomeWallElement(el) {
    if (!el) return false;
    var node = el;
    while (node) {
      if (node.id === 'room-collider') return true;
      node = node.parentElement;
    }
    return false;
  }

  /**
   * Отражение от внутренней стенки комнаты (нормаль n — от центра к объекту).
   * v' = v − (1+e)(v·n)n при v·n > 0. Касательная сохраняется.
   */
  function bounceOffRoomDomeWall(el, rb, bodyRadius, opts) {
    if (!el || !rb) return false;
    opts = opts || {};

    var info = getRoomWallSurfaceInfo(el, bodyRadius);
    if (!info) return false;
    if (typeof rb.getLinearVelocity !== 'function' ||
        typeof rb.setLinearVelocity !== 'function') {
      return false;
    }

    var invWorld = opts.worldVelInvScale;
    if (invWorld === undefined || invWorld < 0.001) invWorld = 1;

    var cfg = getWallBounceCfg();
    var rest = cfg.restitution !== undefined ? cfg.restitution : 0.95;
    var minSp = opts.minBounceSpeed !== undefined
      ? opts.minBounceSpeed
      : (cfg.minBounceSpeed !== undefined ? cfg.minBounceSpeed : 0.2);

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return false;

      var wx = lv.x * invWorld;
      var wy = lv.y * invWorld;
      var wz = lv.z * invWorld;
      var dotOut = wx * info.nx + wy * info.ny + wz * info.nz;
      if (dotOut <= 0) return false;

      var factor = 1 + rest;
      var rx = wx - factor * dotOut * info.nx;
      var ry = wy - factor * dotOut * info.ny;
      var rz = wz - factor * dotOut * info.nz;
      var newSpeed = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (newSpeed < 1e-5) return false;

      if (newSpeed < minSp) {
        var scale = minSp / newSpeed;
        rx *= scale;
        ry *= scale;
        rz *= scale;
      }

      rb.setLinearVelocity({ x: rx, y: ry, z: rz }, false);
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
      return true;
    } catch (e) {
      return false;
    }
  }

  /** tick: у стенки и полёт в стенку (v·n > порог) — отражение. */
  function enforceRoomDomeWallBounce(el, rb, bodyRadius, opts) {
    if (!el || !rb) return false;
    opts = opts || {};

    var info = getRoomWallSurfaceInfo(el, bodyRadius);
    if (!info) return false;

    var cfg = getWallBounceCfg();
    var nearRatio = cfg.nearWallRatio !== undefined ? cfg.nearWallRatio : 0.87;
    if (info.dist < info.maxR * nearRatio) return false;

    var invWorld = opts.worldVelInvScale;
    if (invWorld === undefined || invWorld < 0.001) invWorld = 1;

    if (typeof rb.getLinearVelocity !== 'function') return false;

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return false;

      var wx = lv.x * invWorld;
      var wy = lv.y * invWorld;
      var wz = lv.z * invWorld;
      var speed = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (speed < 0.05) return false;

      var dotOut = wx * info.nx + wy * info.ny + wz * info.nz;
      var inwardSkip = cfg.inwardSkipRatio !== undefined ? cfg.inwardSkipRatio : 0.82;
      if (-dotOut / speed >= inwardSkip) return false;

      var approachMin = cfg.minApproachRatio !== undefined ? cfg.minApproachRatio : 0.04;
      if (dotOut / speed < approachMin) return false;

      return bounceOffRoomDomeWall(el, rb, bodyRadius, opts);
    } catch (e) {
      return false;
    }
  }

  function enforceRoomDomeContainment(el, rb, bodyRadius, opts) {
    if (!el || !rb || !global.getRoomDome) return false;

    var dome = global.getRoomDome();
    if (!dome) return false;

    opts = opts || {};
    var half = bodyRadius !== undefined ? bodyRadius : 0;
    var inset = dome.containmentMargin !== undefined ? dome.containmentMargin : 0.01;
    var maxR = dome.radius - half - inset;
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
    var sphereClip = false;

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
      sphereClip = true;
    }

    if (!outside) return false;

    if (THREE && el.object3D.parent) {
      _local.copy(_world);
      el.object3D.parent.worldToLocal(_local);
      el.object3D.position.copy(_local);
    } else {
      el.object3D.position.set(_world.x, _world.y, _world.z);
    }

    if (sphereClip) {
      bounceOffRoomDomeWall(el, rb, bodyRadius, opts);
      return 'sphere';
    }

    if (typeof rb.getLinearVelocity !== 'function' ||
        typeof rb.setLinearVelocity !== 'function') {
      return 'floor';
    }

    try {
      var lv = rb.getLinearVelocity();
      if (!lv) return 'floor';
      if (lv.y < 0) {
        lv.y = Math.abs(lv.y) * 0.35;
      }
      rb.setLinearVelocity({ x: lv.x, y: lv.y, z: lv.z }, false);
      if (typeof rb.wakeUp === 'function') rb.wakeUp();
    } catch (e) { /* ignore */ }

    return 'floor';
  }

  global.getWallBounceCfg = getWallBounceCfg;
  global.isRoomDomeWallElement = isRoomDomeWallElement;
  global.bounceOffRoomDomeWall = bounceOffRoomDomeWall;
  global.enforceRoomDomeWallBounce = enforceRoomDomeWallBounce;
  global.enforceRoomDomeContainment = enforceRoomDomeContainment;
})(window);
