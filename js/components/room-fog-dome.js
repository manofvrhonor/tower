/* global AFRAME, CONFIG, THREE */

/**
 * room-fog-dome — cyan «поле времени» комнаты (верхняя полусфера, Фаза 2.1).
 *
 * Ленты (ridged + sin) + мягкий fbm-дым поверх (fogOverlay). CONFIG.room.fogDome.
 * Визуальный пол — диск floorRadius (по умолчанию = radius купола; 80 м — «бесконечная» площадка).
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
    // voidOpacity/streakOpacity — новые имена; fogMin/fogMax — обратная совместимость.
    var voidOp = fd.voidOpacity !== undefined ? fd.voidOpacity
      : (fd.fogMin !== undefined ? fd.fogMin : 0.04);
    var streakOp = fd.streakOpacity !== undefined ? fd.streakOpacity
      : (fd.fogMax !== undefined ? fd.fogMax : 0.92);
    return {
      radius: fd.radius !== undefined ? fd.radius : room.height || 3,
      floorColor: fd.floorColor || room.floorColor || '#8a8580',
      position: {
        x: pos.x !== undefined ? pos.x : 0,
        y: pos.y !== undefined ? pos.y : 0,
        z: pos.z !== undefined ? pos.z : 0,
      },
      color: new THREE.Color(fd.color || '#18b8d8'),
      glowColor: new THREE.Color(fd.glowColor || '#66f5ff'),
      coreColor: new THREE.Color(fd.coreColor || '#d4feff'),
      baseOpacity: fd.baseOpacity !== undefined ? fd.baseOpacity : 1.0,
      voidOpacity: voidOp,
      streakOpacity: streakOp,
      fogContrast: fd.fogContrast !== undefined ? fd.fogContrast : 2.4,
      fogLift: fd.fogLift !== undefined ? fd.fogLift : 0.0,
      noiseScale: fd.noiseScale !== undefined ? fd.noiseScale : 1.1,
      scrollSpeed: fd.scrollSpeed !== undefined ? fd.scrollSpeed : 0.28,
      fresnelPower: fd.fresnelPower !== undefined ? fd.fresnelPower : 2.0,
      fresnelStrength: fd.fresnelStrength !== undefined ? fd.fresnelStrength : 0.48,
      swirlArms: fd.swirlArms !== undefined ? fd.swirlArms : 4.0,
      streakSharpness: fd.streakSharpness !== undefined ? fd.streakSharpness : 3.8,
      flowWarp: fd.flowWarp !== undefined ? fd.flowWarp : 0.55,
      ridgeMix: fd.ridgeMix !== undefined ? fd.ridgeMix : 0.62,
      windowStrength: fd.windowStrength !== undefined ? fd.windowStrength : 0.12,
      windowSpeed: fd.windowSpeed !== undefined ? fd.windowSpeed : 0.22,
      energyTint: fd.energyTint !== undefined ? fd.energyTint : 0.72,
      fogOverlay: fd.fogOverlay !== undefined ? fd.fogOverlay : 0.48,
      fogHazeMin: fd.fogHazeMin !== undefined ? fd.fogHazeMin : 0.20,
      fogHazeMax: fd.fogHazeMax !== undefined ? fd.fogHazeMax : 0.55,
      fogHazeLift: fd.fogHazeLift !== undefined ? fd.fogHazeLift : 0.18,
      fogHazeContrast: fd.fogHazeContrast !== undefined ? fd.fogHazeContrast : 1.45,
      fogHazeSpeed: fd.fogHazeSpeed !== undefined ? fd.fogHazeSpeed : 0.14,
      fogHazeWindowStrength: fd.fogHazeWindowStrength !== undefined
        ? fd.fogHazeWindowStrength : 0.38,
      widthSegments: fd.widthSegments !== undefined ? fd.widthSegments : 64,
      heightSegments: fd.heightSegments !== undefined ? fd.heightSegments : 32,
      renderOrder: fd.renderOrder !== undefined ? fd.renderOrder : 5,
      floorRadius: fd.floorRadius !== undefined ? fd.floorRadius : null,
      floorRenderOrder: fd.floorRenderOrder !== undefined ? fd.floorRenderOrder : -2,
    };
  },

  _buildDome: function () {
    var c = this._cfg;

    this._uniforms = {
      uTime: { value: 0 },
      uColor: { value: c.color },
      uGlowColor: { value: c.glowColor },
      uCoreColor: { value: c.coreColor },
      uBaseOpacity: { value: c.baseOpacity },
      uVoidOpacity: { value: c.voidOpacity },
      uStreakOpacity: { value: c.streakOpacity },
      uFogContrast: { value: c.fogContrast },
      uFogLift: { value: c.fogLift },
      uNoiseScale: { value: c.noiseScale },
      uScrollSpeed: { value: c.scrollSpeed },
      uFresnelPower: { value: c.fresnelPower },
      uFresnelStrength: { value: c.fresnelStrength },
      uSwirlArms: { value: c.swirlArms },
      uStreakSharpness: { value: c.streakSharpness },
      uFlowWarp: { value: c.flowWarp },
      uRidgeMix: { value: c.ridgeMix },
      uWindowStrength: { value: c.windowStrength },
      uWindowSpeed: { value: c.windowSpeed },
      uEnergyTint: { value: c.energyTint },
      uFogOverlay: { value: c.fogOverlay },
      uHazeMin: { value: c.fogHazeMin },
      uHazeMax: { value: c.fogHazeMax },
      uHazeLift: { value: c.fogHazeLift },
      uHazeContrast: { value: c.fogHazeContrast },
      uHazeSpeed: { value: c.fogHazeSpeed },
      uHazeWindowStrength: { value: c.fogHazeWindowStrength },
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
      'uniform vec3 uGlowColor;',
      'uniform vec3 uCoreColor;',
      'uniform float uBaseOpacity;',
      'uniform float uVoidOpacity;',
      'uniform float uStreakOpacity;',
      'uniform float uFogContrast;',
      'uniform float uFogLift;',
      'uniform float uNoiseScale;',
      'uniform float uScrollSpeed;',
      'uniform float uFresnelPower;',
      'uniform float uFresnelStrength;',
      'uniform float uSwirlArms;',
      'uniform float uStreakSharpness;',
      'uniform float uFlowWarp;',
      'uniform float uRidgeMix;',
      'uniform float uWindowStrength;',
      'uniform float uWindowSpeed;',
      'uniform float uEnergyTint;',
      'uniform float uFogOverlay;',
      'uniform float uHazeMin;',
      'uniform float uHazeMax;',
      'uniform float uHazeLift;',
      'uniform float uHazeContrast;',
      'uniform float uHazeSpeed;',
      'uniform float uHazeWindowStrength;',
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
      'float ridged(vec3 p) {',
      '  float v = 0.0;',
      '  float a = 0.55;',
      '  for (int i = 0; i < 5; i++) {',
      '    float n = vnoise(p);',
      '    n = 1.0 - abs(n * 2.0 - 1.0);',
      '    n = n * n;',
      '    v += n * a;',
      '    p = p * 2.18 + vec3(1.7, 2.3, 0.6);',
      '    a *= 0.48;',
      '  }',
      '  return v;',
      '}',
      'vec3 flowWarp(vec3 p, float t) {',
      '  vec3 q = p + vec3(t * 0.31, t * 0.17, -t * 0.23);',
      '  float wx = fbm(q);',
      '  float wy = fbm(q + vec3(5.2, 1.3, 2.8));',
      '  float wz = fbm(q + vec3(2.1, 4.7, 0.9));',
      '  return p + (vec3(wx, wy, wz) - 0.5) * uFlowWarp;',
      '}',
      'void main() {',
      '  float t = uTime * uScrollSpeed;',
      '  vec3 p = flowWarp(vWorldPos * uNoiseScale, t);',
      '  p += vec3(t * 0.4, t * 0.55, -t * 0.35);',
      '  float ridge = ridged(p);',
      '  ridge = pow(clamp(ridge + uFogLift, 0.0, 1.0), uFogContrast);',
      '  vec3 dir = normalize(vWorldPos + vec3(0.0001));',
      '  float theta = atan(dir.z, dir.x);',
      '  float phi = acos(clamp(dir.y, -1.0, 1.0));',
      '  float armPhase = theta * uSwirlArms + phi * 1.65 + t * 2.8 + ridge * 6.283;',
      '  float arm = sin(armPhase);',
      '  arm *= sin(phi * (uSwirlArms + 1.5) - t * 1.4 + ridge * 3.0);',
      '  arm = pow(max(0.0, 1.0 - abs(arm)), uStreakSharpness);',
      '  float streak = mix(arm, ridge, uRidgeMix);',
      '  streak = smoothstep(0.38, 0.94, streak);',
      '  float hot = pow(streak, 2.6);',
      '  float nWin = fbm(vWorldPos * uNoiseScale * 4.2 + vec3(t * uWindowSpeed));',
      '  float windows = smoothstep(0.62, 0.92, nWin);',
      '  vec3 viewDir = normalize(cameraPosition - vWorldPos);',
      '  float ndv = max(dot(normalize(vNormalW), viewDir), 0.0);',
      '  float fresnel = pow(1.0 - ndv, uFresnelPower);',
      '  vec3 streakCol = mix(uColor * 0.35, uGlowColor, streak * uEnergyTint);',
      '  streakCol = mix(streakCol, uCoreColor, hot * 0.85);',
      '  streakCol += uGlowColor * fresnel * uFresnelStrength * 0.45;',
      '  float streakAlpha = uBaseOpacity * mix(uVoidOpacity, uStreakOpacity, streak);',
      '  streakAlpha += fresnel * uFresnelStrength * 0.35;',
      '  streakAlpha *= mix(1.0, 1.0 - uWindowStrength, windows);',
      '  float th = uTime * uHazeSpeed;',
      '  vec3 scroll1 = vec3(th, th * 0.62, -th * 0.48);',
      '  vec3 scroll2 = vec3(-th * 0.78, th * 0.28, th * 0.55);',
      '  float n1 = fbm(vWorldPos * uNoiseScale * 1.15 + scroll1);',
      '  float n2 = fbm(vWorldPos * uNoiseScale * 2.35 + scroll2 + vec3(4.2, 1.1, 2.8));',
      '  float haze = mix(n1, n2, 0.5);',
      '  haze = clamp(haze + uHazeLift, 0.0, 1.0);',
      '  haze = smoothstep(0.22, 0.78, pow(haze, uHazeContrast));',
      '  vec3 scrollWin = vec3(th * uWindowSpeed * 0.4, th * uWindowSpeed, -th * uWindowSpeed * 0.55);',
      '  float nWinHaze = fbm(vWorldPos * uNoiseScale * 3.8 + scrollWin + vec3(1.7, 3.3, 0.9));',
      '  float hazeWindows = smoothstep(0.58, 0.88, nWinHaze);',
      '  vec3 hazeCol = mix(uColor, uGlowColor, haze * uEnergyTint * 0.7);',
      '  float hazeAlpha = uBaseOpacity * mix(uHazeMin, uHazeMax, haze);',
      '  hazeAlpha *= mix(1.0, 1.0 - uHazeWindowStrength, hazeWindows);',
      '  float overlay = uFogOverlay * haze;',
      '  vec3 col = mix(streakCol, mix(streakCol, hazeCol, 0.78), overlay);',
      '  col += hazeCol * overlay * 0.22;',
      '  float alpha = streakAlpha + hazeAlpha * uFogOverlay * (1.0 - hot * 0.3);',
      '  alpha = clamp(alpha, uVoidOpacity * 0.5, min(uStreakOpacity + uHazeMax * uFogOverlay + uFresnelStrength, 1.0));',
      '  gl_FragColor = vec4(col, alpha);',
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

  /** Круглый пол на y=0; floorRadius >> radius купола — площадка под домами снаружи. */
  _buildFloor: function () {
    var c = this._cfg;
    var floorR = c.floorRadius !== null && c.floorRadius !== undefined
      ? c.floorRadius
      : c.radius;
    var thickness = 0.02;
    var geo = new THREE.CylinderGeometry(floorR, floorR, thickness, 64);
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
    this._floorMesh.renderOrder = c.floorRenderOrder;
    this.el.object3D.add(this._floorMesh);
  },
});
