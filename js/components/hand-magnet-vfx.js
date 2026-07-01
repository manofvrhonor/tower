/**
 * hand-magnet-vfx — искры на #*HandCollider (Фаза 3.5A).
 * #*Magnet — position на кулаке + object3D VFX (синхрон с colliderLocal).
 * VFX не на a-sphere: visible="false" на collider скрывает всех детей object3D.
 */
AFRAME.registerComponent('hand-magnet-vfx', {
  schema: {
    hand: { default: 'left', oneOf: ['left', 'right'] },
  },

  init: function () {
    this._active = false;
    this._time = 0;
    this._clusters = [];
    this._root = new THREE.Group();

    var handsCfg = CONFIG.player.hands || {};
    this._handCfg = handsCfg[this.data.hand] || {};
    this.cfg = handsCfg.magnetVfx || {};
    this._colliderEl = this.el.querySelector('[id$="HandCollider"]');

    this._applyMagnetTransform();
    this._applyColliderAnchor();
    this._buildVfx();
    this._syncVfxToCollider();

    this.el.setObject3D('magnet-vfx', this._root);
    this._setVisible(false);

    this._onCharge = this._onCharge.bind(this);
    this._onDischarge = this._onDischarge.bind(this);
  },

  play: function () {
    var handEl = this.el.parentElement;
    if (!handEl) { return; }
    handEl.addEventListener('magnetcharge', this._onCharge);
    handEl.addEventListener('magnetdischarge', this._onDischarge);
  },

  pause: function () {
    var handEl = this.el.parentElement;
    if (!handEl) { return; }
    handEl.removeEventListener('magnetcharge', this._onCharge);
    handEl.removeEventListener('magnetdischarge', this._onDischarge);
  },

  tick: function (time, delta) {
    if (!this._active) { return; }

    var speed = this.cfg.pulseSpeed !== undefined ? this.cfg.pulseSpeed : 10;
    this._time += (delta / 1000) * speed;
    var orbitR = this.cfg.orbitRadius !== undefined ? this.cfg.orbitRadius : 0.014;
    var c;
    var ci;
    var spark;
    var angle;
    var flicker;

    for (c = 0; c < this._clusters.length; c++) {
      for (ci = 0; ci < this._clusters[c].sparks.length; ci++) {
        spark = this._clusters[c].sparks[ci];
        angle = this._time * (1.1 + ci * 0.17) + spark.phase;
        spark.mesh.position.set(
          Math.cos(angle) * orbitR,
          Math.sin(angle * 1.7) * orbitR * 0.45,
          Math.sin(angle) * orbitR
        );
        flicker = 0.65 + 0.35 * Math.sin(this._time * 3.5 + spark.phase * 2);
        spark.mesh.scale.setScalar(flicker);
      }
      if (this._clusters[c].core) {
        flicker = 0.85 + 0.15 * Math.sin(this._time * 5 + c);
        this._clusters[c].core.scale.setScalar(flicker);
      }
    }
  },

  /** #*Magnet на кулаке — только position (local #*Hand). */
  _applyMagnetTransform: function () {
    var m = (this._handCfg.magnet && this._handCfg.magnet.position) || { x: 0, y: -0.08, z: -0.01 };
    this.el.setAttribute('position', m.x + ' ' + m.y + ' ' + m.z);
  },

  /** #*HandCollider — единый якорь: position/rotation из CONFIG.player.hands.grab.colliderLocal. */
  _applyColliderAnchor: function () {
    var collider = this._colliderEl;
    if (!collider) { return; }
    var handsCfg = (typeof CONFIG !== 'undefined' && CONFIG.player && CONFIG.player.hands) || {};
    var grab = handsCfg.grab || {};
    var local = grab.colliderLocal || {};
    var p = local.position || { x: 0, y: 0, z: 0 };
    var r = local.rotation || { x: 0, y: 0, z: 0 };
    collider.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
    collider.setAttribute('rotation', r.x + ' ' + r.y + ' ' + r.z);
  },

  /** VFX на #*Magnet, transform = collider (a-sphere visible=false скрывает детей). */
  _syncVfxToCollider: function () {
    var collider = this._colliderEl;
    if (!collider) { return; }
    var p = collider.getAttribute('position') || { x: 0, y: 0, z: 0 };
    var r = collider.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
    this._root.position.set(p.x, p.y, p.z);
    this._root.rotation.set(
      THREE.MathUtils.degToRad(r.x),
      THREE.MathUtils.degToRad(r.y),
      THREE.MathUtils.degToRad(r.z)
    );
  },

  _buildVfx: function () {
    var redCfg = this.cfg.redAbove || {};
    var sep = this.cfg.sparkSeparation !== undefined ? this.cfg.sparkSeparation : 0.04;
    var half = sep * 0.5;
    this._addCluster(-half, this.cfg.color || '#55eeff', this.cfg.coreColor || '#e8ffff');
    this._addCluster(half, redCfg.color || '#ff3333', redCfg.coreColor || '#ff6644');
  },

  _addCluster: function (offsetZ, color, coreColor) {
    var count = this.cfg.sparkCount !== undefined ? this.cfg.sparkCount : 5;
    var sparkR = this.cfg.sparkRadius !== undefined ? this.cfg.sparkRadius : 0.004;
    var group = new THREE.Group();
    group.position.z = offsetZ;
    this._root.add(group);

    var sparkGeo = new THREE.SphereGeometry(sparkR, 5, 5);
    var sparkMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    var coreGeo = new THREE.SphereGeometry(sparkR * 1.4, 8, 8);
    var coreMat = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    var cluster = { sparks: [], core: null };
    var i;
    var mesh;

    cluster.core = new THREE.Mesh(coreGeo, coreMat);
    group.add(cluster.core);

    for (i = 0; i < count; i++) {
      mesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
      group.add(mesh);
      cluster.sparks.push({ mesh: mesh, phase: (Math.PI * 2 * i) / count });
    }

    this._clusters.push(cluster);
  },

  _onCharge: function () {
    this._active = true;
    this._time = 0;
    this._setVisible(true);
  },

  _onDischarge: function () {
    this._active = false;
    this._setVisible(false);
  },

  _setVisible: function (visible) {
    this._root.visible = visible;
  },

  remove: function () {
    this.el.removeObject3D('magnet-vfx');
  },
});
