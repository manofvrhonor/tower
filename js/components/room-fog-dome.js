/* global AFRAME, CONFIG, THREE */

/**
 * room-fog-dome — туманный купол комнаты (верхняя полусфера).
 *
 * Визуал комнаты; PhysX — room-dome-collider (полусфера).
 * Процедурный шум в shader — движущиеся зоны прозрачности/плотности.
 */
AFRAME.registerComponent('room-fog-dome', {
  schema: {},

  init: function () {
    this._mesh = null;
    this._floorMesh = null;
    this._uniforms = null;
    this._cfg = this._readCfg();
    this._buildDome();
    this._buildFloor();
  },

  remove: function () {
    this._disposeMesh(this._mesh);
    this._disposeMesh(this._floorMesh);
    this._mesh = null;
    this._floorMesh = null;
  },

  _disposeMesh: function (mesh) {
    if (!mesh) return;
    this.el.object3D.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
  },

  tick: function (time) {
    if (this._uniforms) {
      this._uniforms.uTime.value = time * 0.001;
    }
  },

  _readCfg: function () {
    var room = (typeof CONFIG !== 'undefined' && CONFIG.room) || {};
    var fd = room.fogDome || {};
    var pos = fd.position || {};
    return {
      radius: fd.radius !== undefined ? fd.radius : room.height || 3,
      floorColor: room.floorColor || '#8a8580',
      position: {
        x: pos.x !== undefined ? pos.x : 0,
        y: pos.y !== undefined ? pos.y : 0,
        z: pos.z !== undefined ? pos.z : 0,
      },
      color: new THREE.Color(fd.color || '#e8e4dc'),
      baseOpacity: fd.baseOpacity !== undefined ? fd.baseOpacity : 1.0,
      fogMin: fd.fogMin !== undefined ? fd.fogMin : 0.34,
      fogMax: fd.fogMax !== undefined ? fd.fogMax : 0.94,
      fogContrast: fd.fogContrast !== undefined ? fd.fogContrast : 1.45,
      fogLift: fd.fogLift !== undefined ? fd.fogLift : 0.18,
      noiseScale: fd.noiseScale !== undefined ? fd.noiseScale : 1.2,
      scrollSpeed: fd.scrollSpeed !== undefined ? fd.scrollSpeed : 0.14,
      fresnelPower: fd.fresnelPower !== undefined ? fd.fresnelPower : 3.0,
      fresnelStrength: fd.fresnelStrength !== undefined ? fd.fresnelStrength : 0.06,
      widthSegments: fd.widthSegments !== undefined ? fd.widthSegments : 64,
      heightSegments: fd.heightSegments !== undefined ? fd.heightSegments : 32,
      renderOrder: fd.renderOrder !== undefined ? fd.renderOrder : 5,
    };
  },

  _buildDome: function () {
    var c = this._cfg;

    this._uniforms = {
      uTime: { value: 0 },
      uColor: { value: c.color },
      uBaseOpacity: { value: c.baseOpacity },
      uFogMin: { value: c.fogMin },
      uFogMax: { value: c.fogMax },
      uFogContrast: { value: c.fogContrast },
      uFogLift: { value: c.fogLift },
      uNoiseScale: { value: c.noiseScale },
      uScrollSpeed: { value: c.scrollSpeed },
      uFresnelPower: { value: c.fresnelPower },
      uFresnelStrength: { value: c.fresnelStrength },
    };

    var vertexShader = [
      'varying vec3 vWorldPos;',
      'varying vec3 vNormalW;',
      'void main() {',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vWorldPos = wp.xyz;',
      '  vNormalW = normalize(mat3(modelMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}',
    ].join('\n');

    var fragmentShader = [
      'uniform float uTime;',
      'uniform vec3 uColor;',
      'uniform float uBaseOpacity;',
      'uniform float uFogMin;',
      'uniform float uFogMax;',
      'uniform float uFogContrast;',
      'uniform float uFogLift;',
      'uniform float uNoiseScale;',
      'uniform float uScrollSpeed;',
      'uniform float uFresnelPower;',
      'uniform float uFresnelStrength;',
      'varying vec3 vWorldPos;',
      'varying vec3 vNormalW;',
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
      'float fbm(vec3 p) {',
      '  float v = 0.0;',
      '  float a = 0.5;',
      '  for (int i = 0; i < 4; i++) {',
      '    v += a * vnoise(p);',
      '    p *= 2.03;',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      'void main() {',
      '  vec3 scroll1 = vec3(uTime * uScrollSpeed, uTime * uScrollSpeed * 0.62, -uTime * uScrollSpeed * 0.48);',
      '  vec3 scroll2 = vec3(-uTime * uScrollSpeed * 0.78, uTime * uScrollSpeed * 0.28, uTime * uScrollSpeed * 0.55);',
      '  float n1 = fbm(vWorldPos * uNoiseScale + scroll1);',
      '  float n2 = fbm(vWorldPos * uNoiseScale * 2.1 + scroll2 + vec3(4.2, 1.1, 2.8));',
      '  float fog = mix(n1, n2, 0.5);',
      '  fog = clamp(fog + uFogLift, 0.0, 1.0);',
      '  fog = smoothstep(0.22, 0.78, pow(fog, uFogContrast));',
      '  vec3 viewDir = normalize(cameraPosition - vWorldPos);',
      '  float fresnel = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), uFresnelPower);',
      '  float alpha = uBaseOpacity * mix(uFogMin, uFogMax, fog) + fresnel * uFresnelStrength;',
      '  alpha = clamp(alpha, uFogMin, min(uFogMax + uFresnelStrength, 1.0));',
      '  gl_FragColor = vec4(uColor, alpha);',
      '}',
    ].join('\n');

    var geo = new THREE.SphereGeometry(
      c.radius,
      c.widthSegments,
      c.heightSegments,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.5
    );

    var mat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      fog: false,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.name = 'room-fog-dome-mesh';
    this._mesh.frustumCulled = false;
    this._mesh.renderOrder = c.renderOrder;

    this.el.object3D.position.set(c.position.x, c.position.y, c.position.z);
    this.el.object3D.add(this._mesh);
  },

  /** Непрозрачный круглый пол по диаметру купола (y=0). */
  _buildFloor: function () {
    var c = this._cfg;
    var thickness = 0.02;
    var geo = new THREE.CylinderGeometry(c.radius, c.radius, thickness, 64);
    var mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c.floorColor),
      roughness: 0.88,
      metalness: 0.05,
      transparent: false,
      opacity: 1,
    });

    this._floorMesh = new THREE.Mesh(geo, mat);
    this._floorMesh.name = 'room-fog-dome-floor';
    this._floorMesh.position.y = thickness * 0.5;
    this._floorMesh.receiveShadow = true;
    this._floorMesh.renderOrder = 0;
    this.el.object3D.add(this._floorMesh);
  },
});
