/**
 * config.js — все геймплейные параметры в одном месте.
 *
 * Правило проекта: если хочется что-то поменять (размер, цвет, скорость) —
 * сначала проверь, нет ли этого здесь. Магические числа в коде запрещены.
 */

const CONFIG = {
  // === Отладка (диагностика коллайдеров) ===
  debug: {
    // true → контуры реальных PhysX PxShape (getBoxGeometry/getSphereGeometry + pose из rigidBody).
    showColliders: true,
    colliderOpacity: 0.85,
    showBBoxHelper: false,
    // Зарезервировано; контуры рисуются на всех physx-body через EdgesGeometry.
    showAllPhysxBodies: false,
    // Палитра wireframe: ключ = имя слоя CONFIG.collisionLayers или KINEMATIC.
    colliderColors: {
      WORLD:        '#7a9eb0',  // пол, стены, пьедestal
      DOME:         '#44aaff',  // плитки купола
      FLOAT_CUBE:   '#33cc66',  // куб в float
      GRAVITY_CUBE: '#ffcc00',  // куб на столе
      GRABBED_CUBE: '#ff8800',  // куб в руке
      BALL:         '#ff3333',  // красный шар
      BAT:          '#cc9900',  // бита-сковородка
      HAND:         '#aa44ff',  // сфера руки
      KINEMATIC:    '#ffffff',  // прочее kinematic
    },
  },

  // === Комната ===
  room: {
    width: 3,        // метры (X)
    depth: 3,        // метры (Z)
    height: 3,       // метры (Y) — куб 3×3×3
    floorColor:   '#8a8580',
    wallColor:    '#d4cfc0',
    ceilingColor: '#f0ede5',
  },

  // === Парящий стол (центр комнаты) ===
  pedestal: {
    radius: 0.3,           // метры (диаметр 60 см)
    tableSurfaceY: 1.0,    // мир: верх стола (плоскость коллайдера)
    height: 1.0,           // только для бортика, если wallSegments > 0
    color: '#3a3a3a',
    visual: {
      diskThickness: 0.03, // визуал и PhysX-диск (wallSegments=0)
    },
    physxMaterial: {
      restitution:      0.15,
      staticFriction:   0.70,
      dynamicFriction:  0.60,
    },
    collider: {
      wallSegments:   0,     // 0 = один диск; >0 = столб с бортом (legacy)
      shellThickness: 0.02,
      topThickness:   0.01,  // только при wallSegments > 0
      tileOverlap:    1.08,
      debugVisible:   false,
    },
  },

  // Материалы статики комнаты (main.js проставляет на #floor и #pedestal).
  world: {
    woodMaterial: {
      restitution:      0.15,
      staticFriction:   0.70,
      dynamicFriction:  0.60,
    },
    // Стены/потолок — упругие, нужны для дрейфа float-кубиков.
    bounceMaterial: {
      restitution:      0.95,
      staticFriction:   0.05,
      dynamicFriction:  0.05,
    },
  },

  // === Игрок ===
  player: {
    startPosition: { x: 0, y: 0, z: 1 },  // 1 метр южнее центра
    eyeHeight: 1.6,                        // высота камеры над полом игрока
  },

  // === Замедление времени (SUPERHOT, Этап 4) ===
  // «Время мира»: sceneEl.systems['time-scale'].getScale() → 0.05..1.0.
  // Любой новый объект (шары, враги, частицы) должен умножать своё движение на getScale().
  // Не замедляется: PhysX рук, стол, купол, rig игрока.
  timeScale: {
    min: 0.05,           // «замёрзшее» время (~5% скорости мира)
    max: 1.0,            // нормальное время
    stillSpeed: 0.02,    // м/с — ниже считаем «стоим»
    moveSpeed: 0.12,     // м/с — выше = полный max

    // Асимметричное сглаживание: заморозка быстрая, разморозка медленнее.
    activityResponseDown: 14,  // activity быстро падает при остановке
    activityResponseUp: 5,     // activity медленнее растёт при старте движения
    scaleResponseDown: 10,     // timeScale быстро → min
    scaleResponseUp: 3,        // timeScale медленно → max (базовая скорость разморозки)
    // Мелкое движение (поворот головы) размораживает ещё медленнее;
    // 0.25 = при слабом движении скорость разморозки = 25% от scaleResponseUp.
    scaleUpIntensityMin: 0.25,

    // Мёртвая зона от дрожания трекинга (м/с вычитается до расчёта activity).
    // softWidth — мягкий вход: между deadband и deadband+softWidth вклад растёт квадратично.
    headJitterDeadband: 0.03,
    headJitterSoftWidth: 0.04,
    handJitterDeadband: 0.11,
    handJitterSoftWidth: 0.08,

    debug: false,         // true → раз в ~0.5 с лог activity и scale в консоль
  },

  // === Визуальный feedback слоумо (Этап 4, шаг 5) ===
  slowmoFx: {
    vignette: {
      maxOpacity: 0.55,        // пик затемнения по краям (умерено: и в браузере, и в Quest)
      planeSize: 1.6,          // м — покрывает FOV на planeDistance
      planeDistance: 0.18,     // м перед камерой (локальный −Z)
      gradientInnerPx: 28,     // радиус прозрачного центра на текстуре 512px
    },
    trail: {
      // Loft-хвост: profile sweep вдоль trace (задача 4c).
      // Голова = живая позиция куба; spine — CatmullRom по сечениям.
      trailLengthM: 0.6,       // БУФЕР trace, м — длиннее хвоста, с запасом
      trailSpacingM: 0.03,     // м — шаг между сечениями loft (+50% → длиннее хвост)
      loftSectionCount: 14,    // число сечений в loft-mesh (12–16)
      minSampleStep: 0.022,    // м — мин. шаг записи точки в буфер
      minVisibility: 0.1,      // 10% яркости хвоста при full realtime
      maxVisibility: 0.15,     // 15% яркости хвоста при полном slo-mo
      maxOpacity: 1.0,         // пик opacity на плато (× trailVis × alongTrailAlpha)
      fadePower: 1.35,         // затухание хвоста (участок после headFadeInM)
      headFadeInM: 0.1,        // м — fade-in у объекта: 0→пик за 10 см
      grabFadeOutSec: 2.5,     // с — плавное исчезновение хвоста при захвате
      deployLengthM: 0.42,     // м — пробег куба до полного разжатия (якорь → follow)
      headSkipM: 0.028,        // отставание первого сегмента (не рисовать прямо под кубом)
      sizeScale: 0.95,         // базовый размер сегмента относительно куба
      headSizeScale: 0.95,     // стартовый сегмент хвоста: −5% от базового
      tailSizeScale: 0.475,    // конец хвоста — 50% от headSizeScale (сужение ×2)
    },
  },

  // Плавающие кубики (свойство float — невесомость + инерция).
  // Используются компонентом floating-cube. См. CURRENT_TASK.md, задача 2.
  floatingCubes: {
    size: 0.1,                  // ребро куба, м
    mass: 1.0,                  // ~10 см «деревянный» куб, кг

    // physx-material: float — упругий (дрейф в невесомости).
    floatMaterial: {
      restitution:      0.9,
      staticFriction:   0.05,
      dynamicFriction:  0.05,
    },
    // physx-material: gravity — дерево (башня, падения на стол).
    // Низкий restitution → почти без отскока (куб не «резиновый»).
    // Высокий friction → стопки не сползают. Combine с пьедесталом/полом — среднее.
    gravityMaterial: {
      restitution:      0.05,
      staticFriction:   0.90,
      dynamicFriction:  0.70,
    },

    // Физика парения
    disableGravity: true,
    linearDamping: 0.03,
    angularDamping: 0.05,

    // Качество контактов кубов (для всех состояний). Дефолт солвера PhysX 4/1
    // мало: стопки скользят (мало velocity-итераций), рёберные удары глубоко
    // продавливаются и «резиново» выбрасываются (мало position-итераций).
    // Speculative CCD не даёт проникнуть на быстром рёберном ударе.
    solverPositionIterations: 16,
    solverVelocityIterations:  4,
    speculativeCCD:           true,
    // Раннее обнаружение контакта (м): солвер тормозит куб ДО глубокого
    // проникновения, поэтому нет «резинового» выброса депенетрации на рёберном
    // ударе. Куб всё равно ложится на restOffset≈0, не «висит» над поверхностью.
    // Gravity: 0.03 — анти-«резиновый» выброс на столе (ADR-14). Float: меньше —
    // шары r=0.04, иначе ранний contactbegin + _boostHitCube до касания.
    contactOffset:            0.03,
    floatContactOffset:       0.012,

    // Стартовая линейная скорость, м/с.
    // Эмпирически: 0.2 даёт слишком вялое движение из-за потерь
    // в контактах PhysX (см. JSDoc floating-cube.js, п.5).
    initialImpulseSpeed: 0.3,

    // Стартовая угловая скорость, рад/с (по модулю).
    // Направление случайное. 0 — без вращения.
    initialAngularSpeed: 0.8,

    // Импульс вверх при возврате в float с пола (задача 3, Шаг 5), м/с.
    floorReturnSpeed: 0.25,

    // Минимальная скорость дрейфа (float). Биндинг PhysX теряет энергию в контактах
    // даже при restitution=0.9 — tick подтягивает velocity до этого порога.
    // timeScale масштабирует видимую скорость поверх «полной».
    minDriftSpeed:        0.28,  // м/с, линейная
    minAngularDriftSpeed: 0.65,  // рад/с

    // Палитра «полезных» цветных (5 шт). Красный исключён —
    // конфликт с красными шарами из Этапа 6.
    targetColors: [
      '#4A90E2',  // синий
      '#E28A4A',  // оранжевый
      '#4AE26A',  // зелёный
      '#E2D24A',  // жёлтый
      '#B14AE2',  // фиолетовый
    ],

    // Цвет «мусорных» серых (6 шт).
    trashColor: '#888888',

    // 11 фиксированных позиций спавна.
    // Первые 5 — для цветных (targetColors[0..4] по индексу).
    // Следующие 6 — для серых.
    // Сгенерированы один раз случайно в зоне X[-1.2,1.2] Y[1.5,2.5] Z[-1.2,1.2],
    // мин. дистанция между точками 0.25 м.
    spawnPositions: [
      // --- 5 цветных ---
      { x: -0.83, y: 2.31, z:  0.42 },
      { x:  0.71, y: 1.62, z: -0.95 },
      { x: -0.18, y: 2.07, z:  1.04 },
      { x:  1.05, y: 2.42, z:  0.58 },
      { x: -1.12, y: 1.83, z: -0.61 },
      // --- 6 серых ---
      { x:  0.34, y: 2.18, z:  0.07 },
      { x: -0.47, y: 1.55, z: -1.08 },
      { x:  0.92, y: 1.94, z: -0.24 },
      { x: -0.95, y: 2.45, z:  1.12 },
      { x:  0.12, y: 1.71, z:  0.88 },
      { x:  1.13, y: 2.05, z: -1.05 },
    ],
  },

  // Красные шары — опасность (Этап 6). Слой BALL, float-физика как у кубиков,
  // скорости = floatingCubes × случайный множитель в диапазоне [min, max].
  balls: {
    count: 3,
    radius: 0.04,
    mass: 2.0,
    color: '#E04040',

    // Импульс в куб при ударе (× «полной» скорости шара). Масса шара > куба.
    cubeHitImpulseMultiplier: 2.8,
    cubeHitCooldownMs: 90,
    // Допуск (м) к визуальному касанию для _boostHitCube (ранний contactOffset).
    cubeHitVisualSlack: 0.012,
    cubeHitGhostSlack: 0.008,
    // Ниже этого timeScale — импульс разрешён в ghost-зоне (slo-mo).
    cubeHitSloMoTimeScale: 0.85,
    // Мс — держать курс на куб после ghost-contactbegin (slo-mo дожимает до касания).
    cubeHitPendingMs: 600,
    // Доля скорости шара после удара по кубу (меньше = меньше отскок от башни).
    cubeHitBallRetain: 0.72,

    // Удар битой: окно (мс), в течение которого скорость шара после
    // отбивания удерживается на доударной. Kinematic-бита (взмах) разгоняет
    // шар несколько кадров подряд, одноразового сброса по contactbegin не
    // хватает — солвер перетирает его на следующих шагах. См. red-ball._deflectOffBat.
    batDeflect: { clampMs: 250 },

    // Линейные/угловые скорости = floatingCubes × speedMultiplier (на шар).
    speedMultiplierMin: 2.0,
    speedMultiplierMax: 3.0,

    linearDamping:  0.03,
    angularDamping: 0.05,

    material: {
      restitution:      0.32,
      staticFriction:   0.12,
      dynamicFriction:  0.10,
    },

    // 3 точки в воздухе (зона как у float-кубиков, без пересечения с spawnPositions кубов).
    spawnPositions: [
      { x:  0.55, y: 2.20, z: -0.70 },
      { x: -0.90, y: 1.75, z:  0.55 },
      { x:  0.15, y: 2.35, z:  0.95 },
    ],

    // После удара о стену/пол комнаты — разворот к куполу.
    // steerBounceDelays: сколько отскоков пропустить в текущем цикле (0/1/2), заново после каждого разворота.
    steerOnWallBounce: 1.0,
    steerBounceDelays: [0, 1, 2],
    steerContinuous: 0,

    // Масштаб от r=0.07 (было 0.03). При r=0.04 старый 0.03 давал ~6 см зазора
    // до куба (0.03+0.03) — куб отлетал до визуального касания, особенно в slo-mo.
    contactOffset: 0.017,
    speculativeCCD: true,

    // Хвост в slo-mo: круглый профиль. sizeScale компенсирует меньший шар —
    // абсолютная ширина хвоста ≈ как при radius 0.07 и sizeScale 0.52 (~7.3 см).
    trail: {
      profileVerts: 10,
      sizeScale: 0.91,
      headSizeScale: 0.95,
      tailSizeScale: 0.5,
      headSkipM: 0.02,
      // Длина хвоста — только у шаров (кубики используют slowmoFx.trail).
      loftSectionCount: 14,
      trailSpacingM: 0.045,
      trailLengthM: 0.75,
    },
  },

  // Бита-сковородка для отбивания красных шаров (Этап 6/7).
  bat: {
    mass: 0.85,
    panRadius: 0.11,
    panThickness: 0.018,
    handleLength: 0.18,
    handleWidth: 0.04,
    handleThickness: 0.022,
    panColor: '#5a5a62',
    handleColor: '#6b4423',
    // На столе (topY=1.0), ближе к центру — ручка не упирается в боковину r=0.3.
    spawnPosition: { x: 0.04, y: 1.015, z: 0.05 },
    spawnRotation: { x: 0, y: -35, z: 0 },
    linearDamping:  0.1,
    angularDamping: 0.15,
    material: {
      restitution:      0.55,
      staticFriction:   0.55,
      dynamicFriction:  0.45,
    },
    throwVelocityScale: 1.15,
  },

  // === Купол над пьедесталом (Этап 3) ===
  //
  // Геометрия купола — капсула: цилиндрическая стенка + верхняя полусфера-крышка.
  // Нижняя «крышка» не нужна, её перекрывает пьедестал (R=0.27 < R_пьедестала=0.30).
  //
  // Визуальные координаты (a-cylinder + a-sphere в index.html):
  //   wallBottomY = 1.00  (низ цилиндра, уровень стола)
  //   wallTopY    = 1.30  (верх цилиндра = центр полусферы крышки)
  //   topY        = 1.57  (макушка купола)
  //
  // Физический коллайдер (Шаг 2 v2): набор тонких боксов-плиток,
  // аппроксимирующих поверхность капсулы. Декларативный physx-body на
  // a-cylinder/a-sphere строит convex hull = сплошной выпуклый объём,
  // который выталкивает кубики наружу. Тонкие боксы дают «настоящую» стенку
  // без объёма. Подробности — в js/components/dome-builder.js.
  dome: {
    // --- Базовая геометрия (используется и визуалом, и коллайдером) ---
    radius:         0.27,   // радиус купола, м
    cylinderHeight: 0.30,   // высота цилиндрической части, м
    centerY:        1.15,   // Y центра капсулы

    // Производные координаты (вычислены вручную, чтобы не плодить геттеры):
    cylinderBottomY: 1.00,  // = centerY - cylinderHeight/2
    cylinderTopY:    1.30,  // = centerY + cylinderHeight/2 = центр полусферы крышки

    // --- Визуальный материал (применяется к a-cylinder и a-sphere в index.html) ---
    // Полупрозрачный голубоватый «лабораторный» оттенок.
    // side: double — чтобы стенка была видна и снаружи, и изнутри.
    material: {
      color:       '#88ccff',
      opacity:     0.18,
      transparent: true,
      side:        'double',
      metalness:   0,
      roughness:   0.1,
    },

    // --- Тайловый коллайдер (см. dome-builder.js) ---
    // Поверхность купола аппроксимируется тонкими плоскими боксами-плитками,
    // расположенными касательно к капсуле.
    collider: {
      wallSegments:         24,    // плиток по окружности цилиндрической стенки
      capLatitudeRings:      4,    // широтных колец на крышке (без полюса-макушки)
      capLongitudeSegments: 16,    // плиток в каждом широтном кольце крышки
      shellThickness:     0.01,    // толщина плитки, м.
                                   // Тонко = нет «выталкивания» при пересечении;
                                   // не настолько тонко, чтобы кубик 0.1м проскочил за один шаг.
      tileOverlap:        1.08,    // коэф. расширения плитки по касательным осям
                                   // (для перекрытия стыков соседних плиток).

      // Физ-материал плиток — те же значения, что у пьедестала и стен комнаты,
      // чтобы отскоки кубиков от купола, пола и стен были согласованы.
      // ВАЖНО: collisionLayers/collidesWithLayers здесь НЕ задаются —
      // они дописываются в dome-builder.js на каждой плитке (слой DOME).
      physxMaterial: 'restitution: 0.95; staticFriction: 0.05; dynamicFriction: 0.05',

      // Отладка: показать плитки коллайдера полупрозрачными розовыми боксами.
      // В продакшене — false. На время отладки купола можно включить.
      debugVisible: false,
    },

    // --- Параметры режима 'gravity' (Шаг 4) ---
    // Применяются при release кубика внутри купола.
    // Подобраны «на глаз», уточним по результатам тестов с башней.
    gravityMode: {
      // Низкий damping ≈ свободное падение. Для куба 10 см сопротивление воздуха
      // на коротком падении пренебрежимо; прежние 0.08/0.12 делали падение/
      // опрокидывание «вязким». Затухание в стопке обеспечивают friction + restitution.
      linearDamping:   0.02,
      angularDamping:  0.04,
      // Порог засыпания (удельная кинетическая энергия). Тело спит, только когда
      // практически остановилось. float ставит 0 (никогда не спит).
      // ВАЖНО: было 25 — аномально много (≈ скорость 7 м/с), кубик засыпал прямо
      //   в движении (падение/опрокидывание медленнее) и виснул, игнорируя гравитацию.
      //   Симптомы: башня падала и замирала «как о прозрачное препятствие», кубы
      //   застывали на ребре. Малое значение → сон лишь у реально неподвижной стопки.
      sleepThreshold:  0.01,

      // Клэмп скорости gravity-куба (floating-cube.tick). Гарантированно гасит
      // «резиновый» выброс: даже если депенетрация выкинет куб, скорость
      // обрезается до этих значений. maxDepenetrationVelocity в биндинге нет.
      maxLinearSpeed:  1.8,   // м/с
      maxAngularSpeed: 8.0,   // рад/с
    },

    // Containment при release (Шаг 4, фикс «протолкнули через стенку»):
    // 'lenient' — inside, если хотя бы часть кубика пересекает купол (R + halfCube);
    // 'strict'  — inside, только если центр полностью внутри (R - halfCube).
    releaseContainment: 'lenient',
  },

  /**
   * Индексы слоёв коллизий для биндинга physx-material (@c-frame/physx).
   *
   * Биндинг сам делает (1 << index) под капотом. Никогда не передавай сюда
   * готовую битовую маску — биндинг распарсит её как один индекс и сделает
   * (1 << maska), что для значения ≥31 даёт переполнение int32 и краш
   * "Passing a number ... outside the valid range [0, 4294967295]".
   * История бага — Сессия 9, рефакторинг 3.5.C.
   *
   * Используется ДВУМЯ способами:
   *   1) Через physx-material="collisionLayers: I; collidesWithLayers: I, J, K"
   *      — индексы как есть, через запятую.
   *   2) Внутри physx-grab.js через PxFilterData напрямую — там нужны маски,
   *      делаем (1 << index) >>> 0 вручную.
   *
   * Список (см. CURRENT_TASK.md, Шаг 3.5.C):
   *   WORLD        — статики (пол/стены/потолок/пьедестал). Индекс 0
   *                  совпадает с дефолтом @c-frame/physx (word0=1=1<<0).
   *   DOME         — плитки купола. Сталкивается с FLOAT_CUBE, BALL (не GRAVITY_CUBE).
   *   FLOAT_CUBE   — кубик в режиме невесомости.
   *   GRAVITY_CUBE — кубик в режиме гравитации (Шаг 4).
   *   GRABBED_CUBE — кубик, схваченный рукой.
   *   BALL         — красные шары (Этап 6).
   *   HAND         — сфера коллайдера руки.
   *   BAT          — бита (Этап 7); всегда бьётся о WORLD/пьедestal, не DOME.
   */
  collisionLayers: {
    WORLD:        0,
    DOME:         1,
    FLOAT_CUBE:   2,
    GRAVITY_CUBE: 3,
    GRABBED_CUBE: 4,
    BALL:         5,
    HAND:         6,
    BAT:          7,
  },

  // === Победа (Этап 5) ===
  // stackColors и excludedColor заполняет js/init-session.js при каждой загрузке:
  // shuffle(5 targetColors) → первые 4 = порядок башни снизу вверх, 5-й не нужен.
  victory: {
    stackHeight: 4,
    stackColors: [],       // runtime: init-session.js
    excludedColor: null,   // runtime: init-session.js

    pedestalTopY: 1.0,
    pedestalRadiusXZ: 0.25,

    stackMaxHorizontalOffset: 0.07,
    stackMinVerticalStep:     0.07,
    stackMaxVerticalStep:     0.13,

    maxLinearSpeed:   0.08,
    maxAngularSpeed:  0.6,
    stableDurationMs: 1000,
    checkIntervalMs:  200,

    // Призрачная подсказка на пьедестале (ghost-tower-hint.js).
    ghostTower: {
      opacity: 0.20,
    },

    // Плашка победы (victory-ui.js) — в мире, лицом к игроку (старт z=1).
    ui: {
      worldPosition: { x: 0, y: 1.48, z: 0.28 },
      handPressRadius: 0.22,
      titleText:   'ПОБЕДА',
      hintText:    'Поднеси руку + grip',
      buttonText:  'Заново',
    },
  },
};

// Делаем CONFIG доступным глобально, чтобы любой компонент мог его использовать.
// (Простое решение для проекта без сборщика. Для большого продакшена использовали бы модули.)
window.CONFIG = CONFIG;