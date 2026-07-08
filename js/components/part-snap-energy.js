/* global AFRAME, CONFIG, THREE */

/**
 * part-snap-energy — cyan электроразряды по поверхности GLB в слоте (3.5B.3).
 * Разряды: случайные стартовые точки на mesh, jagged-путь по tangent-плоскости,
 * по одному загораются/гаснут. CONFIG.assemblyZone.partVisual.energy.
 */
AFRAME.registerComponent('part-snap-energy', {
  schema: {},

  init: function () {
    this._visRoot = null;
    this._entries = [];
    this._mode = 'off';
    this._pulse = 1.0;
    this._spawnClock = 0;
    this._tmpV3a = new THREE.Vector3();
    this._tmpV3b = new THREE.Vector3();
    this._tmpV3c = new THREE.Vector3();
    this._tmpV3d = new THREE.Vector3();
  },

  remove: function () {
    this._teardown();
  },

  setMode: function (mode, visRoot) {
    if (visRoot) this._visRoot = visRoot;
    if (mode === 'off' || !this._visRoot) {
      this._teardown();
      this._mode = 'off';
      return;
    }
    this._mode = mode;
    this._ensureEntries();
    this._applyMode(mode);
    this._initBolts();
  },

  tick: function (time, delta) {
    if (this._mode === 'off' || !this._entries.length) return;

    var dt = (delta || 16) / 1000;
    var tSec = time * 0.001;
    var stateCfg = this._stateCfg(this._mode);
    var pulse = 1.0;

    if (this._mode === 'snapped_active') {
      var speed = stateCfg.pulseSpeed !== undefined ? stateCfg.pulseSpeed : 3.0;
      var amp = stateCfg.pulseAmp !== undefined ? stateCfg.pulseAmp : 0.35;
      pulse = 1.0 + amp * Math.sin(tSec * speed);
    }
    this._pulse = pulse;

    var i;
    for (i = 0; i < this._entries.length; i++) {
      var u = this._entries[i].uniforms;
      if (u) {
        u.uTime.value = tSec;
        u.uPulse.value = pulse;
      }
    }

    this._spawnClock += dt;
    this._tickBolts(dt, tSec, stateCfg);
  },

  _readEnergyBase: function () {
    var az = (typeof CONFIG !== 'undefined' && CONFIG.assemblyZone) || {};
    var pv = az.partVisual || {};
    return pv.energy || {};
  },

  _stateCfg: function (mode) {
    if (mode === 'wrist-stored') {
      var wi = (typeof CONFIG !== 'undefined' && CONFIG.wristInventory) || {};
      var se = wi.storedEnergy || {};
      var base = this._readEnergyBase();
      return {
        color: se.color || '#18b8d8',
        glowColor: se.glowColor || '#66f5ff',
        coreColor: se.coreColor || '#d4feff',
        noiseScale: se.noiseScale !== undefined ? se.noiseScale : (base.noiseScale || 9.0),
        scrollSpeed: se.scrollSpeed !== undefined ? se.scrollSpeed : (base.scrollSpeed || 3.2),
        streakSharpness: se.streakSharpness !== undefined
          ? se.streakSharpness : (base.streakSharpness || 4.8),
        flowWarp: se.flowWarp !== undefined ? se.flowWarp : (base.flowWarp || 0.5),
        intensity: se.energyIntensity !== undefined ? se.energyIntensity : 0.88,
        surfaceContrast: se.surfaceContrast !== undefined
          ? se.surfaceContrast : (base.surfaceContrast || 2.6),
        windowStrength: se.windowStrength !== undefined
          ? se.windowStrength : (base.windowStrength || 0.4),
        windowSpeed: se.windowSpeed !== undefined
          ? se.windowSpeed : (base.windowSpeed || 2.4),
        energyTint: se.energyTint !== undefined ? se.energyTint : 0.9,
        fresnelStrength: se.fresnelStrength !== undefined
          ? se.fresnelStrength : (base.fresnelStrength || 0.55),
        boltCount: se.boltCount !== undefined ? se.boltCount : 5,
        boltStepsMin: se.boltStepsMin !== undefined ? se.boltStepsMin : 4,
        boltStepsMax: se.boltStepsMax !== undefined ? se.boltStepsMax : 9,
        boltLifeMin: se.boltLifeMin !== undefined ? se.boltLifeMin : 0.1,
        boltLifeMax: se.boltLifeMax !== undefined ? se.boltLifeMax : 0.32,
      };
    }

    var az = (typeof CONFIG !== 'undefined' && CONFIG.assemblyZone) || {};
    var pv = az.partVisual || {};
    var base = this._readEnergyBase();
    var st = pv[mode] || {};
    return {
      color: st.energyColor || base.color || '#22d4f0',
      glowColor: st.energyGlow || base.glowColor || '#66f5ff',
      coreColor: st.energyCore || base.coreColor || '#e8ffff',
      noiseScale: st.noiseScale !== undefined ? st.noiseScale : (base.noiseScale || 9.0),
      scrollSpeed: st.scrollSpeed !== undefined ? st.scrollSpeed : (base.scrollSpeed || 3.2),
      streakSharpness: st.streakSharpness !== undefined
        ? st.streakSharpness : (base.streakSharpness || 4.8),
      flowWarp: st.flowWarp !== undefined ? st.flowWarp : (base.flowWarp || 0.5),
      intensity: st.energyIntensity !== undefined
        ? st.energyIntensity : (base.intensity || 1.15),
      surfaceContrast: st.surfaceContrast !== undefined
        ? st.surfaceContrast : (base.surfaceContrast || 2.6),
      windowStrength: st.windowStrength !== undefined
        ? st.windowStrength : (base.windowStrength || 0.4),
      windowSpeed: st.windowSpeed !== undefined
        ? st.windowSpeed : (base.windowSpeed || 2.4),
      energyTint: st.energyTint !== undefined
        ? st.energyTint : (base.energyTint || 0.82),
      fresnelStrength: st.fresnelStrength !== undefined
        ? st.fresnelStrength : (base.fresnelStrength || 0.55),
      boltCount: st.boltCount !== undefined ? st.boltCount : (base.boltCount || 6),
      boltStepsMin: st.boltStepsMin !== undefined ? st.boltStepsMin : (base.boltStepsMin || 5),
      boltStepsMax: st.boltStepsMax !== undefined ? st.boltStepsMax : (base.boltStepsMax || 11),
      boltLifeMin: st.boltLifeMin !== undefined ? st.boltLifeMin : (base.boltLifeMin || 0.08),
      boltLifeMax: st.boltLifeMax !== undefined ? st.boltLifeMax : (base.boltLifeMax || 0.28),
      pulseSpeed: st.pulseSpeed,
      pulseAmp: st.pulseAmp,
    };
  },

  _teardown: function () {
    var i;
    for (i = 0; i < this._entries.length; i++) {
      var e = this._entries[i];
      if (e.mesh && e.baseMaterials) {
        e.mesh.material = e.baseMaterials.length === 1
          ? e.baseMaterials[0]
          : e.baseMaterials.slice();
      }
      if (e.energyMaterials) {
        e.energyMaterials.forEach(function (m) { m.dispose(); });
      }
      if (e.boltGroup) {
        e.boltGroup.traverse(function (child) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        if (e.boltGroup.parent) e.boltGroup.parent.remove(e.boltGroup);
      }
    }
    this._entries.length = 0;
  },

  _ensureEntries: function () {
    if (this._entries.length) return;
    var self = this;
    this._visRoot.traverse(function (node) {
      if (!node.isMesh || !node.material) return;
      var src = node.material;
      var baseMats = Array.isArray(src)
        ? src.map(function (m) { return m; })
        : [src];
      self._entries.push({
        mesh: node,
        baseMaterials: baseMats,
        energyMaterials: null,
        uniforms: null,
        surface: self._buildSurfaceCache(node),
        boltGroup: null,
        bolts: [],
      });
    });
  },

  _applyMode: function (mode) {
    var cfg = this._stateCfg(mode);
    var i;

    for (i = 0; i < this._entries.length; i++) {
      var e = this._entries[i];
      if (!e.energyMaterials) {
        var built = this._buildEnergyMaterials(e.baseMaterials, cfg);
        e.energyMaterials = built.materials;
        e.uniforms = built.uniforms;
      } else {
        this._updateEnergyColors(e.uniforms, cfg);
      }
      e.mesh.material = e.energyMaterials.length === 1
        ? e.energyMaterials[0]
        : e.energyMaterials;
    }
  },

  _initBolts: function () {
    var cfg = this._stateCfg(this._mode);
    var ei;
    for (ei = 0; ei < this._entries.length; ei++) {
      var entry = this._entries[ei];
      if (!entry.boltGroup) {
        entry.boltGroup = new THREE.Group();
        entry.boltGroup.name = 'part-snap-bolts';
        entry.mesh.add(entry.boltGroup);
      }
      while (entry.bolts.length < cfg.boltCount) {
        entry.bolts.push(this._makeBolt(entry.boltGroup, cfg));
      }
      while (entry.bolts.length > cfg.boltCount) {
        var rem = entry.bolts.pop();
        entry.boltGroup.remove(rem.line);
        if (rem.line.geometry) rem.line.geometry.dispose();
        if (rem.line.material) rem.line.material.dispose();
      }
      var bi;
      for (bi = 0; bi < entry.bolts.length; bi++) {
        this._deactivateBolt(entry.bolts[bi], cfg);
        entry.bolts[bi].wait = this._hash1(bi * 13.7 + ei) * cfg.boltLifeMax;
      }
    }
  },

  _makeBolt: function (group, cfg) {
    var geo = new THREE.BufferGeometry();
    var mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(cfg.coreColor || '#e8ffff'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    var line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = 1200;
    group.add(line);
    return {
      line: line,
      active: false,
      life: 0,
      maxLife: 0.15,
      wait: 0,
      seed: Math.random() * 1000,
    };
  },

  _deactivateBolt: function (bolt, cfg) {
    bolt.active = false;
    bolt.life = 0;
    bolt.line.material.opacity = 0;
    bolt.line.visible = false;
    bolt.wait = cfg.boltLifeMin + this._hash1(bolt.seed) * (cfg.boltLifeMax - cfg.boltLifeMin);
  },

  _tickBolts: function (dt, tSec, cfg) {
    var ei;
    for (ei = 0; ei < this._entries.length; ei++) {
      var entry = this._entries[ei];
      if (!entry.surface || !entry.surface.samples.length) continue;

      var bi;
      for (bi = 0; bi < entry.bolts.length; bi++) {
        var bolt = entry.bolts[bi];
        if (!bolt.active) {
          bolt.wait -= dt;
          if (bolt.wait <= 0) {
            bolt.seed = Math.random() * 10000 + tSec * 17.3;
            this._spawnBolt(bolt, entry, cfg);
          }
          continue;
        }

        bolt.life -= dt;
        var u = 1 - bolt.life / bolt.maxLife;
        var fade = u < 0.15 ? u / 0.15 : (u > 0.75 ? (1 - u) / 0.25 : 1);
        var flicker = 0.7 + 0.3 * Math.sin(tSec * 22 + bolt.seed);
        bolt.line.material.opacity = fade * flicker * this._pulse;
        if (bolt.life <= 0) {
          this._deactivateBolt(bolt, cfg);
        }
      }
    }
  },

  _spawnBolt: function (bolt, entry, cfg) {
    var pts = this._generateSurfaceBolt(entry.surface, cfg, bolt.seed);
    if (!pts || pts.length < 6) {
      bolt.wait = cfg.boltLifeMin * 0.5;
      return;
    }
    bolt.line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    bolt.line.geometry.attributes.position.needsUpdate = true;
    bolt.line.geometry.computeBoundingSphere();
    bolt.line.material.color.set(cfg.glowColor || cfg.color);
    bolt.line.visible = true;
    bolt.active = true;
    bolt.maxLife = cfg.boltLifeMin + this._hash1(bolt.seed + 2.1)
      * (cfg.boltLifeMax - cfg.boltLifeMin);
    bolt.life = bolt.maxLife;
    bolt.line.material.opacity = 0.05;
  },

  _generateSurfaceBolt: function (surface, cfg, seed) {
    var samples = surface.samples;
    if (samples.length < 4) return null;

    var stepsMin = cfg.boltStepsMin || 5;
    var stepsMax = cfg.boltStepsMax || 11;
    var steps = stepsMin + Math.floor(this._hash1(seed) * (stepsMax - stepsMin + 1));

    var startIdx = Math.floor(this._hash1(seed + 0.17) * samples.length);
    var current = samples[startIdx];
    var prevIdx = startIdx;
    var pts = [current.position.x, current.position.y, current.position.z];
    var stepLen = surface.avgEdge * (0.35 + this._hash1(seed + 4.2) * 0.55);

    var si;
    for (si = 1; si <= steps; si++) {
      var n = current.normal;
      this._tmpV3a.set(
        this._hash1(seed + si * 1.9) - 0.5,
        this._hash1(seed + si * 2.7) - 0.5,
        this._hash1(seed + si * 3.1) - 0.5
      );
      if (this._tmpV3a.lengthSq() < 1e-6) this._tmpV3a.set(1, 0, 0);
      this._tmpV3a.normalize();
      this._tmpV3b.crossVectors(n, this._tmpV3a).normalize();
      if (this._tmpV3b.lengthSq() < 1e-6) this._tmpV3b.set(0, 1, 0);
      this._tmpV3c.crossVectors(n, this._tmpV3b).normalize();

      var angle = this._hash1(seed + si * 5.3) * Math.PI * 2;
      var jag = 0.55 + this._hash1(seed + si * 6.1) * 0.9;
      var len = stepLen * jag;
      this._tmpV3d
        .copy(current.position)
        .addScaledVector(this._tmpV3b, Math.cos(angle) * len)
        .addScaledVector(this._tmpV3c, Math.sin(angle) * len);

      var bestIdx = -1;
      var bestDist = Infinity;
      var j;
      for (j = 0; j < samples.length; j++) {
        if (j === prevIdx) continue;
        var d = this._tmpV3d.distanceToSquared(samples[j].position);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = j;
        }
      }
      if (bestIdx < 0) break;

      current = samples[bestIdx];
      prevIdx = bestIdx;
      pts.push(current.position.x, current.position.y, current.position.z);
    }

    return pts.length >= 6 ? pts : null;
  },

  _buildSurfaceCache: function (mesh) {
    var geo = mesh.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) {
      return { samples: [], avgEdge: 0.02 };
    }

    if (!geo.boundingBox) geo.computeBoundingBox();
    var box = geo.boundingBox;
    var diag = box
      ? box.max.distanceTo(box.min)
      : 0.2;
    var avgEdge = Math.max(diag * 0.06, 0.004);

    var posAttr = geo.attributes.position;
    var index = geo.index;
    var triCount = index ? index.count / 3 : posAttr.count / 3;
    if (triCount < 1) return { samples: [], avgEdge: avgEdge };

    var tris = [];
    var totalArea = 0;
    var ti;
    for (ti = 0; ti < triCount; ti++) {
      var ia = index ? index.getX(ti * 3) : ti * 3;
      var ib = index ? index.getX(ti * 3 + 1) : ti * 3 + 1;
      var ic = index ? index.getX(ti * 3 + 2) : ti * 3 + 2;
      this._readVert(posAttr, ia, this._tmpV3a);
      this._readVert(posAttr, ib, this._tmpV3b);
      this._readVert(posAttr, ic, this._tmpV3c);
      var area = this._triArea(this._tmpV3a, this._tmpV3b, this._tmpV3c);
      if (area < 1e-8) continue;
      totalArea += area;
      tris.push({
        va: this._tmpV3a.clone(),
        vb: this._tmpV3b.clone(),
        vc: this._tmpV3c.clone(),
        cum: totalArea,
      });
    }

    if (!tris.length || totalArea <= 0) {
      return { samples: [], avgEdge: avgEdge };
    }

    var target = Math.min(480, Math.max(96, tris.length * 3));
    var samples = [];
    var si;
    for (si = 0; si < target; si++) {
      var r = this._hash1(si * 19.13 + 0.42) * totalArea;
      var tri = this._pickTri(tris, r);
      var u = this._hash1(si * 7.31);
      var v = this._hash1(si * 11.07);
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      var w = 1 - u - v;
      var p = new THREE.Vector3(
        tri.va.x * w + tri.vb.x * u + tri.vc.x * v,
        tri.va.y * w + tri.vb.y * u + tri.vc.y * v,
        tri.va.z * w + tri.vb.z * u + tri.vc.z * v
      );
      this._tmpV3b.subVectors(tri.vb, tri.va);
      this._tmpV3c.subVectors(tri.vc, tri.va);
      this._tmpV3b.cross(this._tmpV3c).normalize();
      samples.push({ position: p, normal: this._tmpV3b.clone() });
    }

    return { samples: samples, avgEdge: avgEdge };
  },

  _readVert: function (attr, idx, out) {
    out.set(attr.getX(idx), attr.getY(idx), attr.getZ(idx));
  },

  _triArea: function (a, b, c) {
    this._tmpV3d.subVectors(b, a);
    this._tmpV3b.subVectors(c, a);
    return this._tmpV3d.cross(this._tmpV3b).length() * 0.5;
  },

  _pickTri: function (tris, r) {
    var lo = 0;
    var hi = tris.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (tris[mid].cum < r) lo = mid + 1;
      else hi = mid;
    }
    return tris[lo];
  },

  _hash1: function (n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  },

  _updateEnergyColors: function (uniforms, cfg) {
    uniforms.uColor.value.set(cfg.color);
    uniforms.uGlowColor.value.set(cfg.glowColor);
    uniforms.uCoreColor.value.set(cfg.coreColor);
    uniforms.uIntensity.value = cfg.intensity;
    uniforms.uSurfaceContrast.value = cfg.surfaceContrast;
    uniforms.uWindowStrength.value = cfg.windowStrength;
    uniforms.uWindowSpeed.value = cfg.windowSpeed;
    uniforms.uEnergyTint.value = cfg.energyTint;
    uniforms.uFresnelStrength.value = cfg.fresnelStrength;
  },

  _buildEnergyMaterials: function (baseMats, cfg) {
    var uniforms = {
      uTime: { value: 0 },
      uPulse: { value: 1 },
      uColor: { value: new THREE.Color(cfg.color) },
      uGlowColor: { value: new THREE.Color(cfg.glowColor) },
      uCoreColor: { value: new THREE.Color(cfg.coreColor) },
      uNoiseScale: { value: cfg.noiseScale },
      uScrollSpeed: { value: cfg.scrollSpeed },
      uStreakSharpness: { value: cfg.streakSharpness },
      uFlowWarp: { value: cfg.flowWarp },
      uIntensity: { value: cfg.intensity },
      uSurfaceContrast: { value: cfg.surfaceContrast },
      uWindowStrength: { value: cfg.windowStrength },
      uWindowSpeed: { value: cfg.windowSpeed },
      uEnergyTint: { value: cfg.energyTint },
      uFresnelStrength: { value: cfg.fresnelStrength },
      uBaseColor: { value: new THREE.Color(0xffffff) },
      uMap: { value: null },
      uHasMap: { value: false },
    };

    var base = baseMats[0];
    if (base && base.color) uniforms.uBaseColor.value.copy(base.color);
    if (base && base.map) {
      uniforms.uMap.value = base.map;
      uniforms.uHasMap.value = true;
    }

    var vertexShader = [
      'varying vec3 vWorldPos;',
      'varying vec3 vNormalW;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vWorldPos = wp.xyz;',
      '  vNormalW = normalize(mat3(modelMatrix) * normal);',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}',
    ].join('\n');

    var fragmentShader = [
      'uniform float uTime;',
      'uniform float uPulse;',
      'uniform vec3 uColor;',
      'uniform vec3 uGlowColor;',
      'uniform vec3 uCoreColor;',
      'uniform float uNoiseScale;',
      'uniform float uScrollSpeed;',
      'uniform float uStreakSharpness;',
      'uniform float uFlowWarp;',
      'uniform float uIntensity;',
      'uniform float uSurfaceContrast;',
      'uniform float uWindowStrength;',
      'uniform float uWindowSpeed;',
      'uniform float uEnergyTint;',
      'uniform float uFresnelStrength;',
      'uniform vec3 uBaseColor;',
      'uniform sampler2D uMap;',
      'uniform bool uHasMap;',
      'varying vec3 vWorldPos;',
      'varying vec3 vNormalW;',
      'varying vec2 vUv;',
      'float hash(vec3 p) {',
      '  p = fract(p * 0.1031);',
      '  p += dot(p, p.yzx + 33.33);',
      '  return fract((p.x + p.y) * p.z);',
      '}',
      'float vnoise(vec3 p) {',
      '  vec3 i = floor(p);',
      '  vec3 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  float n000 = hash(i);',
      '  float n100 = hash(i + vec3(1.0, 0.0, 0.0));',
      '  float n010 = hash(i + vec3(0.0, 1.0, 0.0));',
      '  float n110 = hash(i + vec3(1.0, 1.0, 0.0));',
      '  float n001 = hash(i + vec3(0.0, 0.0, 1.0));',
      '  float n101 = hash(i + vec3(1.0, 0.0, 1.0));',
      '  float n011 = hash(i + vec3(0.0, 1.0, 1.0));',
      '  float n111 = hash(i + vec3(1.0, 1.0, 1.0));',
      '  float nx00 = mix(n000, n100, f.x);',
      '  float nx10 = mix(n010, n110, f.x);',
      '  float nx01 = mix(n001, n101, f.x);',
      '  float nx11 = mix(n011, n111, f.x);',
      '  float nxy0 = mix(nx00, nx10, f.y);',
      '  float nxy1 = mix(nx01, nx11, f.y);',
      '  return mix(nxy0, nxy1, f.z);',
      '}',
      'float ridged(vec3 p) {',
      '  float v = 0.0;',
      '  float a = 0.55;',
      '  for (int i = 0; i < 4; i++) {',
      '    float n = vnoise(p);',
      '    n = 1.0 - abs(n * 2.0 - 1.0);',
      '    n = n * n;',
      '    v += n * a;',
      '    p = p * 2.1 + vec3(1.7, 2.3, 0.6);',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      'void main() {',
      '  vec3 base = uBaseColor;',
      '  if (uHasMap) base *= texture2D(uMap, vUv).rgb;',
      '  float t = uTime * uScrollSpeed;',
      '  vec3 p = vWorldPos * uNoiseScale;',
      '  p += vec3(vnoise(p + t), vnoise(p.zxy + t * 1.3), vnoise(p.yzx - t * 0.9)) * uFlowWarp;',
      '  p += vec3(t * 0.55, t * 1.35, t * 0.45);',
      '  float r1 = ridged(p);',
      '  float r2 = ridged(p * 2.35 + vec3(4.1, 1.2, 2.7));',
      '  float streak = max(r1, r2 * 0.88);',
      '  streak = pow(clamp(streak, 0.0, 1.0), uStreakSharpness);',
      '  streak = smoothstep(0.22, 0.78, streak);',
      '  streak = pow(streak, 1.0 / max(uSurfaceContrast * 0.38, 0.5));',
      '  float cell = hash(floor(vWorldPos * (uNoiseScale * 0.42) + vec3(0.0, t * 2.8, 0.0)));',
      '  float wave = sin(dot(vWorldPos, vec3(1.6, 6.2, 2.1)) - t * 6.5 + cell * 6.283) * 0.5 + 0.5;',
      '  float bolt = smoothstep(0.38, 0.92, wave);',
      '  bolt *= smoothstep(0.18, 0.85, streak);',
      '  float nWin = vnoise(vWorldPos * uNoiseScale * 3.8 + vec3(t * uWindowSpeed, t * 1.1, -t * 0.85));',
      '  float windows = smoothstep(0.52, 0.82, nWin);',
      '  bolt = max(bolt, windows * streak * uWindowStrength);',
      '  float hot = pow(streak * bolt, 2.2);',
      '  float energy = clamp(streak * bolt * uIntensity * uPulse, 0.0, 1.0);',
      '  vec3 glow = mix(uColor * 0.45, uGlowColor, streak * uEnergyTint);',
      '  glow = mix(glow, uCoreColor, hot * 0.92);',
      '  vec3 viewDir = normalize(cameraPosition - vWorldPos);',
      '  float fres = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), 2.1);',
      '  glow += uCoreColor * fres * uFresnelStrength;',
      '  vec3 darkBase = base * 0.48;',
      '  vec3 col = mix(darkBase, base, 1.0 - streak * 0.35);',
      '  col = col * (1.0 - energy * 0.72) + glow * energy * 2.35;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n');

    var materials = [];
    var mi;
    for (mi = 0; mi < baseMats.length; mi++) {
      var bm = baseMats[mi];
      var u = mi === 0 ? uniforms : {
        uTime: uniforms.uTime,
        uPulse: uniforms.uPulse,
        uColor: { value: uniforms.uColor.value.clone() },
        uGlowColor: { value: uniforms.uGlowColor.value.clone() },
        uCoreColor: { value: uniforms.uCoreColor.value.clone() },
        uNoiseScale: uniforms.uNoiseScale,
        uScrollSpeed: uniforms.uScrollSpeed,
        uStreakSharpness: uniforms.uStreakSharpness,
        uFlowWarp: uniforms.uFlowWarp,
        uIntensity: uniforms.uIntensity,
        uSurfaceContrast: uniforms.uSurfaceContrast,
        uWindowStrength: uniforms.uWindowStrength,
        uWindowSpeed: uniforms.uWindowSpeed,
        uEnergyTint: uniforms.uEnergyTint,
        uFresnelStrength: uniforms.uFresnelStrength,
        uBaseColor: { value: (bm.color ? bm.color.clone() : new THREE.Color(0xffffff)) },
        uMap: { value: bm.map || null },
        uHasMap: { value: !!bm.map },
      };
      materials.push(new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        lights: false,
        fog: false,
      }));
    }

    return { materials: materials, uniforms: uniforms };
  },
});
