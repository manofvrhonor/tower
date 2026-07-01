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
    showColliders: false,
    colliderOpacity: 0.85,
    // Покадровая прозрачность wireframe по слою (fallback — colliderOpacity).
    // DOME: 89 плиток — при общей opacity wireframe закрывает стол/башню.
    layerOpacity: {
      DOME: 0.12,
    },
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
      FLOAT_INSIDE: '#aaddff',  // куб внутри сферы ядра
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
    // null + hdriAuto → случайный файл из assets/hdri/ при каждой перезагрузке
    // строка → только этот файл (отладка)
    hdri: null,
    hdriAuto: true,
    hdriDir: 'assets/hdri/',
    sky: {
      radius: 50,
      position: { x: 0, y: 1.5, z: 0 },
      exposure: 1.0,
      fallback: {
        topColor:    '#0d1525',
        horizonColor: '#5a7088',
        bottomColor: '#1a2230',
      },
    },
    fogDome: {
      radius: 2.0,   // м, верхняя полусфера от пола (Ø 4 м; визуал = collider)
      position: { x: 0, y: 0, z: 0 },
      // Фаза 2.1 — cyan «поле времени»: ленты-разводы + мягкий дым поверх.
      color: '#18b8d8',       // глубокий cyan между лентами
      glowColor: '#66f5ff',   // яркие ленты и fresnel-обод
      coreColor: '#d4feff',   // «горячее» ядро лент (почти белый cyan)
      baseOpacity: 1.0,
      voidOpacity: 0.04,      // прозрачность между лентами (было fogMin)
      streakOpacity: 0.92,    // плотность лент (было fogMax)
      fogContrast: 2.4,       // резкость ridged-слоёв
      fogLift: 0.0,
      noiseScale: 1.1,
      scrollSpeed: 0.28,        // скорость течения лент
      fresnelPower: 2.0,
      fresnelStrength: 0.48,
      swirlArms: 4.0,         // число крупных вихревых «рукавов»
      streakSharpness: 3.8,   // тонкость лент (↑ = тоньше)
      flowWarp: 0.55,         // закручивание потока (domain warp)
      ridgeMix: 0.62,         // доля ridged vs sin-рукава (0..1)
      windowStrength: 0.12,   // «дыры» в слое лент (0 = выкл)
      windowSpeed: 0.22,
      energyTint: 0.72,
      // Мягкий дым поверх лент (старый fbm-вариант, накладывается отдельным слоем).
      fogOverlay: 0.99,       // сила дыма (0 = только ленты, 1 = макс.)
      fogHazeMin: 0.1,       // α дыма в разреженных зонах
      fogHazeMax: 0.9,       // α дыма в плотных «облаках»
      fogHazeLift: 0.18,
      fogHazeContrast: 1.45,
      fogHazeSpeed: 0.14,     // дым плывёт медленнее лент
      fogHazeWindowStrength: 0.38, // окна прозрачности в слое дыма
      widthSegments: 64,
      heightSegments: 32,
      renderOrder: 5,
      floorRadius: 50,      // м, визуальный пол (≈ room.sky.radius; дома ~10 м — хватает)
      spawnMargin: 0.12,
      collider: {
        latitudeRings: 10,
        longitudeSegments: 28,
        shellThickness: 0.02,
        tileOverlap: 1.08,
        debugVisible: false,
      },
    },
    // Фаза 3.1 — схема (вид сверху): серые на (±d,±d), зелёные на осях (±R,0)/(0,±R).
    outsideScenery: {
      clearance: 0.8,
      buildingGap: 0.9,
      position: { x: 0, y: 0, z: 0 },
      renderOrder: 1,
      edges: {
        enabled: true,
        color: '#000000',
        opacity: 1.0,
      },
      textures: {
        enabled: true,
        dir: 'assets/textures/outside-buildings/',
        tint: '#ffffff',
      },
      primaryRing: {
        axisDistance: 7.0,    // d → (±d, ±d); было 14 — диаметр расстановки ÷2
        rotationY: 0,           // грани ‖ осям X/Z
      },
      backgroundRing: {
        axisDistance: 26.0,     // R → (0,±R) и (±R,0); auto не ближе primary+gap
        prototypeStep: 1,
        rotationY: 0,
      },
      primaryPrototypes: [
        {
          id: 'slim-tower',
          width: 6.0, depth: 6.0, height: 25.0,
          textureOnly: true,
          wall: 'slim-tower-wall.jpg',
        },
        {
          id: 'wide-low',
          width: 12.0, depth: 10.0, height: 10.0,
          textureOnly: true,
          wall: 'wide-low-wall.jpg',
        },
        {
          id: 'mid-block',
          width: 9.0, depth: 8.0, height: 17.5,
          textureOnly: true,
          wall: 'mid-block-wall.jpg',
        },
        {
          id: 'narrow-mid',
          width: 7.0, depth: 11.0, height: 15.0,
          textureOnly: true,
          wall: 'narrow-mid-wall.jpg',
        },
      ],
      backgroundPrototypes: [
        {
          id: 'bg-tower',
          width: 30.0, depth: 30.0, height: 22.5,
          color: '#9aa5b5',
          wall: 'bg-tower-wall.jpg',
        },
        {
          id: 'bg-block',
          width: 15.0, depth: 15.0, height: 12.5,
          color: '#a0aab8',
          axisDistanceOffset: -1.0,
          positionOffset: { x: -6, z: 0 },  // -4 м по оси X (вправо)
          wall: 'bg-block-wall.jpg',
        },
        {
          id: 'bg-slim',
          width: 27.0, depth: 27.0, height: 17.5,
          color: '#8898a8',
          axisDistanceOffset: -2.0,  // ближе к центру на 2 м (R 26 → 21)
          wall: 'bg-slim-wall.jpg',
        },
      ],
    },
    // Отскок от room-dome-collider: отражение v' = v − (1+e)(v·n)n (все float-тела).
    wallBounce: {
      restitution:        0.95,
      nearWallRatio:      0.87,
      minApproachRatio:   0.04,   // v·n / |v| — порог «летит в стенку» для tick
      inwardSkipRatio:    0.82,   // уже отлетает от стены — tick не трогает
      minBounceSpeed:     0.20,
    },
  },

  // === Ядро сборки (Фаза 2.x): сфера + орбитальные кольца ===
  assemblyZone: {
    // Центр сферы = центр бывшего PhysX-диска (pedestal disk center).
    hubPosition: { x: 0, y: 0.985, z: 0 },
    radius: 0.30,
    // assembly-core local Y — чтобы слоты остались на y=1.0 (верх бывшего стола).
    assemblyLocalY: 0.015,
    releaseContainment: 'lenient',

    rings: [
      {
        id: 0,
        tiltAxis: 'x', tiltDeg: 62,
        spinAxis: 'y', spinSpeedDeg: 22,
        segments: 72,
      },
      {
        id: 1,
        tiltAxis: 'z', tiltDeg: 58,
        spinAxis: 'x', spinSpeedDeg: -17,
        segments: 72,
      },
    ],
    ringThickness: 0.02,
    ringVisual: {
      color: '#33e0ff',
      emissive: '#22d4f0',
      opacity: 0.92,
    },
    // Призраки слотов assembly-core (контраст с cyan-кольцами и белой сферой).
    slotVisual: {
      color: '#ffe066',
      opacity: 1.0,
      fillOpacity: 0.22,
      renderOrder: 1100,
    },

    collider: {
      latitudeRings: 10,
      longitudeSegments: 16,
      shellThickness: 0.01,
      tileOverlap: 1.08,
      physxMaterial: 'restitution: 0.95; staticFriction: 0.05; dynamicFriction: 0.05',
      debugVisible: false,
    },

    // Белые «электроволны» (шейдер как room-fog-dome, полная сфера).
    visual: {
      color: '#e8eef5',
      glowColor: '#ffffff',
      coreColor: '#ffffff',
      baseOpacity: 0.85,
      voidOpacity: 0.06,
      streakOpacity: 0.88,
      fogContrast: 2.2,
      scrollSpeed: 0.32,
      fresnelPower: 2.0,
      fresnelStrength: 0.55,
      fogOverlay: 0.55,
      widthSegments: 48,
      heightSegments: 32,
      renderOrder: 12,
    },
  },

  // === Парящий стол (legacy config; коллайдер заменён orbit-rings) ===
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

    // Порог slo-mo-сессии для ударов в руке (см. time-scale.isWorldSlowMo).
    worldSlowMoThreshold: 0.5,
    recentMinWindowMs: 600,

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

    // Float: после N отскоков от стен комнаты — разворот скорости к куполу (как red-ball).
    // Новый цикл с новым N после каждого разворота.
    steerTowardDome: {
      bounceDelayMin: 2,
      bounceDelayMax: 5,
    },

    // Палитра цветных (6 шт — для башни 5 + 1 excluded при shuffle).
    // В мире спавнятся только coloredCubeCount штук. Красный исключён.
    coloredCubeCount: 5,
    targetColors: [
      '#4A90E2',  // синий
      '#E28A4A',  // оранжевый
      '#4AE26A',  // зелёный
      '#E2D24A',  // жёлтый
      '#B14AE2',  // фиолетовый
      '#2EC4B6',  // бирюзовый (6-й — для сложного режима, башня 5)
    ],

    // Цвет «мусорных» серых (6 шт).
    trashColor: '#888888',

  // 11 позиций внутри room.fogDome (R=2.0, margin 0.12 + half куба 0.05; clamp при спавне).
    spawnPositions: [
      { x: -0.83, y: 2.00, z:  0.42 },
      { x:  0.71, y: 1.62, z: -0.95 },
      { x: -0.18, y: 2.00, z:  0.85 },
      { x:  0.85, y: 2.00, z:  0.45 },
      { x: -1.00, y: 1.83, z: -0.61 },
      { x:  0.34, y: 2.05, z:  0.07 },
      { x: -0.47, y: 1.55, z: -1.08 },
      { x:  0.92, y: 1.94, z: -0.24 },
      { x: -0.75, y: 2.05, z:  0.65 },
      { x:  0.12, y: 1.71, z:  0.88 },
      { x:  0.95, y: 1.95, z: -0.85 },
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
    // Порог slo-mo для удлинённого pending (шар медленнее доезжает до меша).
    cubeHitSloMoTimeScale: 0.85,
    cubeHitPendingMs: 600,
    cubeHitPendingSloMoMsMax: 2400,
    // Доля скорости шара после удара по кубу (меньше = меньше отскок от башни).
    cubeHitBallRetain: 0.72,

    // Удар битой: окно (мс), в течение которого скорость шара после
    // отбивания удерживается на доударной. Kinematic-бита (взмах) разгоняет
    // шар несколько кадров подряд, одноразового сброса по contactbegin не
    // хватает — солвер перетирает его на следующих шагах. См. red-ball._deflectOffBat.
    // realtimeSpeedBoost — множитель доударной скорости при отбивании в полном
    // времени (slo-mo: только перенаправление, без разгона).
    batDeflect: {
      clampMs: 250,
      realtimeSpeedBoost: 1.60,
      realtimeSwingRetain: 0.45,
      realtimeSpeedMax: 2.8,
    },

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

    spawnPositions: [
      { x:  0.55, y: 2.10, z: -0.70 },
      { x: -0.90, y: 1.75, z:  0.55 },
      { x:  0.15, y: 2.05, z:  0.75 },
      { x: -0.28, y: 2.08, z: -0.82 },
      { x:  0.78, y: 1.90, z:  0.30 },
    ],

    // Этап 6 — «атомы времени» (волны угроз, вариант D).
    // Шары спавнятся ЗА туманом (R > fogDome.radius), летят к сборке на столе под
    // разными углами атаки (сверху/сбоку), пролетают сквозь туман. Отбили битой/кубом
    // → улетают наружу и деспавнятся, вместо них спавнится новый в другом месте.
    // Пока флаг enabled=false: блок только описан, его никто не читает (поведение
    // шаров прежнее). Включим вместе с ball-wave-manager.js (микро-шаг 2).
    waves: {
      enabled: true,

      // Одновременно активных шаров. Фактическое N в матче берётся из
      // CONFIG.game.difficulties[*].ballCount; это значение — fallback.
      maxActive: 3,

      // Точка-цель: сборка на столе. tableSurfaceY=1.0; целимся чуть выше — в зону
      // слотов механизма (≈ как старый homing к y=1.15).
      targetY: 1.15,
      // Случайный разброс точки прицеливания вокруг цели (м, по всем осям).
      targetJitter: 0.12,

      // Спавн на сфере радиуса spawnRadius вокруг точки-цели (> fogDome.radius=2.0,
      // т.е. снаружи тумана). Угол места (elevation) ограничен снизу, чтобы шары
      // приходили сверху/сбоку, а не из-под пола.
      spawnRadius: 3.2,
      spawnPitchMinDeg: 8,    // нижняя граница над горизонтом точки-цели
      spawnPitchMaxDeg: 78,   // верхняя граница (почти сверху)

      // Конус разброса начального направления полёта (полуугол, градусы) — чтобы
      // траектории не были строго в одну точку.
      coneSpread: 16,

      // Скорость подлёта к столу (м/с, до умножения на timeScale).
      incomingSpeed: 1.4,

      // Деспавн: за этим радиусом от центра комнаты шар (улетевший/отбитый) удаляется.
      // Должен быть ≥ spawnRadius, чтобы отбитый шар успел уйти наружу.
      despawnRadius: 3.6,

      // Задержка перед спавном замены после деспавна (мс).
      respawnDelayMs: 600,
    },

    // После удара о стену/пол комнаты — разворот к куполу.
    // steerBounceDelays: сколько отскоков пропустить в текущем цикле (0/1/2), заново после каждого разворота.
    steerOnWallBounce: 1.0,
    steerBounceDelays: [0, 1, 2],
    steerContinuous: 0,

    // Пол комнаты: tick-разворот к башне (стенка комнаты — CONFIG.room.wallBounce).
    floorEscape: {
      enabled:       true,
      maxY:          0.22,
      minHorizDist:  0.45,
      minHorizSpeed: 0.12,
      cooldownMs:    800,
      upBias:        0.35,
    },

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

  // Удары кубом/битой в захвате (сессия 28).
  // Slo-mo: dynamic-жертва (куб/бита) — только перенаправление, как шар.
  inHandStrike: {
    sloMoDeflectClampMs: 250,
    worldSlowMoThreshold: 0.5,
    recentMinWindowMs: 600,
  },

  // Бита-сковородка (Этап 7). Float вне купола, gravity внутри — как кубы.
  bat: {
    mass: 0.85,
    panRadius: 0.11,
    panThickness: 0.018,
    handleLength: 0.18,
    handleWidth: 0.04,
    handleThickness: 0.022,
    panColor: '#5a5a62',
    handleColor: '#6b4423',
    // Старт: парит между полом (y=0) и столом (y=1.0).
    spawnPosition: { x: -0.55, y: 0.55, z: 0.15 },
    spawnRotation: { x: 15, y: 40, z: 0 },
    containmentRadius: 0.22,
    linearDamping:  0.1,
    angularDamping: 0.15,
    material: {
      restitution:      0.55,
      staticFriction:   0.55,
      dynamicFriction:  0.45,
    },
    throwVelocityScale: 1.15,
    float: {
      initialImpulseSpeed:  0.12,
      initialAngularSpeed:  0.35,
      minDriftSpeed:        0.1,
      minAngularDriftSpeed: 0.3,
      linearDamping:        0.03,
      angularDamping:       0.05,
      floorReturnSpeed:     0.18,
    },
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
      // gravity-кубики на столе следуют timeScale (ADR-12 v2); руки/захват — realtime.
      useTimeScale: true,
      sceneGravityY: -9.8,
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

  // === Машина времени: детали, локации, механизмы, маршруты (Фаза 0) ===
  //
  // ВАЖНО: на этом шаге структуры НЕ подключены к рантайму — это контракт данных
  // для будущих фаз (снеп-сборка, локации). Текущие значения — лишь НАЧАЛЬНОЕ
  // наполнение (3 локации); движок не должен предполагать ровно 3.
  //
  // Связи держим согласованными вручную:
  //   part.id           ←→ mechanisms[*].slots[].acceptPartId   (деталь → слот)
  //   part.mechanism    ←→ mechanisms[<id>]                      (деталь → механизм)
  //   part.homeLocation ←→ locations[].id                        (где деталь спавнится)
  //   progression.edges[].requiresMechanism / unlocksLocation    (граф маршрутов)
  //
  // model: null → примитив-заглушка (бокс/цилиндр с cyan-материалом);
  //        строка → путь к GLB в assets/models/ (подставим, когда будет арт).

  // Допуски снепа детали в слот и сила «слома» сборки при попадании опасного объекта.
  assembly: {
    snapPosTolerance:    0.05,  // м — насколько близко к слоту, чтобы деталь снепнулась
    snapRotToleranceDeg:  35,   // ° — допуск по ориентации при снепе
    breakImpulse:        1.5,   // м/с — импульс разлёта детали при сломе сборки
  },

  // Локации-комнаты. Массив произвольной длины. start: true — стартовая комната.
  // partIds — какие детали спавнятся здесь изначально (источник истины — part.homeLocation;
  // дублируем для удобства спавнера). fogTint — оттенок поля времени/тумана этой эпохи.
  // hazardLevel — базовый уровень угрозы (число опасных объектов масштабируется в Фазе 5).
  locations: [
    {
      id: 'future', label: 'Будущее', start: true,
      hdri: null, fogTint: '#33e0ff', hazardLevel: 1,
      partIds: ['fa_core', 'fa_coil', 'pa_future_gear', 'junk_f1', 'junk_f2'],
    },
    {
      id: 'past', label: 'Прошлое',
      hdri: null, fogTint: '#ffb066', hazardLevel: 2,
      partIds: ['pa_past_rod', 'pa_past_plate', 'fin_past_lens', 'junk_p1', 'junk_p2'],
    },
    {
      id: 'present', label: 'Настоящее',
      hdri: null, fogTint: '#66ff99', hazardLevel: 3,
      partIds: ['fin_pres_frame', 'fin_pres_crystal', 'junk_n1', 'junk_n2'],
    },
  ],

  // Детали. kind: 'mechanism' — важные (снепятся в слоты), 'junk' — мусор (помехи).
  // Деталь можно унести в другую локацию (механика переноса — Фаза 4).
  parts: [
    // — будущее —
    { id: 'fa_core',        kind: 'mechanism', model: null, homeLocation: 'future',  mechanism: 'pastActivation',    slot: 'pa_s1' },
    { id: 'fa_coil',        kind: 'mechanism', model: null, homeLocation: 'future',  mechanism: 'pastActivation',    slot: 'pa_s2' },
    { id: 'pa_future_gear', kind: 'mechanism', model: null, homeLocation: 'future',  mechanism: 'presentActivation', slot: 'pr_s1' },
    { id: 'junk_f1',        kind: 'junk',      model: null, homeLocation: 'future',  mechanism: null,                slot: null  },
    { id: 'junk_f2',        kind: 'junk',      model: null, homeLocation: 'future',  mechanism: null,                slot: null  },
    // — прошлое —
    { id: 'pa_past_rod',    kind: 'mechanism', model: null, homeLocation: 'past',    mechanism: 'presentActivation', slot: 'pr_s2' },
    { id: 'pa_past_plate',  kind: 'mechanism', model: null, homeLocation: 'past',    mechanism: 'presentActivation', slot: 'pr_s3' },
    { id: 'fin_past_lens',  kind: 'mechanism', model: null, homeLocation: 'past',    mechanism: 'final',             slot: 'fin_s1' },
    { id: 'junk_p1',        kind: 'junk',      model: null, homeLocation: 'past',    mechanism: null,                slot: null  },
    { id: 'junk_p2',        kind: 'junk',      model: null, homeLocation: 'past',    mechanism: null,                slot: null  },
    // — настоящее —
    { id: 'fin_pres_frame',   kind: 'mechanism', model: null, homeLocation: 'present', mechanism: 'final', slot: 'fin_s2' },
    { id: 'fin_pres_crystal', kind: 'mechanism', model: null, homeLocation: 'present', mechanism: 'final', slot: 'fin_s3' },
    { id: 'junk_n1',          kind: 'junk',      model: null, homeLocation: 'present', mechanism: null,    slot: null  },
    { id: 'junk_n2',          kind: 'junk',      model: null, homeLocation: 'present', mechanism: null,    slot: null  },
  ],

  // Механизмы. requiredPartIds — что нужно собрать; slots — позы относительно
  // верха ядра (position/rotation локальны к ядру; rotation в градусах).
  // Детали одного механизма могут жить в РАЗНЫХ локациях → нужно переносить вещи.
  mechanisms: {
    pastActivation: {
      id: 'pastActivation',
      requiredPartIds: ['fa_core', 'fa_coil'],
      slots: [
        { id: 'pa_s1', acceptPartId: 'fa_core', position: { x: 0,    y: 0.06, z: 0 }, rotation: { x: 0, y: 0,  z: 0 } },
        { id: 'pa_s2', acceptPartId: 'fa_coil', position: { x: 0.08, y: 0.06, z: 0 }, rotation: { x: 0, y: 90, z: 0 } },
      ],
    },
    presentActivation: {
      id: 'presentActivation',
      requiredPartIds: ['pa_future_gear', 'pa_past_rod', 'pa_past_plate'],
      slots: [
        { id: 'pr_s1', acceptPartId: 'pa_future_gear', position: { x: -0.08, y: 0.06, z: 0    }, rotation: { x: 0, y: 0, z: 0 } },
        { id: 'pr_s2', acceptPartId: 'pa_past_rod',     position: { x: 0,     y: 0.14, z: 0    }, rotation: { x: 0, y: 0, z: 0 } },
        { id: 'pr_s3', acceptPartId: 'pa_past_plate',   position: { x: 0,     y: 0.06, z: 0.08 }, rotation: { x: 0, y: 0, z: 0 } },
      ],
    },
    final: {
      id: 'final',
      requiredPartIds: ['fin_past_lens', 'fin_pres_frame', 'fin_pres_crystal'],
      slots: [
        { id: 'fin_s1', acceptPartId: 'fin_past_lens',    position: { x: 0,     y: 0.22, z: 0    }, rotation: { x: 0, y: 0, z: 0 } },
        { id: 'fin_s2', acceptPartId: 'fin_pres_frame',   position: { x: 0.08,  y: 0.14, z: 0.08 }, rotation: { x: 0, y: 0, z: 0 } },
        { id: 'fin_s3', acceptPartId: 'fin_pres_crystal', position: { x: -0.08, y: 0.14, z: 0.08 }, rotation: { x: 0, y: 0, z: 0 } },
      ],
    },
  },

  // Граф маршрутов: какой собранный механизм какую локацию открывает.
  // Стартовая локация — та, у которой start: true. Добавление уровня = дополнить
  // locations + parts + mechanisms + edges, БЕЗ правок кода движка.
  progression: {
    edges: [
      { requiresMechanism: 'pastActivation',    unlocksLocation: 'past' },
      { requiresMechanism: 'presentActivation', unlocksLocation: 'present' },
    ],
    finalMechanism: 'final',  // собран в 'present' → запуск машины = победа
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
   *   BAT          — бита (Этап 7); всегда бьётся o WORLD/кольца, не DOME.
   *   FLOAT_INSIDE — куб внутри сферы ядра: float без g, проходит сквozь DOME.
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
    // Шары волны (Этап 6 «атомы времени»). Отдельный слой, которого НЕТ ни в одной
    // маске WORLD-коллайдеров (купол/пол/пьедестал) — при «ИЛИ»-фильтре @c-frame/physx
    // это полностью отключает столкновение со стенами комнаты (шар летит сквозь туман).
    // С кубами/битой сталкивается через свою маску (collidesWithLayers ниже, в менеджере).
    WAVE_BALL:    8,
    FLOAT_INSIDE: 9,
  },

  // === Меню и режимы сложности (сессия 29) ===
  game: {
    defaultDifficulty: 'normal',
    difficulties: {
      easy:   { label: 'Easy',     ballCount: 1, stackHeight: 3 },
      normal: { label: 'Normal',   ballCount: 3, stackHeight: 4 },
      hard:   { label: 'Hard',     ballCount: 5, stackHeight: 5 },
      hardcore: {
        label: 'Hardcore',
        ballCount: 5,
        stackHeight: 5,
        rotateAssemblyWithRing: 0,
      },
    },
    // Общие отступы VR-плашек (game-menu, victory-ui) — menu-ui-layout.js.
    menuLayout: {
      paddingTop:    0.06,
      paddingBottom: 0.06,
      paddingH:      0.05,
      rowGap:        0.04,
      colGap:        0.03,
      titleGap:      0.05,
      hoverPad:      0.04,
      minPanelWidth: 0,
    },
    menu: {
      worldPosition: { x: 0, y: 1.55, z: -0.65 },
      handPressRadius: 0.18,
      startText: 'Start',
      wireframeOnText: 'Wireframe: ON',
      wireframeOffText: 'Wireframe: OFF',
      // Широкое меню: contentWidth задаёт ширину строк; кнопки — один fontSize.
      layout: {
        contentWidth: 1.45,
        btnHeight:    0.165,
        btnFontSize:  60,
        wireframeBtn: { width: 0.55 },
      },
    },
    // Палитра VR-меню: cyan + чёрный + белый (game-menu, victory-ui).
    menuTheme: {
      panel:         '#0a1018',
      title:         '#ffffff',
      titleAccent:   '#66f5ff',
      btnBg:         '#0c1820',
      btnHover:      '#143040',
      btnNear:       '#1e5068',
      btnSelected:   '#1488a8',
      btnAccent:     '#33e0ff',
      btnAccentHover:'#66f5ff',
      btnAccentNear: '#b8ffff',
      border:        '#33e0ff',
      borderDim:     '#1a5070',
      text:          '#ffffff',
      textOnAccent:  '#061018',
    },
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
    // Декоративный wireframe — не связан с debug.showColliders.
    ghostTower: {
      lineOpacity: 1.0,
    },

    // Плашка победы (victory-ui.js). Позиция = game.menu.worldPosition (общая с меню старта).
    ui: {
      handPressRadius: 0.18,
      titleText:   'VICTORY',
      restartText: 'Restart',
      menuText:    'Main Menu',
      layout: {
        contentWidth: 1.45,
        btnHeight:    0.165,
        btnFontSize:  60,
        title:        { height: 0.12, fontSize: 72 },
      },
    },
  },
};

// Делаем CONFIG доступным глобально, чтобы любой компонент мог его использовать.
// (Простое решение для проекта без сборщика. Для большого продакшена использовали бы модули.)
window.CONFIG = CONFIG;