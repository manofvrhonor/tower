/* global AFRAME, CONFIG, THREE */

/**
 * boot-energy-sphere — энерго-орб для boot-intro.
 *
 * Плоскость = размер комикс-панели (маска). Круг рисуется в UV:
 * R ≤ 1 — полный круг; R > 1 — обрезается верхом/низом панели.
 * Рост размера — через setOrbRadius(), не через scale entity.
 *
 * CONFIG.comic.boot.sphere — цвета/пульс.
 * API: setIntensity(m), setPulseDrive(p), setOrbRadius(r). Не play().
 */
AFRAME.registerComponent('boot-energy-sphere', {
  schema: {
    width: { type: 'number', default: 0 },
    height: { type: 'number', default: 0 },
  },

  init: function () {
    this._mesh = null;
    this._uniforms = null;
    this._cfg = this._readCfg();
    this._buildMesh();
  },

  remove: function () {
    if (!this._mesh) return;
    this.el.object3D.remove(this._mesh);
    if (this._mesh.geometry) this._mesh.geometry.dispose();
    if (this._mesh.material) this._mesh.material.dispose();
    this._mesh = null;
    this._uniforms = null;
  },

  tick: function (time) {
    if (!this._uniforms) return;
    this._uniforms.uTime.value = time * 0.001;
  },

  setIntensity: function (mult) {
    if (!this._uniforms) return;
    this._uniforms.uIntensity.value = mult !== undefined ? mult : 1;
  },

  setPulseDrive: function (pulse) {
    if (!this._uniforms) return;
    this._uniforms.uPulse.value = pulse !== undefined ? pulse : 1;
  },

  /** Радиус круга в UV: 1 = касается верха/низа панели; >1 — обрезка краем. */
  setOrbRadius: function (radius) {
    if (!this._uniforms || !this._uniforms.uCircleRadius) return;
    var r = radius !== undefined ? radius : this._cfg.circleRadius;
    this._uniforms.uCircleRadius.value = Math.max(0.001, r);
  },

  _readCfg: function () {
    var boot = (typeof CONFIG !== 'undefined' && CONFIG.comic && CONFIG.comic.boot) || {};
    var v = boot.sphere || {};
    var w = this.data.width > 0 ? this.data.width
      : (boot.panelWidth !== undefined ? boot.panelWidth : 2.4);
    var h = this.data.height > 0 ? this.data.height
      : (boot.panelHeight !== undefined ? boot.panelHeight : 1.6);
    return {
      width: w,
      height: h,
      // База «вписан в высоту»; финальный размер задаёт boot-intro через setOrbRadius.
      circleRadius: v.circleRadius !== undefined ? v.circleRadius : 0.98,
      color: new THREE.Color(v.color || '#0ec8e8'),
      glowColor: new THREE.Color(v.glowColor || '#9effff'),
      coreColor: new THREE.Color(v.coreColor || '#ffffff'),
      baseOpacity: v.baseOpacity !== undefined ? v.baseOpacity : 0.9,
      voidOpacity: v.voidOpacity !== undefined ? v.voidOpacity : 0.04,
      bandOpacity: v.bandOpacity !== undefined ? v.bandOpacity : 0.95,
      coreGlow: v.coreGlow !== undefined ? v.coreGlow : 1.35,
      noiseScale: v.noiseScale !== undefined ? v.noiseScale : 1.35,
      scrollSpeed: v.scrollSpeed !== undefined ? v.scrollSpeed : 1.25,
      bandArms: v.bandArms !== undefined ? v.bandArms : 5.0,
      bandSharpness: v.bandSharpness !== undefined ? v.bandSharpness : 2.4,
      bandContrast: v.bandContrast !== undefined ? v.bandContrast : 2.4,
      flowWarp: v.flowWarp !== undefined ? v.flowWarp : 0.7,
      fresnelPower: v.fresnelPower !== undefined ? v.fresnelPower : 2.2,
      fresnelStrength: v.fresnelStrength !== undefined ? v.fresnelStrength : 1.25,
      rimSoft: v.rimSoft !== undefined ? v.rimSoft : 0.55,
      edgeFade: v.edgeFade !== undefined ? v.edgeFade : 0.72,
      sparkleStrength: v.sparkleStrength !== undefined ? v.sparkleStrength : 0.45,
      sparkleScale: v.sparkleScale !== undefined ? v.sparkleScale : 18.0,
      energyTint: v.energyTint !== undefined ? v.energyTint : 0.92,
      renderOrder: v.renderOrder !== undefined ? v.renderOrder : 56,
    };
  },

  _buildMesh: function () {
    var c = this._cfg;
    this._uniforms = {
      uTime: { value: 0 },
      uColor: { value: c.color },
      uGlowColor: { value: c.glowColor },
      uCoreColor: { value: c.coreColor },
      uBaseOpacity: { value: c.baseOpacity },
      uVoidOpacity: { value: c.voidOpacity },
      uBandOpacity: { value: c.bandOpacity },
      uCoreGlow: { value: c.coreGlow },
      uNoiseScale: { value: c.noiseScale },
      uScrollSpeed: { value: c.scrollSpeed },
      uBandArms: { value: c.bandArms },
      uBandSharpness: { value: c.bandSharpness },
      uBandContrast: { value: c.bandContrast },
      uFlowWarp: { value: c.flowWarp },
      uFresnelPower: { value: c.fresnelPower },
      uFresnelStrength: { value: c.fresnelStrength },
      uRimSoft: { value: c.rimSoft },
      uEdgeFade: { value: c.edgeFade },
      uSparkleStrength: { value: c.sparkleStrength },
      uSparkleScale: { value: c.sparkleScale },
      uEnergyTint: { value: c.energyTint },
      uIntensity: { value: 1 },
      uPulse: { value: 1 },
      // Старт крошечный — полный круг; рост радиуса делает обрезку только у края панели.
      uCircleRadius: { value: 0.001 },
      uAspect: { value: c.width / Math.max(c.height, 0.001) },
    };

    var vertexShader = [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n');

    var fragmentShader = [
      'uniform float uTime;',
      'uniform vec3 uColor;',
      'uniform vec3 uGlowColor;',
      'uniform vec3 uCoreColor;',
      'uniform float uBaseOpacity;',
      'uniform float uVoidOpacity;',
      'uniform float uBandOpacity;',
      'uniform float uCoreGlow;',
      'uniform float uNoiseScale;',
      'uniform float uScrollSpeed;',
      'uniform float uBandArms;',
      'uniform float uBandSharpness;',
      'uniform float uBandContrast;',
      'uniform float uFlowWarp;',
      'uniform float uFresnelPower;',
      'uniform float uFresnelStrength;',
      'uniform float uRimSoft;',
      'uniform float uEdgeFade;',
      'uniform float uSparkleStrength;',
      'uniform float uSparkleScale;',
      'uniform float uEnergyTint;',
      'uniform float uIntensity;',
      'uniform float uPulse;',
      'uniform float uCircleRadius;',
      'uniform float uAspect;',
      'varying vec2 vUv;',
      'float hash(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z);}',
      'float vnoise(vec3 p){',
      '  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);',
      '  float n000=hash(i); float n100=hash(i+vec3(1,0,0)); float n010=hash(i+vec3(0,1,0));',
      '  float n110=hash(i+vec3(1,1,0)); float n001=hash(i+vec3(0,0,1)); float n101=hash(i+vec3(1,0,1));',
      '  float n011=hash(i+vec3(0,1,1)); float n111=hash(i+vec3(1,1,1));',
      '  float nx00=mix(n000,n100,f.x); float nx10=mix(n010,n110,f.x);',
      '  float nx01=mix(n001,n101,f.x); float nx11=mix(n011,n111,f.x);',
      '  return mix(mix(nx00,nx10,f.y), mix(nx01,nx11,f.y), f.z);',
      '}',
      'float fbm(vec3 p){ float v=0.0; float a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.05; a*=0.5; } return v;}',
      'float ridged(vec3 p){ float v=0.0; float a=0.55; for(int i=0;i<5;i++){',
      '  float n=1.0-abs(vnoise(p)*2.0-1.0); n=n*n; v+=n*a;',
      '  p=p*2.2+vec3(1.7,2.3,0.6); a*=0.48; } return v;}',
      'void main(){',
      '  // R≤1 — полный круг; R>1 — упирается в верх/низ панели и обрезается.',
      '  vec2 p2 = (vUv - 0.5) * 2.0;',
      '  p2.x *= uAspect;',
      '  float r = length(p2);',
      '  float R = max(uCircleRadius, 0.001);',
      '  if (r > R) discard;',
      '  float soft = max(uRimSoft * 0.35, 0.04);',
      '  float circleMask = 1.0 - smoothstep(R - soft, R, r);',
      '  float rn = min(r / R, 1.0);',
      '  float z = sqrt(max(1.0 - rn * rn, 0.0));',
      '  vec3 lp = normalize(vec3(p2 / R, z));',
      '  float drive = max(uIntensity * uPulse, 0.0);',
      '  float t = uTime * uScrollSpeed;',
      '  vec3 p = lp * uNoiseScale;',
      '  vec3 q = p + vec3(t*0.33, t*0.19, -t*0.27);',
      '  // Сильный domain-warp — ломает регулярную сетку.',
      '  vec3 w1 = vec3(fbm(q), fbm(q+vec3(4.1,1.2,2.7)), fbm(q+vec3(2.0,3.8,0.7)));',
      '  p += (w1 - 0.5) * uFlowWarp;',
      '  vec3 w2 = vec3(fbm(p*1.7+vec3(t*0.11)), fbm(p*1.7+vec3(3.3,t*0.09,1.1)), fbm(p*1.7+vec3(0.4,2.2,t*0.13)));',
      '  p += (w2 - 0.5) * (uFlowWarp * 0.55);',
      '  p += vec3(t*0.31, t*0.37, -t*0.29);',
      '  float ridge = pow(clamp(ridged(p), 0.0, 1.0), uBandContrast);',
      '  float ridge2 = pow(clamp(ridged(p*1.35+vec3(2.7,0.4,-1.8)), 0.0, 1.0), mix(1.0, uBandContrast, 0.6));',
      '  float plasma = clamp(mix(ridge, ridge2, 0.45) * 1.15, 0.0, 1.0);',
      '  float theta = atan(lp.z, lp.x);',
      '  float phi = acos(clamp(lp.y, -1.0, 1.0));',
      '  // Слабые «руки» + шум-маска — не доминируют над плазмой.',
      '  float arm = sin(theta*uBandArms + phi*1.3 + t*2.1 + plasma*4.0);',
      '  arm = pow(max(0.0, 1.0 - abs(arm)), uBandSharpness);',
      '  float armMask = smoothstep(0.25, 0.8, fbm(lp*2.4 + vec3(t*0.25)));',
      '  arm *= mix(0.15, 0.55, armMask);',
      '  float band = smoothstep(0.08, 0.92, mix(plasma, plasma*arm, 0.28));',
      '  float hot = pow(band, 1.65);',
      '  float coreN = fbm(lp*uNoiseScale*0.7 + vec3(t*0.18));',
      '  float core = smoothstep(0.12, 0.88, coreN) * uCoreGlow;',
      '  float facing = max(lp.z, 0.0);',
      '  float fresnel = pow(1.0 - facing, uFresnelPower);',
      '  float softRim = smoothstep(0.0, max(uRimSoft, 0.05), fresnel);',
      '  float softEdge = mix(1.0 - uEdgeFade, 1.0, smoothstep(0.0, max(uRimSoft, 0.05), facing));',
      '  float spark = pow(vnoise(lp*uSparkleScale + vec3(t*3.2)), 16.0) * uSparkleStrength;',
      '  vec3 col = mix(uColor*0.22, uGlowColor, band*uEnergyTint);',
      '  col = mix(col, uCoreColor, hot*0.7);',
      '  col = mix(col, uCoreColor, core*0.45);',
      '  col += uGlowColor * softRim * uFresnelStrength;',
      '  col += uCoreColor * softRim * uFresnelStrength * 0.35;',
      '  col += uCoreColor * spark * drive;',
      '  col *= (0.75 + 0.45 * drive);',
      '  float alpha = uBaseOpacity * mix(uVoidOpacity, uBandOpacity, band);',
      '  alpha += softRim * uFresnelStrength * 0.55;',
      '  alpha += core * 0.2;',
      '  alpha += spark * 0.22;',
      '  alpha *= softEdge * circleMask;',
      '  alpha = clamp(alpha * (0.65 + 0.55 * drive), 0.0, 1.0);',
      '  gl_FragColor = vec4(col, alpha);',
      '}',
    ].join('\n');

    var geo = new THREE.PlaneGeometry(c.width, c.height);
    var mat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.name = 'boot-energy-sphere';
    this._mesh.frustumCulled = false;
    this._mesh.renderOrder = c.renderOrder;
    this.el.object3D.add(this._mesh);
  },
});
