/**
 * hand-magnet-mesh — видимый меш магнита на #*Magnet (Фаза 3.5A.5).
 * GLB без скелета; позиция #*Magnet — из CONFIG.player.hands.*.magnet (hand-magnet-vfx).
 */
AFRAME.registerComponent('hand-magnet-mesh', {
  schema: {
    hand: { default: 'left', oneOf: ['left', 'right'] },
  },

  init: function () {
    var self = this;
    var handsCfg = (typeof CONFIG !== 'undefined' && CONFIG.player && CONFIG.player.hands) || {};
    var handCfg = handsCfg[this.data.hand] || {};
    var meshCfg = handCfg.magnetMesh || {};
    var url = meshCfg.url || 'assets/models/magnet.glb';
    var s = meshCfg.scale !== undefined ? meshCfg.scale : 0.01;
    var p = meshCfg.position || { x: 0, y: 0, z: 0 };
    var r = meshCfg.rotation || { x: 0, y: 0, z: 0 };

    this.loader = new THREE.GLTFLoader();
    this.loader.setCrossOrigin('anonymous');
    this.loader.load(url, function (gltf) {
      var root = gltf.scene;
      root.scale.set(s, s, s);
      root.position.set(p.x, p.y, p.z);
      root.rotation.set(
        THREE.MathUtils.degToRad(r.x),
        THREE.MathUtils.degToRad(r.y),
        THREE.MathUtils.degToRad(r.z)
      );
      self.el.setObject3D('magnet-mesh', root);
    });
  },

  remove: function () {
    this.el.removeObject3D('magnet-mesh');
  },
});
