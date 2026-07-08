/* global AFRAME, CONFIG, THREE */

/**
 * assembly-sphere-visual — энергосфера с белыми разрядами (Фаза 2.x).
 * Шейдер как room-fog-dome. preset: assembly | wrist (карманы запястья).
 */
AFRAME.registerComponent('assembly-sphere-visual', {
  schema: {
    radius: { type: 'number', default: 0 },
    preset: { type: 'string', default: 'assembly' },
    shape: { type: 'string', default: 'sphere' },
  },

  init: function () {
    this._mesh = null;
    this._uniforms = null;
    this._cfg = this._readCfg();
    this._colorSchemes = this._buildColorSchemes();
    this._activeScheme = 'empty';
    this._buildMesh();
  },

  remove: function () {
    if (!this._mesh) return;
    this.el.object3D.remove(this._mesh);
    if (this._mesh.geometry) this._mesh.geometry.dispose();
    if (this._mesh.material) this._mesh.material.dispose();
    this._mesh = null;
  },

  tick: function (time) {
    if (this._uniforms) {
      this._uniforms.uTime.value = time * 0.001;
    }
  },

  _readCfg: function () {
    var preset = this.data.preset || 'assembly';
    var az = (typeof CONFIG !== 'undefined' && CONFIG.assemblyZone) || {};
    var v = az.visual || {};
    var R = az.radius !== undefined ? az.radius : 0.30;
    var shape = this.data.shape || 'sphere';
    var height = R * 2;

    if (preset === 'wrist') {
      var wi = (typeof CONFIG !== 'undefined' && CONFIG.wristInventory) || {};
      var wv = wi.pocketVisual || {};
      R = this.data.radius > 0 ? this.data.radius
        : (wi.pocketRadius !== undefined ? wi.pocketRadius : 0.045);
      v = wv;
      shape = this.data.shape || wv.shape || 'cylinder';
      height = wv.height !== undefined ? wv.height
        : (wi.pocketHeight !== undefined ? wi.pocketHeight : 0.055);
    } else if (this.data.radius > 0) {
      R = this.data.radius;
    }

    return {
      radius: R,
      height: height,
      shape: shape,
      color: new THREE.Color(v.color || '#e8eef5'),
      glowColor: new THREE.Color(v.glowColor || '#ffffff'),
      coreColor: new THREE.Color(v.coreColor || '#ffffff'),
      baseOpacity: v.baseOpacity !== undefined ? v.baseOpacity : 0.85,
      voidOpacity: v.voidOpacity !== undefined ? v.voidOpacity : 0.06,
      streakOpacity: v.streakOpacity !== undefined ? v.streakOpacity : 0.88,
      fogContrast: v.fogContrast !== undefined ? v.fogContrast : 2.2,
      fogLift: v.fogLift !== undefined ? v.fogLift : 0.0,
      noiseScale: v.noiseScale !== undefined ? v.noiseScale : 1.1,
      scrollSpeed: v.scrollSpeed !== undefined ? v.scrollSpeed : 0.32,
      fresnelPower: v.fresnelPower !== undefined ? v.fresnelPower : 2.0,
      fresnelStrength: v.fresnelStrength !== undefined ? v.fresnelStrength : 0.55,
      swirlArms: v.swirlArms !== undefined ? v.swirlArms : 4.0,
      streakSharpness: v.streakSharpness !== undefined ? v.streakSharpness : 3.8,
      flowWarp: v.flowWarp !== undefined ? v.flowWarp : 0.55,
      ridgeMix: v.ridgeMix !== undefined ? v.ridgeMix : 0.62,
      windowStrength: v.windowStrength !== undefined ? v.windowStrength : 0.12,
      windowSpeed: v.windowSpeed !== undefined ? v.windowSpeed : 0.22,
      energyTint: v.energyTint !== undefined ? v.energyTint : 0.72,
      fogOverlay: v.fogOverlay !== undefined ? v.fogOverlay : 0.55,
      fogHazeMin: v.fogHazeMin !== undefined ? v.fogHazeMin : 0.15,
      fogHazeMax: v.fogHazeMax !== undefined ? v.fogHazeMax : 0.65,
      fogHazeLift: v.fogHazeLift !== undefined ? v.fogHazeLift : 0.18,
      fogHazeContrast: v.fogHazeContrast !== undefined ? v.fogHazeContrast : 1.45,
      fogHazeSpeed: v.fogHazeSpeed !== undefined ? v.fogHazeSpeed : 0.14,
      fogHazeWindowStrength: v.fogHazeWindowStrength !== undefined ? v.fogHazeWindowStrength : 0.38,
      widthSegments: v.widthSegments !== undefined ? v.widthSegments : 32,
      heightSegments: v.heightSegments !== undefined ? v.heightSegments : 24,
      renderOrder: v.renderOrder !== undefined ? v.renderOrder : 8,
    };
  },

  _buildColorSchemes: function () {
    var c = this._cfg;
    var wi = (typeof CONFIG !== 'undefined' && CONFIG.wristInventory) || {};
    var ov = wi.occupiedVisual || {};
    return {
      empty: {
        color: c.color.clone(),
        glowColor: c.glowColor.clone(),
        coreColor: c.coreColor.clone(),
      },
      occupied: {
        color: new THREE.Color(ov.color || '#18b8d8'),
        glowColor: new THREE.Color(ov.glowColor || '#66f5ff'),
        coreColor: new THREE.Color(ov.coreColor || '#d4feff'),
      },
    };
  },

  /** empty = белые разряды; occupied = голубые + мерцание (wrist-inventory). */
  setColorScheme: function (scheme, force) {
    if (!this._uniforms || !this._colorSchemes) return;
    var key = scheme === 'occupied' ? 'occupied' : 'empty';
    if (!force && this._activeScheme === key) return;
    this._activeScheme = key;
    var pal = this._colorSchemes[key];
    this._uniforms.uColor.value.copy(pal.color);
    this._uniforms.uGlowColor.value.copy(pal.glowColor);
    this._uniforms.uCoreColor.value.copy(pal.coreColor);
  },

  /** Множитель яркости (wrist-inventory: near / inside / occupied pulse). */
  setIntensity: function (mult) {
    if (!this._uniforms || !this._cfg) return;
    var m = mult !== undefined ? mult : 1;
    this._uniforms.uBaseOpacity.value = this._cfg.baseOpacity * m;
    this._uniforms.uStreakOpacity.value = Math.min(this._cfg.streakOpacity * m * 1.08, 1);
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
      'uniform vec3 uColor; uniform vec3 uGlowColor; uniform vec3 uCoreColor;',
      'uniform float uBaseOpacity; uniform float uVoidOpacity; uniform float uStreakOpacity;',
      'uniform float uFogContrast; uniform float uFogLift; uniform float uNoiseScale;',
      'uniform float uScrollSpeed; uniform float uFresnelPower; uniform float uFresnelStrength;',
      'uniform float uSwirlArms; uniform float uStreakSharpness; uniform float uFlowWarp;',
      'uniform float uRidgeMix; uniform float uWindowStrength; uniform float uWindowSpeed;',
      'uniform float uEnergyTint; uniform float uFogOverlay;',
      'uniform float uHazeMin; uniform float uHazeMax; uniform float uHazeLift;',
      'uniform float uHazeContrast; uniform float uHazeSpeed; uniform float uHazeWindowStrength;',
      'varying vec3 vWorldPos; varying vec3 vNormalW;',
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
      'float fbm(vec3 p){ float v=0.0; float a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; } return v;}',
      'float ridged(vec3 p){ float v=0.0; float a=0.55; for(int i=0;i<5;i++){',
      '  float n=vnoise(p); n=1.0-abs(n*2.0-1.0); n=n*n; v+=n*a; p=p*2.18+vec3(1.7,2.3,0.6); a*=0.48; } return v;}',
      'vec3 flowWarp(vec3 p,float t){ vec3 q=p+vec3(t*0.31,t*0.17,-t*0.23);',
      '  return p+(vec3(fbm(q),fbm(q+vec3(5.2,1.3,2.8)),fbm(q+vec3(2.1,4.7,0.9)))-0.5)*uFlowWarp;}',
      'void main(){',
      '  float t=uTime*uScrollSpeed;',
      '  vec3 p=flowWarp(vWorldPos*uNoiseScale,t); p+=vec3(t*0.4,t*0.55,-t*0.35);',
      '  float ridge=pow(clamp(ridged(p)+uFogLift,0.0,1.0),uFogContrast);',
      '  vec3 dir=normalize(vWorldPos+0.0001);',
      '  float theta=atan(dir.z,dir.x); float phi=acos(clamp(dir.y,-1.0,1.0));',
      '  float arm=sin(theta*uSwirlArms+phi*1.65+t*2.8+ridge*6.283);',
      '  arm*=sin(phi*(uSwirlArms+1.5)-t*1.4+ridge*3.0);',
      '  arm=pow(max(0.0,1.0-abs(arm)),uStreakSharpness);',
      '  float streak=smoothstep(0.38,0.94,mix(arm,ridge,uRidgeMix));',
      '  float hot=pow(streak,2.6);',
      '  float windows=smoothstep(0.62,0.92,fbm(vWorldPos*uNoiseScale*4.2+vec3(t*uWindowSpeed)));',
      '  vec3 viewDir=normalize(cameraPosition-vWorldPos);',
      '  float fresnel=pow(1.0-max(dot(normalize(vNormalW),viewDir),0.0),uFresnelPower);',
      '  vec3 streakCol=mix(uColor*0.35,uGlowColor,streak*uEnergyTint);',
      '  streakCol=mix(streakCol,uCoreColor,hot*0.85); streakCol+=uGlowColor*fresnel*uFresnelStrength*0.45;',
      '  float streakAlpha=uBaseOpacity*mix(uVoidOpacity,uStreakOpacity,streak)+fresnel*uFresnelStrength*0.35;',
      '  streakAlpha*=mix(1.0,1.0-uWindowStrength,windows);',
      '  float th=uTime*uHazeSpeed;',
      '  float haze=smoothstep(0.22,0.78,pow(clamp(mix(fbm(vWorldPos*uNoiseScale*1.15+vec3(th)),',
      '    fbm(vWorldPos*uNoiseScale*2.35+vec3(-th*0.78)),0.5)+uHazeLift,0.0,1.0),uHazeContrast));',
      '  vec3 hazeCol=mix(uColor,uGlowColor,haze*uEnergyTint*0.7);',
      '  float hazeAlpha=uBaseOpacity*mix(uHazeMin,uHazeMax,haze)*uFogOverlay;',
      '  vec3 col=mix(streakCol,mix(streakCol,hazeCol,0.78),uFogOverlay*haze);',
      '  float alpha=clamp(streakAlpha+hazeAlpha*(1.0-hot*0.3),uVoidOpacity*0.5,1.0);',
      '  gl_FragColor=vec4(col,alpha);',
      '}',
    ].join('\n');

    var geo;
    if (c.shape === 'cylinder') {
      geo = new THREE.CylinderGeometry(
        c.radius, c.radius, c.height, c.widthSegments, 1, true
      );
    } else {
      geo = new THREE.SphereGeometry(
        c.radius, c.widthSegments, c.heightSegments
      );
    }
    var mat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.name = 'assembly-sphere-visual';
    this._mesh.frustumCulled = false;
    this._mesh.renderOrder = c.renderOrder;
    this.el.object3D.add(this._mesh);
  },
});
