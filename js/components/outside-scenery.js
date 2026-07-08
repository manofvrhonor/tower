/* global AFRAME, CONFIG, THREE */

/**
 * outside-scenery — застройка за cyan-куполом (Фаза 3.1).
 *
 * Расстановка (вид сверху): primary — 4 дома на (±d,±d); background — 4 на осях.
 * Фаза 4: высота × sceneryHeightMult; стены — locations[].scenery.*Walls (config.js).
 */
AFRAME.registerComponent('outside-scenery', {
  schema: {},

  init: function () {
    this._root = new THREE.Group();
    this._root.name = 'outside-scenery-root';
    this.el.object3D.add(this._root);
    this._buildings = [];
    this._texCache = {};
    this._loader = new THREE.TextureLoader();
    this._onLocationChanged = this._onLocationChanged.bind(this);
    this.el.sceneEl.addEventListener('location-changed', this._onLocationChanged);
    var self = this;
    var loc = this._getVisualLocation();
    if (!(typeof CONFIG !== 'undefined' && CONFIG.room &&
        CONFIG.room.outsideScenery &&
        (CONFIG.room.outsideScenery.primaryPrototypes || []).length)) {
      console.error('[outside-scenery] primaryPrototypes[] пуст');
      return;
    }
    this._buildForLocation(loc);
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('location-changed', this._onLocationChanged);
    this._disposeAll();
    if (this._root.parent) {
      this._root.parent.remove(this._root);
    }
  },

  _resolvePath: function (dir, file) {
    if (!file) return null;
    if (file.indexOf('/') >= 0 || file.indexOf('\\') >= 0) return file;
    var base = dir || 'assets/textures/outside-buildings/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + file;
  },

  _parsePrototypes: function (rawList, defaultColor) {
    var out = [];
    for (var p = 0; p < rawList.length; p++) {
      var rp = rawList[p] || {};
      out.push({
        id: rp.id || ('building-' + p),
        width: rp.width !== undefined ? rp.width : 1.5,
        depth: rp.depth !== undefined ? rp.depth : 1.5,
        height: rp.height !== undefined ? rp.height : 6,
        color: rp.color || defaultColor,
        wall: rp.wall || null,
        textureOnly: rp.textureOnly === true,
        axisDistanceOffset: rp.axisDistanceOffset !== undefined ? rp.axisDistanceOffset : 0,
        positionOffset: {
          x: (rp.positionOffset && rp.positionOffset.x !== undefined) ? rp.positionOffset.x : 0,
          z: (rp.positionOffset && rp.positionOffset.z !== undefined) ? rp.positionOffset.z : 0,
        },
        metersPerRepeat: rp.metersPerRepeat,
      });
    }
    return out;
  },

  _maxHalfExtents: function (prototypes) {
    var maxW = 0;
    var maxD = 0;
    for (var i = 0; i < prototypes.length; i++) {
      if (prototypes[i].width > maxW) maxW = prototypes[i].width;
      if (prototypes[i].depth > maxD) maxD = prototypes[i].depth;
    }
    return { halfW: maxW * 0.5, halfD: maxD * 0.5 };
  },

  /** Мин. d для primary на (±d,±d): внутренний угол бокса не в куполе. */
  _minPrimaryAxisDistance: function (fogR, prototypes, clearance) {
    var ext = this._maxHalfExtents(prototypes);
    var need = fogR + clearance;
    var lo = need;
    var hi = need + 200;
    for (var k = 0; k < 32; k++) {
      var d = (lo + hi) * 0.5;
      var dx = d - ext.halfW;
      var dz = d - ext.halfD;
      if (dx <= 0 || dz <= 0) {
        lo = d;
        continue;
      }
      if (Math.sqrt(dx * dx + dz * dz) >= need) {
        hi = d;
      } else {
        lo = d;
      }
    }
    return hi;
  },

  /** Мин. R для background на осях: не пересекает primary на диагоналях. */
  _minBackgroundAxisDistance: function (primaryD, primaryProtos, bgProtos, gap) {
    var p = this._maxHalfExtents(primaryProtos);
    var b = this._maxHalfExtents(bgProtos);
    return primaryD + p.halfW + b.halfW + gap;
  },

  _getVisualLocation: function () {
    if (typeof getActiveLocation === 'function') {
      var active = getActiveLocation();
      if (active) return active;
    }
    var locs = (typeof CONFIG !== 'undefined' && CONFIG.locations) || [];
    var i;
    for (i = 0; i < locs.length; i++) {
      if (locs[i].start) return locs[i];
    }
    return locs.length ? locs[0] : null;
  },

  _heightMultFromLocation: function (loc) {
    if (loc && loc.sceneryHeightMult != null) return loc.sceneryHeightMult;
    return 1;
  },

  _scalePrototypeHeights: function (cfg, mult) {
    var lists = [cfg.primaryPrototypes, cfg.backgroundPrototypes];
    var l;
    var i;
    for (l = 0; l < lists.length; l++) {
      for (i = 0; i < lists[l].length; i++) {
        lists[l][i].height *= mult;
      }
    }
  },

  _assignLocationWalls: function (prototypes, wallFiles) {
    if (!wallFiles || !wallFiles.length) return;
    var i;
    for (i = 0; i < prototypes.length && i < wallFiles.length; i++) {
      prototypes[i].wall = wallFiles[i];
    }
  },

  _buildForLocation: function (loc) {
    var self = this;
    loc = loc || this._getVisualLocation();
    var mult = this._heightMultFromLocation(loc);
    var cfg = this._readCfg(loc);
    this._scalePrototypeHeights(cfg, mult);
    this._disposeAll();
    this._texCache = {};
    this._preloadTextures(cfg, function () {
      self._build(cfg);
    });
  },

  _onLocationChanged: function (evt) {
    var loc = (evt && evt.detail && evt.detail.location) || this._getVisualLocation();
    this._buildForLocation(loc);
  },

  _readCfg: function (loc) {
    var room = (typeof CONFIG !== 'undefined' && CONFIG.room) || {};
    var os = room.outsideScenery || {};
    var fd = room.fogDome || {};
    var fdPos = fd.position || {};
    var osPos = os.position || {};
    var fogR = fd.radius !== undefined ? fd.radius : 2.0;
    var tex = os.textures || {};
    var edges = os.edges || {};
    var clearance = os.clearance !== undefined ? os.clearance : 0.8;
    var buildingGap = os.buildingGap !== undefined ? os.buildingGap : 0.9;

    var primaryRing = os.primaryRing || {};
    var backgroundRing = os.backgroundRing || {};

    var primaryPrototypes = this._parsePrototypes(
      os.primaryPrototypes || os.prototypes || [],
      '#ffffff'
    );
    var backgroundPrototypes = this._parsePrototypes(
      os.backgroundPrototypes || [],
      '#9aa5b5'
    );

    var scenery = loc && loc.scenery;
    if (scenery) {
      this._assignLocationWalls(primaryPrototypes, scenery.primaryWalls);
      this._assignLocationWalls(backgroundPrototypes, scenery.backgroundWalls);
    }

    var primaryAuto = this._minPrimaryAxisDistance(fogR, primaryPrototypes, clearance);
    var primaryAxis = primaryRing.axisDistance !== undefined
      ? Math.max(primaryRing.axisDistance, primaryAuto)
      : primaryAuto;

    var bgAuto = backgroundPrototypes.length
      ? this._minBackgroundAxisDistance(
        primaryAxis, primaryPrototypes, backgroundPrototypes, buildingGap
      )
      : primaryAxis + 10;
    var bgAxis = backgroundRing.axisDistance !== undefined
      ? Math.max(backgroundRing.axisDistance, bgAuto)
      : bgAuto;

    return {
      center: {
        x: osPos.x !== undefined ? osPos.x : (fdPos.x !== undefined ? fdPos.x : 0),
        y: osPos.y !== undefined ? osPos.y : (fdPos.y !== undefined ? fdPos.y : 0),
        z: osPos.z !== undefined ? osPos.z : (fdPos.z !== undefined ? fdPos.z : 0),
      },
      primaryRing: {
        axisDistance: primaryAxis,
        rotationY: primaryRing.rotationY !== undefined ? primaryRing.rotationY : 0,
      },
      backgroundRing: {
        axisDistance: bgAxis,
        prototypeStep: backgroundRing.prototypeStep !== undefined
          ? backgroundRing.prototypeStep
          : 1,
        rotationY: backgroundRing.rotationY !== undefined ? backgroundRing.rotationY : 0,
      },
      primaryPrototypes: primaryPrototypes,
      backgroundPrototypes: backgroundPrototypes,
      renderOrder: os.renderOrder !== undefined ? os.renderOrder : 1,
      textures: {
        enabled: tex.enabled !== false,
        dir: tex.dir || 'assets/textures/outside-buildings/',
        tint: tex.tint || '#ffffff',
      },
      edges: {
        enabled: edges.enabled !== false,
        color: edges.color || '#000000',
        opacity: edges.opacity !== undefined ? edges.opacity : 1.0,
      },
    };
  },

  _collectTexturePaths: function (cfg) {
    var tex = cfg.textures;
    var paths = {};
    var add = function (file) {
      var p = this._resolvePath(tex.dir, file);
      if (p) paths[p] = true;
    }.bind(this);

    if (!tex.enabled) return [];
    var lists = [cfg.primaryPrototypes, cfg.backgroundPrototypes];
    for (var l = 0; l < lists.length; l++) {
      for (var i = 0; i < lists[l].length; i++) {
        add(lists[l][i].wall);
      }
    }
    return Object.keys(paths);
  },

  _preloadTextures: function (cfg, done) {
    var paths = this._collectTexturePaths(cfg);
    if (!paths.length) {
      done();
      return;
    }
    var self = this;
    var pending = paths.length;
    paths.forEach(function (path) {
      self._loader.load(
        path,
        function (texture) {
          texture.colorSpace = THREE.SRGBColorSpace;
          self._texCache[path] = texture;
          pending -= 1;
          if (pending === 0) done();
        },
        undefined,
        function () {
          console.warn('[outside-scenery] texture not loaded:', path);
          pending -= 1;
          if (pending === 0) done();
        }
      );
    });
  },

  _faceTexture: function (source, repeatX, repeatY) {
    if (!source) return null;
    var tex = source.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    return tex;
  },

  _createMaterials: function (cfg, proto) {
    var tex = cfg.textures;
    var w = proto.width;
    var h = proto.height;
    var tint = new THREE.Color(tex.tint || '#ffffff');
    var baseColor = tint.clone().multiply(new THREE.Color(proto.color));
    var wallPath = this._resolvePath(tex.dir, proto.wall);
    var wallSrc = wallPath ? this._texCache[wallPath] : null;

    var wallU = 1;
    var wallV = 1;
    if (proto.metersPerRepeat && proto.metersPerRepeat > 0) {
      wallU = w / proto.metersPerRepeat;
      wallV = h / proto.metersPerRepeat;
    }

    var self = this;
    var solidFace = function () {
      return new THREE.MeshBasicMaterial({ color: baseColor.clone() });
    };
    var wallFace = function () {
      var faceColor = baseColor.clone();
      var opts = { color: faceColor };
      if (wallSrc && tex.enabled) {
        if (proto.textureOnly) {
          opts.color = tint.clone();
        }
        opts.map = self._faceTexture(wallSrc, wallU, wallV);
      }
      return new THREE.MeshBasicMaterial(opts);
    };

    // BoxGeometry: 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z — крыша/пол только цвет.
    return [
      wallFace(),
      wallFace(),
      solidFace(),
      solidFace(),
      wallFace(),
      wallFace(),
    ];
  },

  _disposeMaterial: function (mat) {
    if (!mat) return;
    if (Array.isArray(mat)) {
      for (var i = 0; i < mat.length; i++) {
        this._disposeMaterial(mat[i]);
      }
      return;
    }
    if (mat.map) mat.map.dispose();
    mat.dispose();
  },

  _disposeAll: function () {
    for (var i = 0; i < this._buildings.length; i++) {
      var b = this._buildings[i];
      this._root.remove(b.group);
      if (b.mesh.geometry) b.mesh.geometry.dispose();
      this._disposeMaterial(b.mesh.material);
      if (b.edges) {
        if (b.edges.geometry) b.edges.geometry.dispose();
        if (b.edges.material) b.edges.material.dispose();
      }
    }
    this._buildings.length = 0;
  },

  _placeBuilding: function (cfg, proto, x, z, rotationY) {
    var h = proto.height;
    var geo = new THREE.BoxGeometry(proto.width, h, proto.depth);
    var materials = this._createMaterials(cfg, proto);
    var mesh = new THREE.Mesh(geo, materials);
    mesh.frustumCulled = false;
    mesh.renderOrder = cfg.renderOrder;

    var group = new THREE.Group();
    group.position.set(x, cfg.center.y + h * 0.5, z);
    group.rotation.y = rotationY;
    group.add(mesh);

    if (cfg.edges.enabled) {
      var edgeGeo = new THREE.EdgesGeometry(geo);
      var edgeMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(cfg.edges.color),
        transparent: cfg.edges.opacity < 1,
        opacity: cfg.edges.opacity,
      });
      var edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
      edgeLines.renderOrder = cfg.renderOrder + 1;
      edgeLines.frustumCulled = false;
      group.add(edgeLines);
    }

    this._root.add(group);
    this._buildings.push({ group: group, mesh: mesh });
  },

  _build: function (c) {
    var cx = c.center.x;
    var cz = c.center.z;
    var d = c.primaryRing.axisDistance;
    var rot = c.primaryRing.rotationY;

    // Серые — диагонали (перпендикулярно осям мира).
    var primarySlots = [
      { x:  d, z:  d },
      { x:  d, z: -d },
      { x: -d, z: -d },
      { x: -d, z:  d },
    ];

    for (var i = 0; i < c.primaryPrototypes.length; i++) {
      var ps = primarySlots[i] || primarySlots[0];
      this._placeBuilding(
        c, c.primaryPrototypes[i],
        cx + ps.x + c.primaryPrototypes[i].positionOffset.x,
        cz + ps.z + c.primaryPrototypes[i].positionOffset.z,
        rot
      );
    }

    var bg = c.backgroundPrototypes;
    if (!bg.length) return;

    var R = c.backgroundRing.axisDistance;
    var bgRot = c.backgroundRing.rotationY;
    var step = c.backgroundRing.prototypeStep;

    // Зелёные — стороны света, в просветах между серыми.
    var bgSlots = [
      { x: 0, z:  R },
      { x:  R, z: 0 },
      { x: 0, z: -R },
      { x: -R, z: 0 },
    ];

    for (var j = 0; j < bgSlots.length; j++) {
      var bgIdx = ((j * step) % bg.length + bg.length) % bg.length;
      var proto = bg[bgIdx];
      var bs = bgSlots[j];
      var dist = Math.max(0, R + (proto.axisDistanceOffset || 0));
      var px = cx + (bs.x !== 0 ? (bs.x > 0 ? dist : -dist) : 0) + proto.positionOffset.x;
      var pz = cz + (bs.z !== 0 ? (bs.z > 0 ? dist : -dist) : 0) + proto.positionOffset.z;
      this._placeBuilding(c, proto, px, pz, bgRot);
    }
  },
});
