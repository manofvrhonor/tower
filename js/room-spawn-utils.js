/* global CONFIG */

/**
 * room-spawn-utils.js — точки спавна внутри room.fogDome.
 */
(function (global) {
  function getRoomDome() {
    var room = global.CONFIG && global.CONFIG.room;
    var fd = room && room.fogDome;
    if (!fd || !fd.radius) return null;
    var c = fd.position || { x: 0, y: 0, z: 0 };
    return {
      radius: fd.radius,
      center: { x: c.x, y: c.y, z: c.z },
      margin: fd.spawnMargin !== undefined ? fd.spawnMargin : 0.12,
    };
  }

  function clampPositionToRoomDome(pos, bodyRadius) {
    var dome = getRoomDome();
    if (!dome || !pos) return pos;

    var half = bodyRadius !== undefined ? bodyRadius : 0;
    var maxR = dome.radius - half - dome.margin;
    if (maxR <= 0.1) return pos;

    var cx = dome.center.x;
    var cy = dome.center.y;
    var cz = dome.center.z;
    var out = { x: pos.x, y: pos.y, z: pos.z };
    var minY = cy + half + 0.02;

    if (out.y < minY) out.y = minY;

    var px = out.x - cx;
    var py = out.y - cy;
    var pz = out.z - cz;
    var r2 = px * px + py * py + pz * pz;
    var maxR2 = maxR * maxR;

    if (r2 > maxR2 && r2 > 1e-8) {
      var s = maxR / Math.sqrt(r2);
      out.x = cx + px * s;
      out.y = cy + py * s;
      out.z = cz + pz * s;
    }

    return out;
  }

  global.getRoomDome = getRoomDome;
  global.clampPositionToRoomDome = clampPositionToRoomDome;
})(window);
