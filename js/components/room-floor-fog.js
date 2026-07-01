/* global AFRAME, CONFIG, THREE */

/**
 * room-floor-fog — низкий туман у пола снаружи cyan-купола (Фаза 3.2).
 *
 * 14 волнистых колец, depthTest:false (объём). Depth-prepass: шейдер отсекает
 * фрагменты за opaque-объектами (кубы). Wall-clock, не slo-mo.
 */
AFRAME.registerComponent('room-floor-fog', {
  schema: {},

  init: function () {
    this._group = null;
    this._uniformSets = [];
    this._depthUniforms = null;
    this._depthTarget = null;
    this._origRender = null;
    this._depthPassReady = false;
    this._cfg = this._readCfg();
    if (!this._cfg.enabled) return;

    this._depthUniforms = {
      uDepthMap: { value: null },
      uScreenSize: { value: new THREE.Vector2(1, 1) },
      uDepthBias: { value: this._cfg.depthBias },
    };

    this._buildFog();

    var self = this;
    var sceneEl = this.el.sceneEl;
    if (sceneEl.hasLoaded) {
      this._setupDepthPass();
    } else {
      sceneEl.addEventListener('loaded', function () {
        self._setupDepthPass();
      });
    }
  },

  remove: function () {
    this._teardownDepthPass();
    if (!this._group) return;
    var i;
    var children = this._group.children.slice();
    for (i = 0; i < children.length; i++) {
      var mesh = children[i];
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
    this.el.object3D.remove(this._group);
    this._group = null;
    this._uniformSets = [];
  },

  tick: function (time) {
    var t = time * 0.001;
    var i;
    for (i = 0; i < this._uniformSets.length; i++) {
      this._uniformSets[i].uTime.value = t;
    }
  },

  _maybeResizeDepthTarget: function (renderer) {
    var size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!this._depthTarget) return;
    if (this._depthTarget.width === size.x && this._depthTarget.height === size.y) {
      return;
    }
    this._depthTarget.setSize(size.x, size.y);
    this._depthUniforms.uScreenSize.value.set(size.x, size.y);
  },

  _setupDepthPass: function () {
    if (this._depthPassReady || !this._group) return;
    var sceneEl = this.el.sceneEl;
    var renderer = sceneEl.renderer;
    if (!renderer || this._origRender) return;

    var size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this._depthTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this._depthTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this._depthTarget.depthTexture.format = THREE.DepthFormat;
    this._depthTarget.depthTexture.type = THREE.UnsignedInt248Type;

    this._depthUniforms.uScreenSize.value.set(size.x, size.y);
    this._depthUniforms.uDepthMap.value = this._depthTarget.depthTexture;

    this._origRender = renderer.render.bind(renderer);
    var self = this;

    renderer.render = function (scene, camera) {
      if (!self._group) {
        self._origRender(scene, camera);
        return;
      }
      self._maybeResizeDepthTarget(renderer);
      self._group.visible = false;
      renderer.setRenderTarget(self._depthTarget);
      renderer.clear();
      self._origRender(scene, camera);
      renderer.setRenderTarget(null);
      self._group.visible = true;
      self._origRender(scene, camera);
    };

    this._depthPassReady = true;
  },

  _teardownDepthPass: function () {
    var sceneEl = this.el.sceneEl;
    if (this._origRender && sceneEl && sceneEl.renderer) {
      sceneEl.renderer.render = this._origRender;
      this._origRender = null;
    }
    if (this._depthTarget) {
      this._depthTarget.dispose();
      this._depthTarget = null;
    }
    this._depthPassReady = false;
  },

  _buildAutoLayers: function (ff, height) {
    var count = ff.layerCount !== undefined ? ff.layerCount : 14;
    var spread = ff.layerSpread !== undefined ? ff.layerSpread : 0.08;
    var bias = ff.verticalBias !== undefined ? ff.verticalBias : 0.02;
    var falloffPow = ff.verticalFalloffPower !== undefined ? ff.verticalFalloffPower : 2.4;
    var layers = [];
    var i;
    var t;
    var y;
    var dy;
    var mul;
    var floorWeight;
    var sigma = spread;

    for (i = 0; i < count; i++) {
      t = (i + 0.5) / count;
      y = t * height;
      dy = y - bias;
      mul = Math.exp(-(dy * dy) / (2.0 * sigma * sigma));
      floorWeight = Math.pow(1.0 - (y / Math.max(height, 0.001)), falloffPow);
      mul *= floorWeight;
      layers.push({ y: y, opacityMul: mul });
    }
    return layers;
  },

  _readCfg: function () {
    var room = (typeof CONFIG !== 'undefined' && CONFIG.room) || {};
    var fd = room.fogDome || {};
    var ff = room.floorFog || {};
    var pos = ff.position || fd.position || {};
    var domeR = fd.radius !== undefined ? fd.radius : 2.0;
    var floorR = fd.floorRadius !== undefined ? fd.floorRadius : 50;
    var height = ff.height !== undefined ? ff.height : 0.6;
    var layers = ff.layers;

    if (ff.autoLayers !== false && (!layers || !layers.length)) {
      layers = this._buildAutoLayers(ff, height);
    } else if (!layers || !layers.length) {
      layers = this._buildAutoLayers({}, height);
    }

    return {
      enabled: ff.enabled !== false,
      innerRadius: ff.innerRadius !== undefined ? ff.innerRadius : domeR,
      outerRadius: ff.outerRadius !== undefined ? ff.outerRadius : floorR,
      height: height,
      layers: layers,
      depthBias: ff.depthBias !== undefined ? ff.depthBias : 0.00035,
      position: {
        x: pos.x !== undefined ? pos.x : 0,
        y: pos.y !== undefined ? pos.y : 0,
        z: pos.z !== undefined ? pos.z : 0,
      },
      color: new THREE.Color(ff.color || '#ffffff'),
      glowColor: new THREE.Color(ff.glowColor || '#f8f8f8'),
      opacity: ff.opacity !== undefined ? ff.opacity : 1.0,
      baseOpacity: ff.baseOpacity !== undefined ? ff.baseOpacity : 0.52,
      peakOpacity: ff.peakOpacity !== undefined ? ff.peakOpacity : 1.0,
      noiseScale: ff.noiseScale !== undefined ? ff.noiseScale : 0.28,
      puffScale: ff.puffScale !== undefined ? ff.puffScale : 0.09,
      scrollSpeed: ff.scrollSpeed !== undefined ? ff.scrollSpeed : 0.005625,
      edgeSoftness: ff.edgeSoftness !== undefined ? ff.edgeSoftness : 4.5,
      billowAmplitude: ff.billowAmplitude !== undefined ? ff.billowAmplitude : 0.21,
      billowSpeed: ff.billowSpeed !== undefined ? ff.billowSpeed : 0.00625,
      verticalFalloffPower: ff.verticalFalloffPower !== undefined
        ? ff.verticalFalloffPower : 2.4,
      thetaSegments: ff.thetaSegments !== undefined ? ff.thetaSegments : 72,
      radialSegments: ff.radialSegments !== undefined ? ff.radialSegments : 10,
      renderOrder: ff.renderOrder !== undefined ? ff.renderOrder : 4,
    };
  },

  _shaderNoiseBlock: function () {
    return [
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
      'float fbm3(vec3 p) {',
      '  float v = 0.0;',
      '  float a = 0.5;',
      '  for (int i = 0; i < 4; i++) {',
      '    v += a * vnoise(p);',
      '    p *= 2.03;',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
    ].join('\n');
  },

  _createFogMaterial: function (layerY, layerMul) {
    var c = this._cfg;
    var uniforms = {
      uTime: { value: 0 },
      uColor: { value: c.color },
      uGlowColor: { value: c.glowColor },
      uOpacity: { value: c.opacity },
      uBaseOpacity: { value: c.baseOpacity },
      uPeakOpacity: { value: c.peakOpacity },
      uNoiseScale: { value: c.noiseScale },
      uScrollSpeed: { value: c.scrollSpeed },
      uInnerRadius: { value: c.innerRadius },
      uOuterRadius: { value: c.outerRadius },
      uEdgeSoftness: { value: c.edgeSoftness },
      uPuffScale: { value: c.puffScale },
      uBillowAmp: { value: c.billowAmplitude },
      uBillowSpeed: { value: c.billowSpeed },
      uFogHeight: { value: c.height },
      uVerticalFalloff: { value: c.verticalFalloffPower },
      uLayerY: { value: layerY },
      uLayerMul: { value: layerMul },
      uDepthMap: this._depthUniforms.uDepthMap,
      uScreenSize: this._depthUniforms.uScreenSize,
      uDepthBias: this._depthUniforms.uDepthBias,
    };
    this._uniformSets.push(uniforms);

    var noise = this._shaderNoiseBlock();

    var vertexShader = [
      'uniform float uTime;',
      'uniform float uBillowAmp;',
      'uniform float uBillowSpeed;',
      'uniform float uLayerMul;',
      'varying vec3 vWorldPos;',
      'varying float vBillow;',
      noise,
      'void main() {',
      '  vec3 pos = position;',
      '  float angle = atan(pos.y, pos.x);',
      '  float dist = length(vec2(pos.x, pos.y));',
      '  vec3 np = vec3(pos.x * 0.14, pos.y * 0.14, uTime * uBillowSpeed);',
      '  float b1 = fbm3(np);',
      '  float b2 = fbm3(np * 2.1 + vec3(4.7, 1.2, uTime * uBillowSpeed * 0.6));',
      '  float billow = (b1 * 0.65 + b2 * 0.35) * 2.0 - 1.0;',
      '  billow += sin(angle * 3.0 + dist * 0.22 - uTime * 1.4) * 0.22;',
      '  billow += sin(angle * 5.0 - dist * 0.11 + uTime * 0.9) * 0.12;',
      '  pos.z += billow * uBillowAmp * uLayerMul;',
      '  vBillow = billow;',
      '  vec4 wp = modelMatrix * vec4(pos, 1.0);',
      '  vWorldPos = wp.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}',
    ].join('\n');

    var fragmentShader = [
      'uniform float uTime;',
      'uniform vec3 uColor;',
      'uniform vec3 uGlowColor;',
      'uniform float uOpacity;',
      'uniform float uBaseOpacity;',
      'uniform float uPeakOpacity;',
      'uniform float uNoiseScale;',
      'uniform float uScrollSpeed;',
      'uniform float uInnerRadius;',
      'uniform float uOuterRadius;',
      'uniform float uEdgeSoftness;',
      'uniform float uPuffScale;',
      'uniform float uFogHeight;',
      'uniform float uVerticalFalloff;',
      'uniform float uLayerY;',
      'uniform float uLayerMul;',
      'uniform sampler2D uDepthMap;',
      'uniform vec2 uScreenSize;',
      'uniform float uDepthBias;',
      'varying vec3 vWorldPos;',
      'varying float vBillow;',
      noise,
      'void main() {',
      '  vec2 depthUv = vec2(gl_FragCoord.x / uScreenSize.x, gl_FragCoord.y / uScreenSize.y);',
      '  float sceneZ = texture2D(uDepthMap, depthUv).r;',
      '  if (sceneZ < 1.0 && sceneZ < gl_FragCoord.z - uDepthBias) discard;',
      '  float t = uTime * uScrollSpeed;',
      '  vec3 scroll = vec3(t * 0.24, t * 0.06, -t * 0.18);',
      '  vec3 puffScroll = vec3(-t * 0.09, t * 0.04, t * 0.07);',
      '  vec3 samplePos = vec3(vWorldPos.x, vWorldPos.y + vBillow * 0.35, vWorldPos.z);',
      '  float nFine = fbm3(samplePos * uNoiseScale + scroll);',
      '  float nPuff = fbm3(samplePos * uPuffScale + puffScroll + vec3(2.4, 0.5, 1.8));',
      '  float pockets = mix(nFine, nPuff, 0.52);',
      '  pockets = smoothstep(0.10, 0.58, pockets);',
      '  float dist = length(vWorldPos.xz);',
      '  if (dist < uInnerRadius) discard;',
      '  float innerEdge = smoothstep(uInnerRadius, uInnerRadius + uEdgeSoftness, dist);',
      '  float outerEdge = 1.0 - smoothstep(uOuterRadius - uEdgeSoftness * 2.5, uOuterRadius, dist);',
      '  float radial = innerEdge * outerEdge;',
      '  float y = max(vWorldPos.y, 0.0);',
      '  float yNorm = clamp(y / max(uFogHeight, 0.001), 0.0, 1.0);',
      '  float verticalDensity = pow(1.0 - yNorm, uVerticalFalloff);',
      '  float topFade = 1.0 - smoothstep(uFogHeight * 0.08, uFogHeight * 0.65, y);',
      '  float bottomFade = smoothstep(-0.05, 0.04, y);',
      '  float layerFade = exp(-pow((y - uLayerY) / max(uFogHeight * 0.28, 0.001), 2.0) * 2.2);',
      '  vec3 col = mix(uColor, uGlowColor, pockets * 0.48);',
      '  float alpha = mix(uBaseOpacity, uPeakOpacity, pockets);',
      '  alpha *= radial * verticalDensity * topFade * bottomFade * layerFade;',
      '  alpha *= uOpacity * uLayerMul * (0.82 + vBillow * 0.18);',
      '  if (alpha < 0.003) discard;',
      '  gl_FragColor = vec4(col, alpha);',
      '}',
    ].join('\n');

    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      fog: false,
    });
  },

  _buildFog: function () {
    var c = this._cfg;
    var i;
    var layer;

    this._group = new THREE.Group();
    this._group.name = 'room-floor-fog-group';

    for (i = 0; i < c.layers.length; i++) {
      layer = c.layers[i];
      var layerMul = layer.opacityMul !== undefined ? layer.opacityMul : 1.0;
      if (layerMul < 0.015) continue;
      var mat = this._createFogMaterial(layer.y, layerMul);
      var geo = new THREE.RingGeometry(
        c.innerRadius,
        c.outerRadius,
        c.thetaSegments,
        c.radialSegments
      );
      var mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'room-floor-fog-layer-' + i;
      mesh.rotation.x = -Math.PI * 0.5;
      mesh.position.y = layer.y;
      mesh.frustumCulled = false;
      mesh.renderOrder = c.renderOrder;
      this._group.add(mesh);
    }

    this.el.object3D.position.set(c.position.x, c.position.y, c.position.z);
    this.el.object3D.add(this._group);
  },
});
