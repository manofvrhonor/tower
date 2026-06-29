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
 * Слом при ударе и проверка победы — следующие микро-шаги (1.4–1.5).
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
    color:     { default: '#33e0ff' },
    opacity:   { default: 0.6 },
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
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }
    this._slotMeshes.length = 0;
  },

  _buildSlots: function () {
    this._clear();
    this._occupied = {};
    var slots = this._getSlots();
    var s = this.data.slotSize;

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var boxGeo = new THREE.BoxGeometry(s, s, s);
      var edges = new THREE.EdgesGeometry(boxGeo);
      var mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.data.color),
        transparent: true,
        opacity: this.data.opacity,
        depthTest: false,
        depthWrite: false,
      });
      var lines = new THREE.LineSegments(edges, mat);

      var p = slot.position || { x: 0, y: 0, z: 0 };
      var r = slot.rotation || { x: 0, y: 0, z: 0 };
      lines.position.set(p.x, p.y, p.z);
      lines.rotation.set(
        THREE.MathUtils.degToRad(r.x || 0),
        THREE.MathUtils.degToRad(r.y || 0),
        THREE.MathUtils.degToRad(r.z || 0)
      );
      lines.renderOrder = 500;
      lines.frustumCulled = false;
      lines.userData.slotId = slot.id;

      this._group.add(lines);
      this._slotMeshes.push(lines);
      boxGeo.dispose();
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
});
