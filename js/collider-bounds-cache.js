/* global CONFIG, THREE */

/**
 * collider-bounds-cache.js — радиус bounding sphere GLB *_COL для spawn/clamp.
 *
 * loadColliderRadius(url) → Promise<number>
 * preloadSessionColliderBounds(session) — пишет spawnRadius в stages/junk GLB.
 */
(function (global) {
  var cache = {};
  var pending = {};

  function spawnCfg() {
    return (global.CONFIG && CONFIG.spawn) || {};
  }

  function pad() {
    var s = spawnCfg();
    return s.colliderRadiusPad !== undefined ? s.colliderRadiusPad : 0.02;
  }

  function fallbackRadius() {
    var s = spawnCfg();
    if (s.fallbackRadius !== undefined) return s.fallbackRadius;
    var fc = (global.CONFIG && CONFIG.floatingCubes) || {};
    return (fc.size !== undefined ? fc.size : 0.1) / 2;
  }

  function computeRadiusFromScene(root) {
    var box = new THREE.Box3().setFromObject(root);
    var sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    return sphere.radius + pad();
  }

  function loadColliderRadius(url) {
    if (!url) return Promise.resolve(fallbackRadius());
    if (cache[url] !== undefined) return Promise.resolve(cache[url]);
    if (pending[url]) return pending[url];

    pending[url] = new Promise(function (resolve) {
      if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
        cache[url] = fallbackRadius();
        delete pending[url];
        resolve(cache[url]);
        return;
      }
      var loader = new THREE.GLTFLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(url, function (gltf) {
        var root = gltf.scene || gltf.scenes[0];
        if (!root) {
          console.warn('[collider-bounds-cache] empty COL:', url);
          cache[url] = fallbackRadius();
        } else {
          cache[url] = computeRadiusFromScene(root);
        }
        delete pending[url];
        resolve(cache[url]);
      }, undefined, function (err) {
        console.warn('[collider-bounds-cache] load failed:', url, err);
        cache[url] = fallbackRadius();
        delete pending[url];
        resolve(cache[url]);
      });
    });
    return pending[url];
  }

  function getCachedColliderRadius(url) {
    return cache[url] !== undefined ? cache[url] : null;
  }

  function preloadSessionColliderBounds(session) {
    if (!session) return Promise.resolve(session);

    var urls = [];
    var seen = {};
    function add(u) {
      if (!u || seen[u]) return;
      seen[u] = true;
      urls.push(u);
    }

    (session.stages || []).forEach(function (s) { add(s.colliderModel); });
    (session.junkItems || []).forEach(function (j) {
      if (j.type === 'glb') add(j.colliderModel);
    });

    if (!urls.length) return Promise.resolve(session);

    return Promise.all(urls.map(loadColliderRadius)).then(function () {
      (session.stages || []).forEach(function (s) {
        if (s.colliderModel && cache[s.colliderModel] !== undefined) {
          s.spawnRadius = cache[s.colliderModel];
        }
      });
      (session.junkItems || []).forEach(function (j) {
        if (j.type === 'glb' && j.colliderModel && cache[j.colliderModel] !== undefined) {
          j.spawnRadius = cache[j.colliderModel];
        }
      });
      console.log('[collider-bounds-cache] preloaded', urls.length, 'COL radii');
      return session;
    });
  }

  global.loadColliderRadius = loadColliderRadius;
  global.getCachedColliderRadius = getCachedColliderRadius;
  global.preloadSessionColliderBounds = preloadSessionColliderBounds;
})(window);
