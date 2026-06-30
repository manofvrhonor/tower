/* global AFRAME, CONFIG, THREE */

/**
 * assembly-core — слоты сборки механизма на ядре (Фаза 1, шаг 1.2).
 *
 * Читает CONFIG.mechanisms[<mechanism>] и рисует призрачные wireframe-боксы
 * в позах слотов (эволюция ghost-tower-hint). Это ВИЗУАЛ-подсказка «куда
 * ставить деталь».
 *
 * Шаг 1.3: компонент также ведёт учёт занятости слотов и отдаёт мировую позу
 * ближайшего свободного слота для снепа детали. Публичное API (зовёт
 * floating-cube при release):
 *   - findFreeSlotNear(worldPos) → { slotId, position, quaternion } | null
 *   - occupySlot(slotId, el)  — пометить слот занятым (призрак скрывается)
 *   - releaseSlot(slotId)     — освободить слот (для слома, шаг 1.4)
 *   - isSlotOccupied(slotId)
 *   - areAllSlotsOccupied() — все слоты заняты (victory-check, шаг 1.5)
 *   - getMechanismId() / getOccupiedSlots() / resetOccupancy()
 *
 * Слоты в CONFIG заданы локально к верху ядра. Entity ставится в позицию
 * верха стола (см. index.html: position = pedestal.tableSurfaceY), поэтому
 * slot.position используется как локальное смещение от entity.
 */
AFRAME.registerComponent('assembly-core', {
  schema: {
    // id механизма из CONFIG.mechanisms; '' → первый по порядку (прототип Фазы 1).
    mechanism: { default: '' },
    // Ребро призрачного слота, м (равно размеру детали-куба прототипа).
    slotSize:  { default: 0.1 },
    color:     { default: '#ffe066' },
    opacity:   { default: 1.0 },
  },

  init: function () {
    this._slotMeshes = [];
    this._mechanismId = null;
    this._occupied = {};          // slotId → entity (или true), занятые слоты
    this._tmpVec = new THREE.Vector3();
    this._group = new THREE.Group();
    this._group.name = 'assembly-core-slots';
    this.el.object3D.add(this._group);
    this._buildSlots();
  },

  remove: function () {
    this._clear();
    if (this._group.parent) this._group.parent.remove(this._group);
  },

  /** Слоты активного механизма из конфига (или [] если не найден). */
  _getSlots: function () {
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
      this._group.remove(m);
      m.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    this._slotMeshes.length = 0;
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

  ensureSlotsBuilt: function () {
    if (!this._slotMeshes.length) this._buildSlots();
  },

  _buildSlots: function () {
    this._clear();
    this._occupied = {};
    var slots = this._getSlots();
    var s = this.data.slotSize;
    var vis = this._readSlotVisual();

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var boxGeo = new THREE.BoxGeometry(s, s, s);
      var edges = new THREE.EdgesGeometry(boxGeo);

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
      slotRoot.add(lines);

      this._group.add(slotRoot);
      this._slotMeshes.push(slotRoot);
    }

    console.log('[assembly-core] built', this._slotMeshes.length,
      'slot ghosts for mechanism', this._mechanismId);
  },

  /** Призрак-mesh слота по его id (или null). */
  _meshById: function (slotId) {
    for (var i = 0; i < this._slotMeshes.length; i++) {
      if (this._slotMeshes[i].userData.slotId === slotId) return this._slotMeshes[i];
    }
    return null;
  },

  /**
   * Ближайший СВОБОДНЫЙ слот в пределах допуска CONFIG.assembly.snapPosTolerance.
   * Возвращает мировую позу слота для снепа детали или null.
   *
   * Прототип Фазы 1: матч по расстоянию, без part-id (любая важная деталь →
   * ближайший свободный слот). Точный матч по acceptPartId — Фаза 4.
   *
   * @param {THREE.Vector3} worldPos — мировой центр детали при release.
   * @returns {{slotId:string, position:THREE.Vector3, quaternion:THREE.Quaternion}|null}
   */
  findFreeSlotNear: function (worldPos) {
    var tol = (typeof CONFIG !== 'undefined' && CONFIG.assembly &&
      CONFIG.assembly.snapPosTolerance !== undefined)
      ? CONFIG.assembly.snapPosTolerance : 0.05;

    var best = null;
    var bestDist = tol;
    for (var i = 0; i < this._slotMeshes.length; i++) {
      var m = this._slotMeshes[i];
      if (this._occupied[m.userData.slotId]) continue;
      m.getWorldPosition(this._tmpVec);
      var d = this._tmpVec.distanceTo(worldPos);
      if (d <= bestDist) { bestDist = d; best = m; }
    }
    if (!best) return null;

    var pos = new THREE.Vector3();
    best.getWorldPosition(pos);
    var quat = new THREE.Quaternion();
    best.getWorldQuaternion(quat);
    return { slotId: best.userData.slotId, position: pos, quaternion: quat };
  },

  isSlotOccupied: function (slotId) {
    return !!this._occupied[slotId];
  },

  /** Пометить слот занятым; призрак занятого слота скрываем (визуальный фидбэк). */
  occupySlot: function (slotId, el) {
    this._occupied[slotId] = el || true;
    var m = this._meshById(slotId);
    if (m) m.visible = false;
  },

  /** Освободить слот (слом сборки, шаг 1.4); призрак снова виден. */
  releaseSlot: function (slotId) {
    delete this._occupied[slotId];
    var m = this._meshById(slotId);
    if (m) m.visible = true;
  },

  /** id активного механизма из CONFIG (после _getSlots). */
  getMechanismId: function () {
    if (!this._mechanismId) this._getSlots();
    return this._mechanismId;
  },

  /** Число слотов механизма. */
  getSlotCount: function () {
    return this._slotMeshes.length;
  },

  /** true — каждый слот занят (проверка победы, шаг 1.5). */
  areAllSlotsOccupied: function () {
    if (!this._slotMeshes.length) return false;
    for (var i = 0; i < this._slotMeshes.length; i++) {
      if (!this._occupied[this._slotMeshes[i].userData.slotId]) return false;
    }
    return true;
  },

  /**
   * Занятые слоты: [{ slotId, el }]. el — entity детали или true (legacy).
   */
  getOccupiedSlots: function () {
    var out = [];
    for (var sid in this._occupied) {
      if (!Object.prototype.hasOwnProperty.call(this._occupied, sid)) continue;
      out.push({ slotId: sid, el: this._occupied[sid] });
    }
    return out;
  },

  /** Сброс занятости (рестарт / «Заново»): все призраки слотов снова видны. */
  resetOccupancy: function () {
    var ids = Object.keys(this._occupied);
    for (var i = 0; i < ids.length; i++) {
      this.releaseSlot(ids[i]);
    }
  },
});
