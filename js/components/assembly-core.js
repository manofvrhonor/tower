/* global AFRAME, CONFIG, THREE */

/**
 * assembly-core — слоты сборки механизма на ядре (Фаза 1, шаг 1.2).
 *
 * Читает CONFIG.session.assemblySlots (rollAssemblySession) или fallback
 * CONFIG.mechanisms[<mechanism>]. Призраки: wireframe по GLB слота или box.
 * Ось A→F: виден призрак следующей стадии. Ветки parent+digit (C1–C3):
 * дети слота parent через pivot; крутятся с ring_inner и со спином C.
 * Занятый parent: скрываем только ghost-контент, корень остаётся visible
 * (иначе Three.js прячет и C*).
 *
 * Шаг 1.3: учёт занятости слотов и мировая поза для снепа (floating-cube).
 */
AFRAME.registerComponent('assembly-core', {
  schema: {
    mechanism: { default: '' },
    // Fallback-ребро призрака, м, если у acceptPartId нет parts[].model.
    slotSize:  { default: 0.1 },
    color:     { default: '#ffe066' },
    opacity:   { default: 1.0 },
  },

  init: function () {
    this._slotMeshes = [];
    this._mechanismId = null;
    this._occupied = {};
    this._tmpVec = new THREE.Vector3();
    this._group = new THREE.Group();
    this._group.name = 'assembly-core-slots';
    this.el.object3D.add(this._group);
    this._gltfCache = {};
    this._loader = null;
  },

  remove: function () {
    this._clear();
    if (this._group.parent) this._group.parent.remove(this._group);
  },

  _getLoader: function () {
    if (!this._loader) {
      this._loader = new THREE.GLTFLoader();
      this._loader.setCrossOrigin('anonymous');
    }
    return this._loader;
  },

  _findPart: function (partId) {
    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    if (session && session.partsById && session.partsById[partId]) {
      return session.partsById[partId];
    }
    var parts = (typeof CONFIG !== 'undefined' && CONFIG.parts) || [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i].id === partId) return parts[i];
    }
    return null;
  },

  _getSlots: function () {
    var session = (typeof CONFIG !== 'undefined' && CONFIG.session) || null;
    if (session && session.assemblySlots && session.assemblySlots.length) {
      this._mechanismId = 'session';
      return session.assemblySlots;
    }

    var mechs = (typeof CONFIG !== 'undefined' && CONFIG.mechanisms) || {};
    var id = this.data.mechanism || Object.keys(mechs)[0];
    var mech = mechs[id];
    if (!mech || !mech.slots) {
      console.warn('[assembly-core] механизм не найден:', id);
      return [];
    }
    this._mechanismId = id;
    return mech.slots;
  },

  _clear: function () {
    for (var i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      if (m.parent) m.parent.remove(m);
      m.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(function (mat) { mat.dispose(); });
          } else {
            child.material.dispose();
          }
        }
      });
    }
    this._slotMeshes.length = 0;
    // Pivot-ы веток (пустые Group на parent-слотах).
    if (this._branchPivots) {
      var pid;
      for (pid in this._branchPivots) {
        if (!Object.prototype.hasOwnProperty.call(this._branchPivots, pid)) continue;
        var piv = this._branchPivots[pid];
        if (piv && piv.parent) piv.parent.remove(piv);
      }
      this._branchPivots = {};
    }
  },

  _readSlotVisual: function () {
    var az = (typeof CONFIG !== 'undefined' && CONFIG.assemblyZone) || {};
    var v = az.slotVisual || {};
    return {
      color: v.color || this.data.color || '#ffe066',
      opacity: v.opacity !== undefined ? v.opacity : (this.data.opacity !== undefined ? this.data.opacity : 1.0),
      renderOrder: v.renderOrder !== undefined ? v.renderOrder : 1100,
      fillOpacity: v.fillOpacity !== undefined ? v.fillOpacity : 0.22,
    };
  },

  rebuildFromSession: function () {
    this._buildSlots();
  },

  ensureSlotsBuilt: function () {
    if (!this._slotMeshes.length) this._buildSlots();
  },

  _makeSlotRoot: function (slot) {
    var p = slot.position || { x: 0, y: 0, z: 0 };
    var r = slot.rotation || { x: 0, y: 0, z: 0 };
    var slotRoot = new THREE.Group();
    slotRoot.position.set(p.x, p.y, p.z);
    slotRoot.rotation.set(
      THREE.MathUtils.degToRad(r.x || 0),
      THREE.MathUtils.degToRad(r.y || 0),
      THREE.MathUtils.degToRad(r.z || 0)
    );
    slotRoot.frustumCulled = false;
    slotRoot.userData.slotId = slot.id;
    slotRoot.userData.acceptPartId = slot.acceptPartId || '';
    slotRoot.userData.role = slot.role || '';
    slotRoot.userData.order = slot.order !== undefined ? slot.order : 0;
    slotRoot.userData.stageId = slot.stageId || null;
    slotRoot.userData.isBranch = !!slot.isBranch;
    slotRoot.userData.parentId = slot.parentId || null;
    slotRoot.userData.parentOrder = slot.parentOrder !== undefined ? slot.parentOrder : null;
    return slotRoot;
  },

  _addBoxGhost: function (slotRoot, size, vis) {
    var boxGeo = new THREE.BoxGeometry(size, size, size);
    var edges = new THREE.EdgesGeometry(boxGeo);

    var fillMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(vis.color),
      transparent: true,
      opacity: vis.fillOpacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    var fill = new THREE.Mesh(boxGeo, fillMat);
    fill.renderOrder = vis.renderOrder - 1;
    fill.userData.isGhostContent = true;
    slotRoot.add(fill);

    var lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(vis.color),
      transparent: vis.opacity < 1,
      opacity: vis.opacity,
      depthTest: false,
      depthWrite: false,
    });
    var lines = new THREE.LineSegments(edges, lineMat);
    lines.renderOrder = vis.renderOrder;
    lines.userData.isGhostContent = true;
    slotRoot.add(lines);
  },

  _applyGhostMaterials: function (root, vis) {
    var lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(vis.color),
      transparent: vis.opacity < 1,
      opacity: vis.opacity,
      depthTest: false,
      depthWrite: false,
    });

    root.userData.isGhostContent = true;
    root.traverse(function (node) {
      if (!node.isMesh || !node.geometry) return;

      node.material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(vis.color),
        transparent: true,
        opacity: vis.fillOpacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      node.renderOrder = vis.renderOrder - 1;
      node.frustumCulled = false;
      node.userData.isGhostContent = true;

      var edges = new THREE.EdgesGeometry(node.geometry);
      var lines = new THREE.LineSegments(edges, lineMat.clone());
      lines.renderOrder = vis.renderOrder;
      lines.userData.isGhostContent = true;
      node.add(lines);
    });
  },

  _loadGhostScene: function (url, done) {
    var cached = this._gltfCache[url];
    if (cached) {
      done(cached.clone(true));
      return;
    }

    var self = this;
    this._getLoader().load(url, function (gltf) {
      var root = gltf.scene || gltf.scenes[0];
      if (!root) {
        done(null);
        return;
      }
      self._gltfCache[url] = root;
      done(root.clone(true));
    }, undefined, function (err) {
      console.warn('[assembly-core] ghost GLB failed:', url, err);
      done(null);
    });
  },

  _buildSlotGhost: function (slot, vis, parentObj) {
    var slotRoot = this._makeSlotRoot(slot);
    var part = this._findPart(slot.acceptPartId);
    var modelUrl = slot.model || (part && part.model);
    var self = this;
    var fallbackSize = (slot.stubSize !== undefined ? slot.stubSize : null) || this.data.slotSize;
    var branchVis = vis;
    if (slot.stub && slot.stubColor) {
      branchVis = {
        color: slot.stubColor,
        opacity: vis.opacity,
        renderOrder: vis.renderOrder,
        fillOpacity: vis.fillOpacity,
      };
    }

    var attachTo = parentObj || this._group;
    attachTo.add(slotRoot);
    this._slotMeshes.push(slotRoot);

    if (!modelUrl || slot.stub) {
      this._addBoxGhost(slotRoot, fallbackSize, branchVis);
      return slotRoot;
    }

    this._loadGhostScene(modelUrl, function (scene) {
      if (!scene) {
        self._addBoxGhost(slotRoot, fallbackSize, vis);
        return;
      }
      self._applyGhostMaterials(scene, vis);
      slotRoot.add(scene);
    });
    return slotRoot;
  },

  _branchPivotFor: function (parentSlotRoot, parentStageId) {
    if (!this._branchPivots) this._branchPivots = {};
    var existing = this._branchPivots[parentStageId];
    if (existing) return existing;
    var piv = new THREE.Group();
    piv.name = 'branch-pivot-' + parentStageId;
    piv.userData.isBranchPivot = true;
    parentSlotRoot.add(piv);
    this._branchPivots[parentStageId] = piv;
    return piv;
  },

  /** Скрыть/показать только призрак слота, не трогая branch-pivot (дети C*). */
  _setGhostContentVisible: function (slotRoot, on) {
    var i;
    for (i = 0; i < slotRoot.children.length; i++) {
      var ch = slotRoot.children[i];
      if (ch.userData && ch.userData.isBranchPivot) continue;
      ch.visible = !!on;
    }
  },

  _hasBranchPivot: function (stageId) {
    return !!(this._branchPivots && stageId && this._branchPivots[stageId]);
  },

  _buildSlots: function () {
    this._clear();
    this._occupied = {};
    this._branchPivots = {};
    var slots = this._getSlots();
    var vis = this._readSlotVisual();
    var byStage = {};
    var i;

    // Сначала ось — нужны mesh parent для веток.
    for (i = 0; i < slots.length; i++) {
      if (slots[i].isBranch) continue;
      var mainRoot = this._buildSlotGhost(slots[i], vis, this._group);
      if (slots[i].stageId) byStage[slots[i].stageId] = mainRoot;
    }

    // Ветки — дети parent-слота через pivot (крутятся со спином C).
    for (i = 0; i < slots.length; i++) {
      if (!slots[i].isBranch) continue;
      var parentRoot = byStage[slots[i].parentId];
      if (!parentRoot) {
        console.warn('[assembly-core] branch without parent slot:', slots[i].id);
        this._buildSlotGhost(slots[i], vis, this._group);
        continue;
      }
      var piv = this._branchPivotFor(parentRoot, slots[i].parentId);
      this._buildSlotGhost(slots[i], vis, piv);
    }

    this._updateGhostVisibility();
    console.log('[assembly-core] building', slots.length,
      'slot ghosts for mechanism', this._mechanismId,
      '| next order:', this.nextRequiredOrder());
  },

  /**
   * Синхрон pivot веток с core-спином parent (part-entity._spinGroup).
   */
  tick: function () {
    if (!this._branchPivots) return;
    var pid;
    for (pid in this._branchPivots) {
      if (!Object.prototype.hasOwnProperty.call(this._branchPivots, pid)) continue;
      var piv = this._branchPivots[pid];
      if (!piv) continue;
      var parentMesh = null;
      var i;
      for (i = 0; i < this._slotMeshes.length; i++) {
        if (this._slotMeshes[i].userData.stageId === pid &&
            !this._slotMeshes[i].userData.isBranch) {
          parentMesh = this._slotMeshes[i];
          break;
        }
      }
      if (!parentMesh) continue;
      var el = this._occupied[parentMesh.userData.slotId];
      if (!el || el === true || !el.components) {
        piv.quaternion.set(0, 0, 0, 1);
        continue;
      }
      var pe = el.components['part-entity'];
      if (pe && pe._spinGroup) {
        piv.quaternion.copy(pe._spinGroup.quaternion);
      } else {
        piv.quaternion.set(0, 0, 0, 1);
      }
    }
  },

  /**
   * Ось: призрак следующей незанятой стадии.
   * Ветки: призраки после parent; корень parent с ветками НЕ hidden целиком
   * (иначе Three.js гасит детей C* вместе с C).
   */
  _updateGhostVisibility: function () {
    var next = this.nextRequiredOrder();
    var i;
    for (i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      var sid = m.userData.slotId;
      var stageId = m.userData.stageId;

      if (this._occupied[sid]) {
        if (!m.userData.isBranch && this._hasBranchPivot(stageId)) {
          // Parent занят, но корень остаётся visible — на нём висят C*.
          m.visible = true;
          this._setGhostContentVisible(m, false);
        } else {
          m.visible = false;
        }
        continue;
      }

      if (m.userData.isBranch) {
        var showBr = this._isStageOccupied(m.userData.parentId);
        m.visible = showBr;
        if (showBr) this._setGhostContentVisible(m, true);
        continue;
      }

      var showMain = next !== null && (m.userData.order || 0) === next;
      m.visible = showMain;
      this._setGhostContentVisible(m, showMain);
    }
  },

  _isStageOccupied: function (stageId) {
    if (!stageId) return false;
    var i;
    for (i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      if (m.userData.stageId !== stageId) continue;
      return !!this._occupied[m.userData.slotId];
    }
    return false;
  },

  _meshById: function (slotId) {
    for (var i = 0; i < this._slotMeshes.length; i++) {
      if (this._slotMeshes[i].userData.slotId === slotId) return this._slotMeshes[i];
    }
    return null;
  },

  /**
   * Наименьший order среди незанятых слотов оси (без веток).
   */
  nextRequiredOrder: function () {
    var next = null;
    for (var i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      if (m.userData.isBranch) continue;
      if (this._occupied[m.userData.slotId]) continue;
      var o = m.userData.order || 0;
      if (next === null || o < next) next = o;
    }
    return next;
  },

  _slotPose: function (m) {
    var wp = new THREE.Vector3();
    m.getWorldPosition(wp);
    var wq = new THREE.Quaternion();
    m.getWorldQuaternion(wq);
    return {
      slotId: m.userData.slotId,
      position: wp,
      quaternion: wq,
      localPosition: m.position.clone(),
      localQuaternion: m.quaternion.clone(),
    };
  },

  getSlotPose: function (slotId) {
    var m = this._meshById(slotId);
    return m ? this._slotPose(m) : null;
  },

  findFreeSlotNear: function (worldPos, partId) {
    var tol = (typeof CONFIG !== 'undefined' && CONFIG.assembly &&
      CONFIG.assembly.snapPosTolerance !== undefined)
      ? CONFIG.assembly.snapPosTolerance : 0.05;

    var branchMesh = null;
    var i;
    for (i = 0; i < this._slotMeshes.length; i++) {
      var bm = this._slotMeshes[i];
      if (!bm.userData.isBranch) continue;
      if (partId && bm.userData.acceptPartId && bm.userData.acceptPartId !== partId) continue;
      branchMesh = bm;
      break;
    }

    if (branchMesh) {
      if (this._occupied[branchMesh.userData.slotId]) return null;
      if (!this._isStageOccupied(branchMesh.userData.parentId)) return null;
      branchMesh.getWorldPosition(this._tmpVec);
      if (this._tmpVec.distanceTo(worldPos) > tol) return null;
      return this._slotPose(branchMesh);
    }

    var required = this.nextRequiredOrder();
    if (required === null) return null;

    var best = null;
    var bestDist = tol;
    for (i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      if (m.userData.isBranch) continue;
      if (this._occupied[m.userData.slotId]) continue;
      if ((m.userData.order || 0) !== required) continue;
      if (partId && m.userData.acceptPartId && m.userData.acceptPartId !== partId) {
        continue;
      }
      m.getWorldPosition(this._tmpVec);
      var d = this._tmpVec.distanceTo(worldPos);
      if (d <= bestDist) { bestDist = d; best = m; }
    }
    if (!best) return null;

    return this._slotPose(best);
  },

  isSlotOccupied: function (slotId) {
    return !!this._occupied[slotId];
  },

  getSlotOrder: function (slotId) {
    var m = this._meshById(slotId);
    return m ? (m.userData.order || 0) : 0;
  },

  /**
   * Каскад: слоты оси с order > afterOrder + ветки parentOrder > afterOrder
   * или parentOrder === afterOrder (дети снимаемого parent).
   */
  getOccupiedAboveOrder: function (afterOrder) {
    var out = [];
    var i;
    for (i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      var sid = m.userData.slotId;
      if (!this._occupied[sid]) continue;
      var o = m.userData.order || 0;
      var include = false;
      if (m.userData.isBranch) {
        var po = m.userData.parentOrder;
        if (po === null || po === undefined) po = -1;
        include = po > afterOrder || po === afterOrder;
      } else {
        include = o > afterOrder;
      }
      if (include) {
        out.push({
          slotId: sid,
          el: this._occupied[sid],
          order: o,
          stageId: m.userData.stageId || null,
        });
      }
    }
    out.sort(function (a, b) { return b.order - a.order; });
    return out;
  },

  /** Живые занятые стадии: [{ slotId, stageId, order, el }]. */
  getLiveOccupiedStages: function () {
    var out = [];
    var i;
    for (i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      var sid = m.userData.slotId;
      if (!this._occupied[sid]) continue;
      out.push({
        slotId: sid,
        stageId: m.userData.stageId || null,
        order: m.userData.order || 0,
        el: this._occupied[sid],
      });
    }
    out.sort(function (a, b) { return a.order - b.order; });
    return out;
  },

  occupySlot: function (slotId, el) {
    this._occupied[slotId] = el || true;
    this._updateGhostVisibility();
  },

  releaseSlot: function (slotId) {
    delete this._occupied[slotId];
    this._updateGhostVisibility();
  },

  getMechanismId: function () {
    if (!this._mechanismId) this._getSlots();
    return this._mechanismId;
  },

  getSlotCount: function () {
    return this._slotMeshes.length;
  },

  areAllSlotsOccupied: function () {
    if (!this._slotMeshes.length) return false;
    for (var i = 0; i < this._slotMeshes.length; i++) {
      if (!this._occupied[this._slotMeshes[i].userData.slotId]) return false;
    }
    return true;
  },

  getOccupiedSlots: function () {
    var out = [];
    for (var sid in this._occupied) {
      if (!Object.prototype.hasOwnProperty.call(this._occupied, sid)) continue;
      out.push({ slotId: sid, el: this._occupied[sid] });
    }
    return out;
  },

  resetOccupancy: function () {
    var ids = Object.keys(this._occupied);
    for (var i = 0; i < ids.length; i++) {
      this.releaseSlot(ids[i]);
    }
  },
});
