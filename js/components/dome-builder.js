/* global AFRAME, THREE */

/**
 * dome-builder.js
 *
 * Строит ФИЗИЧЕСКИЙ коллайдер купола как набор тонких боксов-плиток,
 * аппроксимирующих поверхность капсулы (цилиндр + верхняя полусфера).
 *
 * --- Зачем так ---
 *
 * Декларативный physx-body на a-cylinder / a-sphere строит convex hull —
 * сплошной выпуклый объём. Кубик, оказавшийся внутри такого объёма,
 * выталкивается наружу (видно как «давление», дрожание у крышки и
 * редкие туннелирования сквозь стенку).
 *
 * Тонкие боксы (толщиной ~1 см) этой проблемы не имеют: PhysX строит из
 * a-box примитивный PxBoxGeometry без convex-обёртки, и кубик может
 * находиться по любую сторону тонкой плитки. Стык плиток перекрываем
 * (tileOverlap > 1) — щелей не будет.
 *
 * --- Структура ---
 *
 * 1. Стенка: N касательных вертикальных плиток по окружности цилиндра.
 *    Размер плитки: chord(касательная) × cylinderHeight × thickness.
 * 2. Крышка: M широтных колец, в каждом K касательных плиток.
 *    Каждая плитка наклонена так, чтобы её плоскость совпадала с
 *    касательной плоскостью к сфере в её центре.
 * 3. Полюс (макушка): один маленький горизонтальный бокс.
 *
 * Всего ≈ wallSegments + capLatitudeRings * capLongitudeSegments + 1
 *       = 24 + 4*16 + 1 = 89 static body. Для статики мизерная нагрузка.
 *
 * --- Использование ---
 *
 * Вешается на любой entity (например, на #dome-collider или прямо
 * на #dome-visual). Все плитки создаются как дочерние entity этого
 * хоста; чистятся при remove() компонента.
 *
 * --- Слои коллизий (Шаг 3.5.C) ---
 *
 * Все плитки размещаются на слое DOME (CONFIG.collisionLayers.DOME)
 * и сталкиваются с FLOAT_CUBE и BALL (не GRAVITY_CUBE). Это даёт:
 *   - плавающие кубики (FLOAT_CUBE) отскакивают от купола снаружи и изнутри;
 *   - кубики под гравитацией (GRAVITY_CUBE) проходят сквозь купол — могут
 *     скатиться со стола и выпасть наружу;
 *   - красные шары (BALL, Этап 6) — тоже;
 *   - схваченные рукой кубики (GRABBED_CUBE) проходят сквозь купол,
 *     потому что DOME НЕ включает GRABBED_CUBE в свою маску.
 * Статики (WORLD) с DOME не пересекаются — это и не нужно, плитки
 * сами static.
 *
 * --- ВАЖНО про числа в physx-material ---
 *
 * Биндинг physx-material из @c-frame/physx ждёт ИНДЕКСЫ слоёв через
 * запятую (CSV), а под капотом сам делает (1 << index). Поэтому в строку
 * атрибута мы складываем ИНДЕКСЫ (0, 1, 2, ...), а НЕ битовые маски.
 *
 * Если передать сюда готовую маску (например, 63), биндинг распарсит её
 * как одно число-индекс и сделает (1 << 63), что в JS-int32 переполняется
 * в -2147483648 и роняет PhysX с TypeError "outside the valid range
 * [0, 4294967295]". История бага — Сессия 9, рефакторинг 3.5.C.
 */

