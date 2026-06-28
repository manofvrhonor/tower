/* global AFRAME, CONFIG, THREE */

/**
 * collider-debug-viz — контуры РЕАЛЬНЫХ PhysX shape (PxShape), не A-Frame mesh.
 *
 * Читает physx-body.shapes → getBoxGeometry / getSphereGeometry / convex fallback
 * (те же вершины, что ушли в cooking). Позиция каждый кадр из rigidBody.getGlobalPose().
 * Материалы игровых объектов не трогаются — только LineSegments поверх сцены.
 */

(function () {
  var DEFAULT_LAYERS = {
    WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
    GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
  };

  var _vec = new THREE.Vector3();
  var _mat4 = new THREE.Matrix4();

  function isEnabled() {
    return !!(window.CONFIG && CONFIG.debug && CONFIG.debug.showColliders);
  }

  function debugCfg() {
    return (window.CONFIG && CONFIG.debug) || {};
  }

  function getPhysX(sceneEl) {
    var sys = sceneEl && sceneEl.systems && sceneEl.systems.physx;
    return sys && sys.PhysX;
  }

  function collisionLayersMap() {
    return (window.CONFIG && CONFIG.collisionLayers) || DEFAULT_LAYERS;
  }

  function layerIndexToName(index) {
    var L = collisionLayersMap();
    for (var key in L) {
      if (L[key] === index) return key;
    }
    return null;
  }

  function parseCollisionLayer(el) {
    var mat = el.getAttribute('physx-material');
    if (!mat) return null;
    if (typeof mat === 'object' && mat.collisionLayers !== undefined) {
      return parseInt(mat.collisionLayers, 10);
    }
    if (typeof mat === 'string') {
      var m = mat.match(/collisionLayers:\s*(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  function parseBodyType(el) {
    var body = el.getAttribute('physx-body');
    if (!body) return null;
    if (typeof body === 'object' && body.type) return body.type;
    if (typeof body === 'string') {
      var m = body.match(/type:\s*(\w+)/);
      if (m) return m[1];
    }
    return null;
  }

  function resolveColliderType(el) {
    if (!el) return 'KINEMATIC';
    if (el.is && (el.is('grabbed-dynamic') || el.is('grabbed'))) return 'GRABBED_CUBE';
    if (el.components['red-ball']) return 'BALL';
    if (el.components['ball-bat']) return 'BAT';
    if (el.components['floating-cube']) {
      return el.components['floating-cube'].state === 'gravity' ? 'GRAVITY_CUBE' : 'FLOAT_CUBE';
    }
    var layerIdx = parseCollisionLayer(el);
    if (layerIdx !== null) {
      var name = layerIndexToName(layerIdx);
      if (name) return name;
    }
    if (parseBodyType(el) === 'kinematic') return 'HAND';
    return 'KINEMATIC';
  }

  function colorForType(type) {
    var palette = debugCfg().colliderColors || {};
    return palette[type] || palette.KINEMATIC || '#ffffff';
  }

  function lineMaterial(color) {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      depthTest: false,
      transparent: true,
      opacity: debugCfg().colliderOpacity !== undefined ? debugCfg().colliderOpacity : 0.95,
    });
  }

  function makeEdgeLines(bufferGeom, color) {
    var edges = new THREE.EdgesGeometry(bufferGeom);
    var lines = new THREE.LineSegments(edges, lineMaterial(color));
    lines.renderOrder = 1000;
    edges.dispose();
    return lines;
  }

  /** Тот же traverse, что в @c-frame/physx createShapes (physics.js). */
  function shouldTraverseMesh(obj3D) {
    if (obj3D.el && obj3D.el.hasAttribute('physx-no-collision')) return false;
    if (obj3D.el && !obj3D.el.object3D.visible && !obj3D.el.hasAttribute('physx-hidden-collision')) {
      return false;
    }
    if (!obj3D.visible && obj3D.el && !obj3D.el.hasAttribute('physx-hidden-collision')) return false;
    if (obj3D.userData && obj3D.userData.vartisteUI) return false;
    return true;
  }

  function collectCollisionMeshes(el) {
    var root = el.object3D;
    var meshes = [];

    function walk(obj3D) {
      if (!shouldTraverseMesh(obj3D)) return;
      if (obj3D.geometry) {
        var mesh = obj3D;
        if (mesh.isMesh || mesh.geometry) meshes.push(mesh);
      }
      for (var i = 0; i < obj3D.children.length; i++) {
        walk(obj3D.children[i]);
      }
    }

    walk(root);
    return meshes;
  }

  /** Вершины mesh в локальном пространстве physx-body (как createConvexMeshGeometry). */
  function geometryInBodyLocalSpace(mesh, rootAncestor) {
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes.position) return null;

    _mat4.identity();
    mesh.updateMatrix();
    _mat4.copy(mesh.matrix);
    var ancestor = mesh.parent;
    while (ancestor && ancestor !== rootAncestor) {
      ancestor.updateMatrix();
      _mat4.premultiply(ancestor.matrix);
      ancestor = ancestor.parent;
    }

    var src = mesh.geometry;
    var cloned = src.clone();
    cloned.applyMatrix4(_mat4);
    return cloned;
  }

  function sphereRadiusFromEntity(el) {
    if (!el) return null;
    var geo = el.getAttribute('geometry');
    if (geo && geo.primitive === 'sphere' && geo.radius) {
      el.object3D.getWorldScale(_vec);
      return geo.radius * _vec.x * 0.98;
    }
    var rAttr = el.getAttribute('radius');
    if (rAttr !== null && rAttr !== undefined) {
      el.object3D.getWorldScale(_vec);
      return parseFloat(rAttr, 10) * _vec.x * 0.98;
    }
    return null;
  }

  function readSphereRadius(sphereGeom, el) {
    if (sphereGeom.radius !== undefined && sphereGeom.radius > 0) return sphereGeom.radius;
    if (typeof sphereGeom.getRadius === 'function') {
      var gr = sphereGeom.getRadius();
      if (gr > 0) return gr;
    }
    return sphereRadiusFromEntity(el);
  }

  function buildLinesFromPxShape(PX, shape, color, convexSourceMesh, rootObj3D, el) {
    var boxGeom = new PX.PxBoxGeometry(0, 0, 0);
    if (shape.getBoxGeometry(boxGeom)) {
      var he = boxGeom.halfExtents;
      var hx = he.x || he.x === 0 ? he.x : 0.01;
      var hy = he.y || he.y === 0 ? he.y : 0.01;
      var hz = he.z || he.z === 0 ? he.z : 0.01;
      var box = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
      var lines = makeEdgeLines(box, color);
      box.dispose();
      return lines;
    }

    var sphGeom = new PX.PxSphereGeometry(0);
    if (shape.getSphereGeometry(sphGeom)) {
      var radius = readSphereRadius(sphGeom, el);
      if (radius && radius > 0) {
        var sphere = new THREE.SphereGeometry(radius, 14, 10);
        var sLines = makeEdgeLines(sphere, color);
        sphere.dispose();
        return sLines;
      }
    }

    if (convexSourceMesh) {
      var fallbackGeom = geometryInBodyLocalSpace(convexSourceMesh, rootObj3D);
      if (fallbackGeom) {
        var fLines = makeEdgeLines(fallbackGeom, color);
        fallbackGeom.dispose();
        return fLines;
      }
    }

    return null;
  }

  function applyPhysXPose(obj3D, pose) {
    if (!pose || !pose.translation || !pose.rotation) return;
    obj3D.position.set(pose.translation.x, pose.translation.y, pose.translation.z);
    obj3D.quaternion.set(
      pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w
    );
  }

  function disposeEntry(entry) {
    if (!entry) return;
    for (var i = 0; i < entry.shapeGroups.length; i++) {
      var g = entry.shapeGroups[i];
      if (g.parent) g.parent.remove(g);
      g.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
    entry.shapeGroups.length = 0;
  }

  function buildEntry(el, PX, debugRoot) {
    var bodyComp = el.components['physx-body'];
    if (!bodyComp || !bodyComp.rigidBody || !bodyComp.shapes) return null;

    var shapes = Array.isArray(bodyComp.shapes) ? bodyComp.shapes : [bodyComp.shapes];
    if (!shapes.length) return null;

    var collisionMeshes = collectCollisionMeshes(el);
    var convexMeshIdx = 0;
    var color = colorForType(resolveColliderType(el));
    var shapeGroups = [];

    for (var s = 0; s < shapes.length; s++) {
      var shape = shapes[s];
      if (!shape) continue;

      var sourceMesh = null;
      var boxProbe = new PX.PxBoxGeometry(0, 0, 0);
      var sphProbe = new PX.PxSphereGeometry(0);
      var isPrimitive = shape.getBoxGeometry(boxProbe) || shape.getSphereGeometry(sphProbe);
      if (!isPrimitive) {
        sourceMesh = collisionMeshes[convexMeshIdx] || null;
        convexMeshIdx++;
      }

      var lines = buildLinesFromPxShape(
        PX, shape, color, sourceMesh, el.object3D, el
      );
      if (!lines) continue;

      var group = new THREE.Group();
      group.add(lines);
      debugRoot.add(group);
      shapeGroups.push(group);
    }

    if (!shapeGroups.length) return null;

    return {
      el: el,
      bodyComp: bodyComp,
      shapeGroups: shapeGroups,
      type: resolveColliderType(el),
    };
  }

  function logLegendOnce() {
    if (logLegendOnce._done) return;
    logLegendOnce._done = true;
    console.log(
      '[collider-debug-viz] PhysX PxShape contours (getBoxGeometry/getSphereGeometry).',
      'Palette:', debugCfg().colliderColors,
      '— off: CONFIG.debug.showColliders=false'
    );
  }

  window.applyColliderDebugVisual = function () {
    if (window.__colliderDebugRescan) window.__colliderDebugRescan();
  };

  AFRAME.registerComponent('collider-debug-viz', {
    schema: {
      intervalMs: { type: 'number', default: 600 },
    },

    init: function () {
      this._entries = new Map();
      this.debugRoot = new THREE.Group();
      this.debugRoot.name = 'physx-collider-debug';
      this.el.object3D.add(this.debugRoot);

      var self = this;
      window.__colliderDebugRescan = function () { self._scan(true); };

      this._scan = this._scan.bind(this);
      this.el.addEventListener('loaded', function () { self._scan(true); });
      setTimeout(function () { self._scan(true); }, 2000);
      this._timerId = setInterval(this._scan, this.data.intervalMs);
    },

    remove: function () {
      if (this._timerId) clearInterval(this._timerId);
      window.__colliderDebugRescan = null;
      var self = this;
      this._entries.forEach(function (entry) { disposeEntry(entry); });
      this._entries.clear();
      if (this.debugRoot.parent) this.debugRoot.parent.remove(this.debugRoot);
    },

    tick: function () {
      if (!isEnabled()) return;

      var self = this;
      this._entries.forEach(function (entry) {
        var rb = entry.bodyComp && entry.bodyComp.rigidBody;
        if (!rb || typeof rb.getGlobalPose !== 'function') return;
        var pose = rb.getGlobalPose();
        for (var i = 0; i < entry.shapeGroups.length; i++) {
          applyPhysXPose(entry.shapeGroups[i], pose);
        }
      });
    },

    _scan: function (forceRebuild) {
      if (!isEnabled()) {
        this._clearAll();
        return;
      }

      var PX = getPhysX(this.el);
      if (!PX) return;

      var nodes = this.el.querySelectorAll('[physx-body]');
      var seen = new Set();
      var built = 0;
      var updated = 0;

      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        seen.add(el);
        var type = resolveColliderType(el);
        var prev = this._entries.get(el);

        if (prev && !forceRebuild && prev.type === type && prev.shapeGroups.length > 0) {
          continue;
        }

        if (prev) {
          disposeEntry(prev);
          this._entries.delete(el);
        }

        var entry = buildEntry(el, PX, this.debugRoot);
        if (entry) {
          this._entries.set(el, entry);
          var rb = entry.bodyComp.rigidBody;
          if (rb && rb.getGlobalPose) {
            var pose = rb.getGlobalPose();
            for (var g = 0; g < entry.shapeGroups.length; g++) {
              applyPhysXPose(entry.shapeGroups[g], pose);
            }
          }
          built++;
        }
      }

      this._entries.forEach(function (entry, el) {
        if (!seen.has(el)) {
          disposeEntry(entry);
          this._entries.delete(el);
        }
      }, this);

      if (built > 0 && !this._loggedOnce) {
        this._loggedOnce = true;
        console.log('[collider-debug-viz] PhysX shapes drawn:', built);
        logLegendOnce();
      } else if (built > 0) {
        updated = built;
      }

      if (!this._loggedOnce && this._entries.size > 0) {
        this._loggedOnce = true;
        logLegendOnce();
      }
    },

    _clearAll: function () {
      var self = this;
      this._entries.forEach(function (entry) { disposeEntry(entry); });
      this._entries.clear();
    },
  });
})();