AFRAME.registerComponent('dome-builder', {
  schema: {
    // Все параметры берутся из CONFIG.dome — здесь только переопределения для отладки.
    enabled: { default: true },
  },

  init() {
    if (!this.data.enabled) return;

    const cfg = window.CONFIG && window.CONFIG.dome;
    if (!cfg) {
      console.error('[dome-builder] CONFIG.dome не найден');
      return;
    }

    this.tiles = [];   // ссылки на созданные entity (для cleanup)

    // --- Слои коллизий ---
    // CONFIG.collisionLayers — это ИНДЕКСЫ (0, 1, 2, ...). Биндинг
    // physx-material сам делает (1 << index). См. JSDoc файла, секция
    // "ВАЖНО про числа в physx-material".
    const layers = (window.CONFIG && window.CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6, BAT: 7,
    };
    // DOME — только FLOAT_CUBE снаружи. BALL проходит сквозь купол (Этап 6).
    const collidesWithList = [
      layers.FLOAT_CUBE,
    ].join(', ');
    this._layerSuffix =
      '; collisionLayers: ' + layers.DOME +
      '; collidesWithLayers: ' + collidesWithList;

    this._buildAll(cfg);

    console.log(
      '[dome-builder] построено плиток: ' + this.tiles.length +
      ' (layer DOME, collides with FLOAT_CUBE)'
    );
  },

  remove() {
    for (const t of this.tiles) {
      if (t.parentNode) t.parentNode.removeChild(t);
    }
    this.tiles.length = 0;
  },

  // ---------- Построение ----------

  _buildAll(cfg) {
    const c = cfg.collider;

    this._buildWall(cfg, c);
    this._buildCap(cfg, c);
    this._buildPole(cfg, c);
  },

  /**
   * Цилиндрическая стенка: wallSegments вертикальных плиток-касательных.
   *
   * Плитка i:
   *   - угол theta = i * 2π / N
   *   - центр на радиусе R, высоте (cylinderBottomY + cylinderTopY) / 2
   *   - повёрнута на theta вокруг Y, так что её «лицо» смотрит к оси
   *   - размер: width = chord * overlap, height = cylinderHeight, depth = thickness
   *
   * chord = 2 * R * sin(π / N) — длина хорды между соседними точками окружности,
   * она же — длина касательного сегмента, покрывающего сектор 2π/N.
   */
  _buildWall(cfg, c) {
    const N = c.wallSegments;
    const R = cfg.radius;
    const yMid = (cfg.cylinderBottomY + cfg.cylinderTopY) / 2;
    const height = cfg.cylinderHeight;
    const chord = 2 * R * Math.sin(Math.PI / N);
    const width = chord * c.tileOverlap;
    const thickness = c.shellThickness;

    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const x = R * Math.sin(theta);
      const z = R * Math.cos(theta);

      // Поворот вокруг Y: плитка лицом к центру.
      // По умолчанию a-box лежит лицом по +Z, нам нужно, чтобы её нормаль
      // указывала ОТ центра наружу (или внутрь — без разницы для коллизии).
      // Угол в градусах, atan2(x, z) даёт угол вокруг Y от +Z к +X.
      const rotY = THREE.MathUtils.radToDeg(Math.atan2(x, z));

      this._createTile({
        position: { x, y: yMid, z },
        rotation: { x: 0, y: rotY, z: 0 },
        width, height: height * c.tileOverlap, depth: thickness,
        material: c.physxMaterial,
        debug: c.debugVisible,
      });
    }
  },

  /**
   * Верхняя полусфера-крышка: capLatitudeRings колец, в каждом capLongitudeSegments плиток.
   *
   * Кольцо j (j = 0..M-1) на широте phi_j, где phi отсчитывается от экватора (0)
   * до полюса (π/2). Берём середины поясов:
   *   phi_j = (j + 0.5) * (π/2) / M
   *
   * В кольце j размещаем K плиток-касательных. Каждая плитка ориентирована
   * так, чтобы её нормаль совпадала с радиус-вектором из центра сферы в её центр.
   */
  _buildCap(cfg, c) {
    const M = c.capLatitudeRings;
    const K = c.capLongitudeSegments;
    const R = cfg.radius;
    const cy = cfg.cylinderTopY;   // центр сферы крышки
    const thickness = c.shellThickness;

    // Угловой шаг по широте
    const dPhi = (Math.PI / 2) / M;

    for (let j = 0; j < M; j++) {
      const phi = (j + 0.5) * dPhi;     // широта середины пояса (0..π/2)
      const ringR = R * Math.cos(phi);  // радиус кольца в плоскости XZ
      const yRing = cy + R * Math.sin(phi);

      // Размер плитки в этом кольце:
      // - по «горизонтали» (вдоль кольца) = хорда между соседями в кольце
      const chord = 2 * ringR * Math.sin(Math.PI / K);
      const width = chord * c.tileOverlap;
      // - по «вертикали» (вдоль меридиана) = длина дуги пояса = R * dPhi
      const arc = R * dPhi;
      const height = arc * c.tileOverlap;

      for (let i = 0; i < K; i++) {
        const theta = (i / K) * Math.PI * 2;
        const x = ringR * Math.sin(theta);
        const z = ringR * Math.cos(theta);

        // Ориентация плитки: её нормаль (изначально +Z для a-box) должна
        // смотреть в направлении радиус-вектора (x, R*sin(phi), z).normalized.
        // Это эквивалентно двум поворотам:
        //   1) вокруг Y на atan2(x, z) — поворачиваем плитку «лицом» к меридиану
        //   2) вокруг локального X на -phi — наклоняем к полюсу
        // В Эйлеровых углах A-Frame (порядок YXZ по умолчанию у three.js)
        // это: rotation = (-phi, theta_deg, 0).
        const rotY = THREE.MathUtils.radToDeg(Math.atan2(x, z));
        const rotX = -THREE.MathUtils.radToDeg(phi);

        this._createTile({
          position: { x, y: yRing, z },
          rotation: { x: rotX, y: rotY, z: 0 },
          width, height, depth: thickness,
          material: c.physxMaterial,
          debug: c.debugVisible,
        });
      }
    }
  },

  /**
   * Полюс (макушка купола): один горизонтальный квадратный бокс.
   * Закрывает дырку, остающуюся в центре крышки между верхним кольцом и осью.
   */
  _buildPole(cfg, c) {
    const R = cfg.radius;
    const cy = cfg.cylinderTopY;
    const M = c.capLatitudeRings;

    // Радиус «дырки» = радиус кольца, начинающегося ВЫШЕ последнего пояса.
    // Последний пояс заканчивается на phi = M*dPhi = π/2 — т.е. в идеале до полюса.
    // На практике центр последнего пояса на phi = (M-0.5)*dPhi, верхний край на M*dPhi.
    // Размер «шапки» возьмём с запасом — 2 * R * sin(dPhi/2) * overlap, где dPhi = π/(2M).
    const dPhi = (Math.PI / 2) / M;
    const capSize = 2 * R * Math.sin(dPhi / 2) * c.tileOverlap * 1.5;

    this._createTile({
      position: { x: 0, y: cy + R, z: 0 },
      rotation: { x: -90, y: 0, z: 0 },   // лицом вверх
      width: capSize, height: capSize, depth: c.shellThickness,
      material: c.physxMaterial,
      debug: c.debugVisible,
    });
  },

  // ---------- Хелпер: создать одну плитку ----------

  /**
   * Создаёт <a-box> с physx-body=static и physx-material, добавляет к хосту.
   * При debug=true плитка визуализируется полупрозрачным розовым.
   *
   * К базовой строке material из CONFIG.dome.collider.physxMaterial
   * дописываются collisionLayers/collidesWithLayers (слой DOME, см. init).
   */
  _createTile({ position, rotation, width, height, depth, material, debug }) {
    const el = document.createElement('a-box');

    el.setAttribute('position', position);
    el.setAttribute('rotation', rotation);
    el.setAttribute('width',  width);
    el.setAttribute('height', height);
    el.setAttribute('depth',  depth);

    // Коллайдер всегда невидим; контур — collider-debug-viz (PhysX PxShape).
    el.setAttribute('visible', false);
    el.setAttribute('data-physx-hidden-collider', '');

    el.setAttribute('physx-body', 'type: static');
    el.setAttribute('physx-material', material + this._layerSuffix);

    this.el.appendChild(el);
    this.tiles.push(el);
  },
});