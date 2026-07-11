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
      BALL:         '#33e0ff',  // шар-угроза (cyan)
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
    // === HDR / небо (Фаза 3.3) — world-hdri-sky.js ===
    // Конвенция: assets/hdri/{id локации}.* → если нет, assets/hdri/base.* (hdriBase).
    // room.hdri — прямой путь, только отладка. hdriAuto: true — random из папки (dev).
    // manifest.json — список файлов (без перебора 404). refresh-hdri-manifest.ps1 после добавления HDR.
    hdri: null,
    hdriAuto: false,
    hdriDir: 'assets/hdri/',
    hdriBase: 'base',
    hdriExtensions: ['.hdr', '.jpg', '.jpeg', '.png'],
    sky: {
      radius: 50,
      position: { x: 0, y: 1.5, z: 0 },
      exposure: 0.88,
      // Холодный тон неба под cyan-купол (fogDome.color #18b8d8); умножает текстуру HDR.
      tint: '#7a90a8',
      fallback: {
        topColor:    '#0a1220',
        horizonColor: '#3d5a72',
        bottomColor: '#1a2838',
      },
    },
    // renderOrder: scenery 1 < floorFog 2 < gameplay 4 < fogDome 5 < sphere 12
    gameplayRenderOrder: 4,
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
      floorRadius: 50,
      floorTexture: 'assets/textures/floor/asphalt.jpg',
      floorMetersPerRepeat: 2.0,
      // spawnMargin — только спавн/clamp (дальше от стенки, меньше взрывов).
      // containmentMargin — tick-отскок room-containment (близко к PhysX-плиткам).
      spawnMargin: 0.12,
      containmentMargin: 0.01,
      collider: {
        latitudeRings: 10,
        longitudeSegments: 28,
        shellThickness: 0.02,
        tileOverlap: 1.08,
        debugVisible: false,
      },
    },
    // Фаза 3.2 — низкий туман у пола снаружи cyan-купола (room-floor-fog.js).
    floorFog: {
      enabled: true,
      innerRadius: 2.0,
      outerRadius: 30,
      height: 0.6,
      autoLayers: true,
      useTimeScale: true,
      layerCount: 20,
      layerSpread: 0.08,
      verticalBias: 0.02,
      verticalFalloffPower: 2.4,
      position: { x: 0, y: 0, z: 0 },
      color: '#ffffff',
      glowColor: '#f8f8f8',
      opacity: 1.0,
      baseOpacity: 0.52,
      peakOpacity: 1.0,
      noiseScale: 0.28,
      puffScale: 0.09,
      scrollSpeed: 0.0028125,
      edgeSoftness: 4.5,
      billowAmplitude: 0.21,
      billowSpeed: 0.003125,
      thetaSegments: 72,
      radialSegments: 10,
      renderOrder: 4,
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
      // Геометрия домов (общая). Текстуры стен — locations[].scenery.*Walls.
      primaryPrototypes: [
        { id: 'slim-tower', width: 6.0, depth: 6.0, height: 25.0, textureOnly: true },
        { id: 'wide-low', width: 12.0, depth: 10.0, height: 10.0, textureOnly: true },
        { id: 'mid-block', width: 9.0, depth: 8.0, height: 17.5, textureOnly: true },
        { id: 'narrow-mid', width: 7.0, depth: 11.0, height: 15.0, textureOnly: true },
      ],
      backgroundPrototypes: [
        {
          id: 'bg-tower', width: 30.0, depth: 30.0, height: 22.5,
          color: '#9aa5b5',
        },
        {
          id: 'bg-block', width: 15.0, depth: 15.0, height: 12.5,
          color: '#a0aab8', axisDistanceOffset: -1.0,
          positionOffset: { x: -6, z: 0 },
        },
        {
          id: 'bg-slim', width: 27.0, depth: 27.0, height: 17.5,
          color: '#8898a8', axisDistanceOffset: -2.0,
        },
      ],
    },
    // Отскок от room-dome-collider: отражение v' = v − (1+e)(v·n)n (все float-тела).
    wallBounce: {
      restitution:        0.95,
      nearWallRatio:      0.98,   // tick-отскок близко к maxR (было 0.87 — рано)
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
    // Визуальные состояния GLB-детали (3.5B.3, part-entity + part-snap-energy).
    partVisual: {
      energy: {
        color: '#18b8d8',
        glowColor: '#66f5ff',
        coreColor: '#e8ffff',
        noiseScale: 9.0,
        scrollSpeed: 3.2,
        streakSharpness: 4.8,
        flowWarp: 0.5,
        intensity: 1.15,
        surfaceContrast: 2.6,
        windowStrength: 0.4,
        windowSpeed: 2.4,
        energyTint: 0.82,
        fresnelStrength: 0.55,
        boltCount: 6,
        boltStepsMin: 5,
        boltStepsMax: 12,
        boltLifeMin: 0.07,
        boltLifeMax: 0.26,
      },
      floating: {
        opacity: 1.0,
      },
      snapped: {
        opacity: 1.0,
        energyIntensity: 0.95,
      },
      snapped_active: {
        opacity: 1.0,
        energyIntensity: 1.25,
        pulseSpeed: 3.0,
        pulseAmp: 0.42,
      },
      broken: {
        opacity: 0.92,
        energyColor: '#ff3355',
        energyGlow: '#ff6644',
        energyCore: '#ffaa88',
        energyIntensity: 1.0,
        durationMs: 450,
      },
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
    // Якорь магнита на кулаке (local #leftHand / #rightHand). Калибровка — Quest QA.
    hands: {
      left: {
        // Quest #leftHand local: X=вбок, Y=вперёд (−), Z=вверх (+). Калибровка — Quest QA.
        magnet: { position: { x: 0, y: -0.08, z: -0.01 }, rotation: { x: 0, y: 0, z: 0 } },
      },
      right: {
        magnet: { position: { x: 0, y: -0.08, z: -0.01 }, rotation: { x: 0, y: 0, z: 0 } },
      },
      // Якорь grab = #*HandCollider (colliderLocal); snap + VFX на collider. redAbove — только visual offset.
      grab: {
        colliderLocal: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
        },
        attachAxis: { x: 0, y: -1, z: 0 },
      },
      // Compound collider кулака (hand-body-collider.js). a-box: width=X, height=Y (− вперёд), depth=Z.
      // Калибровка под GLB — Quest QA + debug.showColliders.
      // rotation запекается в position/size (hand-body-collider._bakePart). Оси: X=вбок, Y=вперёд (−), Z=вверх.
      bodyCollider: {
        parts: [
          {
            position: { x: 0, y: -0.02, z: 0 },
            rotation: { x: 180, y: 90, z: 0 },
            size: { x: 0.09, y: 0.08, z: 0.06 },
          },
          {
            position: { x: 0, y: -0.07, z: 0.012 },
            rotation: { x: 180, y: 90, z: 0 },
            size: { x: 0.08, y: 0.07, z: 0.05 },
          },
        ],
      },
      magnetVfx: {
        sparkCount: 5,
        sparkSeparation: 0.04,
        color: '#ff3333',
        coreColor: '#ff6644',
        sparkRadius: 0.004,
        orbitRadius: 0.014,
        pulseSpeed: 10,
        redAbove: {
          offsetZ: 0.03,
          color: '#55eeff',
          coreColor: '#e8ffff',
        },
      },
    },
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

  // Спавн: clamp по радиусу GLB *_COL (collider-bounds-cache.js).
  spawn: {
    colliderRadiusPad: 0.02,
    fallbackRadius: 0.05,
    // Задержка стартового импульса — PhysX успевает развести пересечения COL.
    impulseDelayMs: 200,
    // Мин. зазор между центрами при спавне (м).
    separationGap: 0.06,
    // Запас к радиусу _COL для clamp/разведения (convex ≥ bbox).
    radiusSafetyMult: 1.1,
    // Fallback, если в difficulties нет junkPerLocation / decoyPerLocation.
    junkPerLocation: 4,
    decoyPerLocation: 3,
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

    // Fallback-кубы для junk, если в assets/models/junk/ не хватает GLB.
    trashColor: '#888888',
    junkCubeColors: [
      '#555555', '#626262', '#6e6e6e', '#7a7a7a', '#868686',
      '#929292', '#666666', '#737373', '#808080', '#8c8c8c',
      '#5c5c5c', '#707070',
    ],

  // 11 позиций внутри room.fogDome (R=2.0, spawnMargin 0.12 + half; clamp при спавне).
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
      { x: -0.55, y: 1.88, z: -0.35 },
      { x:  0.48, y: 1.78, z:  0.62 },
      { x: -0.90, y: 1.70, z:  0.15 },
      { x:  0.22, y: 1.92, z: -0.72 },
      { x: -0.30, y: 1.65, z:  0.95 },
      { x:  0.78, y: 2.00, z: -0.55 },
    ],
  },

  // Красные шары — опасность (Этап 6). Слой BALL, float-физика как у кубиков,
  // скорости = floatingCubes × случайный множитель в диапазоне [min, max].
  balls: {
    count: 3,
    radius: 0.04,
    mass: 2.0,
    // Яркий cyan «атом времени» (Фаза 5).
    color: '#33e0ff',
    emissive: '#66f5ff',
    emissiveIntensity: 1.35,

    // Wave fade: scale+opacity по дистанции снаружи купола (м полёта).
    // Появление: набор за inDistance к куполу.
    // Исчезновение: старт на outStartDistance от поверхности купола,
    // спад за outDistance дальше наружу.
    fade: {
      inDistance: 1.0,
      outStartDistance: 3.0,
      outDistance: 2.0,
    },

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

    // Фаза 5: угроза по эпохе (location.hazardLevel).
    // Число шаров = ballCount (сложность) + countBonus; скорость × speedScale.
    hazardByLevel: {
      1: { countBonus: 0, speedScale: 1.0 },
      2: { countBonus: 1, speedScale: 1.2 },
      3: { countBonus: 2, speedScale: 1.4 },
    },

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

      // Спавн на сфере радиуса spawnRadius вокруг центра комнаты (> fogDome.radius=2.0,
      // т.е. снаружи тумана). Угол места (elevation) ограничен снизу, чтобы шары
      // приходили сверху/сбоку, а не из-под пола.
      spawnRadius: 6.5,
      spawnPitchMinDeg: 8,    // нижняя граница над горизонтом точки-цели
      spawnPitchMaxDeg: 78,   // верхняя граница (почти сверху)

      // Конус разброса начального направления полёта (полуугол, градусы) — чтобы
      // траектории не были строго в одну точку.
      coneSpread: 16,

      // Скорость подлёта к столу (м/с, до умножения на timeScale).
      incomingSpeed: 1.4,

      // Деспавн: ≥ fogDome.radius + fade.outStartDistance + fade.outDistance.
      despawnRadius: 7.0,

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

  // Удары рукой / grip-объектом по деталям и мусору (как batDeflect у шаров).
  // Направление — от солвера; скорость — доударная (без разгона от kinematic-взмаха).
  // clampMs — окно удержания в tick (рука/grip докручивают несколько кадров).
  inHandStrike: {
    clampMs: 250,
    worldSlowMoThreshold: 0.5,
    recentMinWindowMs: 600,
  },

  // Бита-сковородка (Этап 7). Float вне купола, gravity внутри — как кубы.
  // enabled:false — не спавнить (код ball-bat / spawn-ball-bat остаётся).
  bat: {
    enabled: false,
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
  // model: null → куб-заглушка; строка → vis GLB в assets/models/.
  // colliderModel: null → нет; строка → low-poly _COL.glb (PhysX convex, wireframe ON).

  // Допуски снепа детали в слот и сила «слома» сборки при попадании опасного объекта.
  assembly: {
    snapPosTolerance:    0.05,  // м — насколько близко к слоту, чтобы деталь снепнулась
    snapRotToleranceDeg:  35,   // ° — допуск по ориентации при снепе
    breakImpulse:        1.5,   // м/с — импульс разлёта детали при сломе сборки
  },

  // Снеп-цепочка A→B→C→D→E из папок assets/models/machine/{attach,box,core,drum,end}
  // + мусор из junk/. manifest.json — scripts/refresh-machine-manifest.ps1.
  machine: {
    basePath: 'assets/models/machine/',
    junkPath: 'assets/models/junk/',
    manifestUrl: 'assets/models/machine-manifest.json',
    // Fallback если fetch manifest не удался (синхронизировать скриптом).
    // Ключи = папки стадий сборки A..E + junk.
    manifest: {
      attach: ['attach_43.glb', 'attach_6.glb', 'retardation_helix_conduit.glb'],
      box:    ['box_11.glb', 'box_13.glb', 'box_33.glb'],
      core:   ['core_51.glb', 'core_63.glb', 'phase_splitter_trident.glb'],
      drum:   ['hold_8.glb', 'hold_12.glb', 'phase_modulator_ring.glb'],
      end:    ['tip_2.glb', 'tip_10.glb', 'tip_30.glb'],
      junk:   [
        '01 junk.glb', '02 junk.glb', '03 junk.glb', '04 junk.glb',
        '05 junk.glb', '06 junk.glb', '07 junk.glb', '08 junk.glb',
        'pulse_capacitor_bank.glb',
      ],
    },

    // Снеп-цепочка вдоль локальной оси ring_inner. Детали крепятся
    // последовательно (A→B→C→D→E) с фиксированным шагом — собранное
    // получается вытянутым устройством. Позы подгоняются на глаз на ПК.
    //   axis         — локальная ось ring_inner, вдоль которой растёт цепочка.
    //   step         — грубое расстояние между соседними стадиями, м.
    //   originOffset — сдвиг всей цепочки от центра ring_inner (симметрия), м.
    //   stages[i]    — база = originOffset + i*step по axis;
    //                  position {x,y,z} — точный сдвиг стадии (м, локально ring_inner);
    //                  rotation, role — опц.
    assemblyChain: {
      axis: 'z',
      step: 0.12,
      originOffset: -0.24,
      stages: [
        { id: 'A', folder: 'attach', rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
        { id: 'B', folder: 'box',    rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
        { id: 'C', folder: 'core',   role: 'core', rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: -0.03 } },
        { id: 'D', folder: 'drum',   rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: -0.13 } },
        { id: 'E', folder: 'end',    rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: -0.14 } },
      ],
    },

    // GLB-машина: корневые модели (грузит machine-rig.js).
    rig: {
      machineModel:      'assets/models/machine/machine.glb',
      machineCollider:   'assets/models/machine/machine_COL.glb',
      ringModel:         'assets/models/machine/ring.glb',
      ringInnerModel:    'assets/models/machine/ring_inner.glb',
      // Сегмент-коллайдеры (machine-ring-collider.js). Подогнать radius под GLB + showColliders.
      ringSegments: {
        radius: 0.34,
        thickness: 0.025,
        bandWidth: 0.04,
        segments: 72,
        overlap: 1.08,
      },
      ringInnerSegments: {
        radius: 0.30,
        thickness: 0.02,
        bandWidth: 0.035,
        segments: 64,
        overlap: 1.08,
      },
      // ring крутится вокруг своей центральной оси.
      ringSpinAxis:     'x',
      ringSpinDeg:      -18,
      // ring_inner: ось и знак направления выбираются случайно per session
      // (machine-rig). ringInnerSpinDeg — базовая скорость; hardcore множит
      // на difficulties.hardcore.ringInnerSpinMult.
      ringInnerSpinDeg:    30,
      ringInnerRandomAxis: true,
    },

    coreSpinSpeedDeg: 96,
    // Ось вращения core (стадия C): 'x','y','z' — локальная ось детали.
    // GLB-поворот запекается при загрузке (_bakeRootTransform).
    coreSpinAxis: 'z',
    coreSpinByFile: {},
  },

  // Runtime: rollAssemblySession() в init-session.js (не править вручную).
  session: null,

  // Локации-эпохи (Фаза 4, ADR-25). start: true — стартовая эпоха.
  // stageIds — какие стадии assemblyChain собираются здесь (квота снепа).
  // partsToComplete — порог travel-ready (= stageIds.length). unlocks — следующая эпоха.
  // sceneryHeightMult — множитель высоты домов (outside-scenery).
  // scenery.primaryWalls / backgroundWalls — JPG в assets/textures/outside-buildings/.
  // fogTint — зарезервировано; купол/туман пока без смены по эпохе.
  // Небо: assets/hdri/{id}.* или base.*. Старые partIds — в parts[] (не рантайм v1).
  locations: [
    {
      id: 'present', label: 'Настоящее', start: true,
      fogTint: '#66ff99', hazardLevel: 1,
      sceneryHeightMult: 1,
      scenery: {
        primaryWalls: [
          'present-slim-tower-wall.jpg',
          'present-wide-low-wall.jpg',
          'present-mid-block-wall.jpg',
          'present-narrow-mid-wall.jpg',
        ],
        backgroundWalls: [
          'present-bg-tower-wall.jpg',
          'present-bg-block-wall.jpg',
          'present-bg-slim-wall.jpg',
        ],
      },
      stageIds: ['A', 'B'],
      partsToComplete: 2,
      unlocks: 'past',
    },
    {
      id: 'past', label: 'Прошлое',
      fogTint: '#ffb066', hazardLevel: 2,
      sceneryHeightMult: 0.4,
      scenery: {
        primaryWalls: [
          'past-slim-tower-wall.jpg',
          'past-wide-low-wall.jpg',
          'past-mid-block-wall.jpg',
          'past-narrow-mid-wall.jpg',
        ],
        backgroundWalls: [
          'past-bg-tower-wall.jpg',
          'past-bg-block-wall.jpg',
          'past-bg-slim-wall.jpg',
        ],
      },
      stageIds: ['C', 'D'],
      partsToComplete: 2,
      unlocks: 'future',
    },
    {
      id: 'future', label: 'Будущее',
      fogTint: '#33e0ff', hazardLevel: 3,
      sceneryHeightMult: 2.5,
      scenery: {
        primaryWalls: [
          'future-slim-tower-wall.jpg',
          'future-wide-low-wall.jpg',
          'future-mid-block-wall.jpg',
          'future-narrow-mid-wall.jpg',
        ],
        backgroundWalls: [
          'future-bg-tower-wall.jpg',
          'future-bg-block-wall.jpg',
          'future-bg-slim-wall.jpg',
        ],
      },
      stageIds: ['E'],
      partsToComplete: 1,
      unlocks: null,
    },
  ],

  // Детали. kind: 'mechanism' — важные (снепятся в слоты), 'junk' — мусор (помехи).
  // Деталь можно унести в другую локацию (механика переноса — Фаза 4).
  parts: [
    // — будущее —
    { id: 'fa_core',        kind: 'mechanism', model: 'assets/models/machine/core/phase_splitter_trident.glb',      colliderModel: 'assets/models/machine/core/phase_splitter_trident_COL.glb',      homeLocation: 'future',  mechanism: 'pastActivation',    slot: 'pa_s1' },
    { id: 'fa_coil',        kind: 'mechanism', model: 'assets/models/machine/sides/phase_modulator_ring.glb',      colliderModel: 'assets/models/machine/sides/phase_modulator_ring_COL.glb',      homeLocation: 'future',  mechanism: 'pastActivation',    slot: 'pa_s2' },
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

  // Маршрут эпох (Фаза 4). Источник истины v1 — locations[].stageIds + unlocks.
  // route — линейный порядок для UI. Legacy edges/mechanisms — не в рантайм v1.
  progression: {
    route: ['present', 'past', 'future'],
    victoryLocation: 'future',
    edges: [
      { requiresMechanism: 'pastActivation',    unlocksLocation: 'past' },
      { requiresMechanism: 'presentActivation', unlocksLocation: 'present' },
    ],
    finalMechanism: 'final',
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

  // === Comic-слайды (единый плеер comic-slides.js) ===
  // ВАЖНО: slideDurationMs — ОДНО место для времени смены ВСЕХ слайдов.
  // Папки: 01.png, 02.png… подряд; сколько файлов по порядку — столько и показываем.
  comic: {
    slideDurationMs: 8000,
    panelWidth: 2.40,
    panelHeight: 1.60,
    maxSlidesPerFolder: 20,
    // Смещение панели на камере (boot/start поверх чёрного veil).
    cameraZ: -0.65,
    cameraY: 0,
    // Start comic после кнопки Start (comic-slides, sequence start).
    // preamble sparks → карточка из пояса → hold+sway → улёт вдаль → следующая.
    startAnim: {
      sparksMs: 2000,
      flyInMs: 1000,
      holdMs: 7000,
      flyOutMs: 900,
      startScale: 0.08,
      arcRotZ: -18,
      arcRotY: 12,
      spinTurns: 0.35,
      waistY: 0.95,
      flyOutDist: 2.4,
      flyOutScale: 0.04,
      swayRotX: 2.5,
      swayRotY: 3.5,
      swayRotZ: 2,
      swayPosX: 0.008,
      swayPosY: 0.006,
    },
    // Boot-интро до меню (boot-intro.js). Таймлайн суммарно ~9 с.
    // 0–2 dark → 2–7 sparks → bg → sphere → logo+sway → hold → menu.
    // Без flash / darkOut — сразу в меню (искры остаются).
    boot: {
      folder: 'assets/ui/comic/boot/logo/',
      bgFile: 'logo_bg.png',
      logoFile: '01.png',
      darkMs: 2000,
      sparksFadeMs: 5000,
      bgFlyMs: 2000,
      sphereChargeMs: 1000,
      logoScaleMs: 1000,
      holdMs: 4000,
      panelWidth: 2.40,
      panelHeight: 1.60,
      logoWidth: 1.35,
      logoHeight: 1.35,
      // Орб = плоскость размера панели; круг вписан в высоту (не вылезает за комикс).
      sphereRadius: 0.80,
      sphereZ: 0.03,
      // Орб: mesh всегда = панель; растёт радиус в UV (0 → circleRadius*orbScale).
      // Пока R≤1 — полный круг; R>1 — обрезается краем картинки.
      sphereStartScale: 0,
      sphereOrbScale: 1.15,
      sphereAppearEarlyMs: 1000,
      logoZ: 0.04,
      // Комикс: из центра, scale + дуга + обороты вокруг Z + лёгкий Z-влет.
      bgStartScale: 0.08,
      bgStartZ: 0.35,
      bgArcRotZ: -22,
      bgArcRotY: 14,
      bgSpinTurns: 1,
      // Задние комиксы (слева/справа, 70%, торчат половинки).
      bgBackFile: 'logo_bg_back.png',
      bgBackFile2: 'logo_bg_back2.png',
      bgBackScale: 0.84,
      bgBackZ: -0.06,
      // Старт на 1 м дальше основного по Z; к концу — разъезд + лёгкий угол (L выше, R ниже).
      bgBackStartZExtra: 1.0,
      bgBackEndYL: 0.18,
      bgBackEndYR: -0.18,
      bgBackEndRotXL: -8,
      bgBackEndRotXR: 8,
      bgBackEndRotYL: 12,
      bgBackEndRotYR: -12,
      bgBackEndRotZL: 6,
      bgBackEndRotZR: -6,
      // Старт ребром (90°), небольшой проворот к финальному углу.
      bgBackStartRotYL: 90,
      bgBackStartRotYR: -90,
      // Задержка влёта относительно основного.
      bgBackDelayLMs: 500,
      bgBackDelayRMs: 1000,
      bgBackSwayRotX: 4.5,
      bgBackSwayRotY: 6,
      bgBackSwayRotZ: 3.5,
      bgBackSwayPosX: 0.014,
      bgBackSwayPosY: 0.02,
      // Медленный дрейф после прилёта: L вверх, R вниз (м/с, потолок).
      bgBackDriftSpeed: 0.035,
      bgBackDriftMax: 0.16,
      // Плавный вход в качку после прилёта (мс) — без рывка.
      bgBackSwayFadeMs: 700,
      // Тихое покачивание комикса после/к концу влёта (градусы / метры).
      bgSwayRotX: 2.5,
      bgSwayRotY: 3.5,
      bgSwayRotZ: 2,
      bgSwayPosX: 0.008,
      bgSwayPosY: 0.006,
      // Покачивание лого после влёта (градусы / метры).
      logoSwayRotX: 7,
      logoSwayRotY: 10,
      logoSwayRotZ: 5,
      logoSwayPosX: 0.012,
      logoSwayPosY: 0.01,
      /**
       * Материал boot-energy-sphere (только boot-intro).
       *
       * Слои шейдера:
       * - color / glowColor / coreColor — база лент, свечение, ядро/вспышки
       * - baseOpacity — общий множитель прозрачности
       * - voidOpacity — «пустые» зоны между лентами (ниже = контрастнее)
       * - bandOpacity — непрозрачность плазменных лент
       * - coreGlow — сила мягкого ядра (fbm)
       * - noiseScale — масштаб шума по сфере
       * - scrollSpeed — скорость течения узора
       * - bandArms — число «рук»/лент по окружности
       * - bandSharpness — острота лент (выше = тоньше/резче)
       * - bandContrast — контраст ridged-шума лент
       * - flowWarp — искажение потока (турбулентность)
       * - fresnelPower / fresnelStrength — светящийся обод
       * - rimSoft — ширина размытия обода (выше = мягче край)
       * - edgeFade — насколько гасится жёсткий силуэт (0..1)
       * - maskSoft — мягкая обрезка по рамке комикса (метры)
       * - maskCropY / maskCropX — резать сверху-снизу / по бокам
       * - sparkleStrength / sparkleScale — редкие вспышки в шейдере
       * - energyTint — насколько glow вмешивается в цвет лент
       * Пульс яркости/скорости дополнительно крутит boot-intro через
       * setIntensity / setPulseDrive (не эти поля).
       */
      sphere: {
        color: '#0ec8e8',
        glowColor: '#9effff',
        coreColor: '#ffffff',
        baseOpacity: 0.88,
        voidOpacity: 0.10,
        bandOpacity: 0.82,
        coreGlow: 1.55,
        // Крупнее шум + сильнее warp → меньше «сетки», больше плазмы.
        noiseScale: 2.2,
        scrollSpeed: 0.9,
        bandArms: 2.2,
        bandSharpness: 1.25,
        bandContrast: 1.35,
        flowWarp: 1.45,
        fresnelPower: 2.2,
        fresnelStrength: 1.15,
        rimSoft: 0.62,
        edgeFade: 0.72,
        // Круг в UV: 1 = касается верха/низа. Финал = circleRadius * sphereOrbScale.
        circleRadius: 0.98,
        maskSoft: 0.08,
        maskCropY: true,
        maskCropX: true,
        sparkleStrength: 0.28,
        sparkleScale: 14.0,
        energyTint: 0.88,
        widthSegments: 48,
        heightSegments: 32,
        renderOrder: 56,
      },
    },
    sequences: {
      // files[] — явный список (без 404-проб). Можно дописать 04.png и т.д.
      // bootLogo/bootStory — не автостарт; boot-intro использует folder/bg/logo напрямую.
      bootLogo: {
        folder: 'assets/ui/comic/boot/logo/',
        files: ['01.png'],
      },
      bootStory: {
        folder: 'assets/ui/comic/boot/story/',
        files: ['01.png', '02.png', '03.png'],
      },
      start: {
        folder: 'assets/ui/comic/start/',
        files: ['01.png', '02.png', '03.png', '04.png', '05.png', '06.png', '07.png'],
        animated: true,
      },
      travelPresentPast: {
        folder: 'assets/ui/comic/travel/present_to_past/',
        files: ['01.png'],
      },
      travelPastFuture: {
        folder: 'assets/ui/comic/travel/past_to_future/',
        files: ['01.png'],
      },
      travelReadyFirst: {
        folder: 'assets/ui/comic/travel/ready_first/',
        files: ['01.png'],
      },
      travelReadyRebuilt: {
        folder: 'assets/ui/comic/travel/ready_rebuilt/',
        files: ['01.png'],
      },
      victory: {
        folder: 'assets/ui/comic/victory/',
        files: ['01.png'],
      },
    },
    travelRoutes: {
      'present>past': 'travelPresentPast',
      'past>future':  'travelPastFuture',
    },
  },

  // === Меню и режимы сложности (сессия 29) ===
  game: {
    defaultDifficulty: 'medium',
    // Порядок карусели меню (game-menu.js).
    difficultyOrder: ['easy', 'normal', 'medium', 'hard', 'hardcore'],
    // Фаза 4: во всех режимах пустая машина (preAssembled: []).
    // junkPerLocation / decoyPerLocation — на КАЖДУЮ эпоху (не сумма на игру).
    // Hardcore: ringInnerSpinMult.
    difficulties: {
      easy:     { label: 'Easy',     ballCount: 1, preAssembled: [], junkPerLocation: 4, decoyPerLocation: 3 },
      normal:   { label: 'Normal',   ballCount: 2, preAssembled: [], junkPerLocation: 6, decoyPerLocation: 4 },
      medium:   { label: 'Medium',   ballCount: 3, preAssembled: [], junkPerLocation: 6, decoyPerLocation: 4 },
      hard:     { label: 'Hard',     ballCount: 4, preAssembled: [], junkPerLocation: 8, decoyPerLocation: 5 },
      hardcore: {
        label: 'Hardcore',
        ballCount: 5,
        preAssembled: [],
        junkPerLocation: 8,
        decoyPerLocation: 5,
        ringInnerSpinMult: 2.2,
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
      handPressRadiusCard: 0.42,
      startText: 'Start',
      wireframeOnText: 'Wireframe: ON',
      wireframeOffText: 'Wireframe: OFF',
      // PNG для нового меню (карусель + старт + wireframe). Папка: assets/ui/menu/
      // Формат: PNG sRGB, альфа. Цвета: см. menuTheme (cyan #33e0ff, серый карточек ~#6a6a6a).
      assets: {
        basePath: 'assets/ui/menu/',
        cards: {
          easy:     'card_easy.png',      // 666×998 px (портрет, вертикально в VR)
          normal:   'card_normal.png',    // 666×998 px
          medium:   'card_medium.png',    // 666×998 px
          hard:     'card_hard.png',      // 666×998 px
          hardcore: 'card_hardcore.png',  // 666×998 px
        },
        cardPixelSize:   { w: 666, h: 998 },
        cardSafeMargin:  47,   // отступ от края под срезанные углы (chamfer ~31 px)
        startIdle:       'btn_start_idle.png',   // 1024×288 px, серая
        startHover:      'btn_start_hover.png',  // 1024×288 px, cyan + glow
        startPixelSize:  { w: 1024, h: 288 },
        gearOff:         'icon_gear_off.png',    // 256×256 px, серая, прозрачный фон
        gearOn:          'icon_gear_on.png',     // 256×256 px, cyan контур, прозрачный фон
        gearPixelSize:   { w: 256, h: 256 },
        restartOff:      'icon_restart_off.png', // 256×256, перезапуск boot-intro
        restartOn:       'icon_restart_on.png',
        sparkParticle:   'spark_particle.png',   // 128×128 px, мягкое cyan-пятно (опционально)
      },
      // Карусель / кнопки (метры, локально от game-menu root).
      carousel: {
        cardWidth:   0.39,     // +30% от 0.30 м (ширина PNG в VR)
        cardRotationZ: 0,      // вертикально (портрет 666×998)
        cardSpacing: 0.31,     // ближнее кольцо (offset 1), под вертикальные карточки
        farSpacingStep: 0.215, // offset 2: cardSpacing + step
        carouselY:   0.14,
        sideScale:   0.78,     // ближние (offset 1)
        sideScaleFar: 0.50,    // дальние (offset 2) — ~36% меньше ближних
        sideZ:       0.06,
        maxVisibleOffset: 2,   // 2+2 карточки вокруг центра (wrap)
        // Клик/наведение только по центру и ближним (offset ≤ clickableMaxOffset).
        clickableMaxOffset: 1,
        // Затемнение боковых (арт серый → множитель цвета, opacity всегда 1).
        centerColor: '#ffffff',
        dimNear:     0.60,     // offset 1 (соседние)
        dimFar:      0.10,     // offset 2 (крайние) — в 2× темнее (было 0.20)
        hoverCyan:   '#66f5ff',
        // Неоновая cyan-рамка по контуру центральной карточки (тонкая линия + мягкий ореол).
        frameColor:     '#33e0ff',
        frameThickness: 0.006,  // тонкая чёткая линия, метры
        frameGlow:      0.075,  // мягкий ореол вокруг линии, метры
        frameChamfer:   0.045,  // срез углов, метры
        framePad:       0.016,  // отступ рамки от края карточки, метры
        pulseSpeed:     3.2,
        // Бегущий по контуру рамки огонёк (canvas, тонкий штрих).
        runnerColor:  '#e8feff',
        runnerLength: 0.11,      // длина огонька, метры
        runnerWidth:  0.013,     // толщина ядра, метры
        runnerGlow:   0.038,     // ореол вокруг огонька, метры
        runnerSpeed:  1.34,      // м/с по периметру (×2 от 0.67)
        runnerFlashDurationMs:    1000,
        runnerFlashIntervalMinMs: 4000,
        runnerFlashIntervalMaxMs: 6000,
      },
      startBtn: {
        width: 0.633,   // −⅓ от 0.95
        height: 0.178,  // −⅓ от 0.267
        y: -0.32,
      },
      gearBtn: {
        size: 0.11,
        y: -0.58,
        x: 0.09,   // справа от пары; restart слева
      },
      restartBootBtn: {
        size: 0.11,
        y: -0.58,
        x: -0.09,
      },
      veil: {
        hideIds: [
          'world-sky', 'room-fog-dome', 'outside-scenery', 'room-floor-fog',
          'assembly-hub', 'ghost-tower-hint',
        ],
        radius: 48,
      },
      backdropVfx: {
        sparkCount: 70,
        // Искры привязаны к МИРУ и кружат вокруг игрока (не за взглядом).
        shellRadiusMin: 1.8,   // ближе к игроку
        shellRadiusMax: 5.5,   // дальний край облака
        yMin: -1.4,            // относительно уровня глаз игрока
        yMax: 3.0,
        orbitSpeed: 0.12,      // рад/с вокруг игрока (± случайно)
        bobAmp: 0.25,          // вертикальное покачивание, м
        sparkSize: 0.05,       // размер спрайта (мир, м)
        color: '#33e0ff',
        coreColor: '#66f5ff',
        explodeDurationMs: 900,
        explodeSpeed: 3.2,
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

  // === Победа — все слоты assembly-core заняты (victory-check.js) ===
  victory: {
    freezeWorldOnVictory: true,
    stableDurationMs: 1000,
    checkIntervalMs:  200,

    // Плашка победы (victory-ui.js). Позиция = game.menu.worldPosition (общая с меню старта).
    // ВАЖНО: метры плоскости = пропорции PNG (иначе растяжение).
    ui: {
      handPressRadius: 0.18,
      titleText:   'VICTORY',
      restartText: 'Restart',
      menuText:    'Main Menu',
      layout: {
        // panel 1536×1024 → 3:2; кнопки PNG 400×90.
        panelWidth:   1.20,
        panelHeight:  0.80,   // 1.20 * 1024/1536
        btnWidth:     0.40,
        btnHeight:    0.09,   // 0.40 * 90/400
        btnGap:       0.025,
        // Отступ от низа панели (~20 px при 1024 px высоты → +0.016 м к 0.04).
        btnBottomPad: 0.056,
      },
      // PNG: assets/ui/end/ (заготовки → заменить финальным артом).
      assets: {
        basePath: 'assets/ui/end/',
        panelVictory: 'panel_victory.png',   // 1536×1024
        panelDefeat:  'panel_defeat.png',    // 1536×1024
        restartIdle:  'btn_restart_idle.png',  // 400×90 (VR 0.40×0.09)
        restartHover: 'btn_restart_hover.png',
        menuIdle:     'btn_menu_idle.png',     // 400×90
        menuHover:    'btn_menu_hover.png',
      },
    },
  },

  // === Поражение — таймер петли = 0 (loop-timer → defeat; та же плашка, что victory) ===
  defeat: {
    ui: {
      titleText: 'DEFEAT',
    },
  },

  // === Инвентарь запястья (Фаза 4, wrist-inventory.js на #leftHand) ===
  wristInventory: {
    slotCount: 2,
    // Радиус/высота цилиндра-кармана. store — деталь внутри (dist <= pocketRadius).
    pocketRadius: 0.038,
    pocketHeight: 0.055,
    // Дальность лучей-притяжения (только удерживаемая деталь).
    rayRadius: 0.16,
    retrieveRadius: 0.12,
    storedScale: 0.45,
    storedOpacity: 0.42,
    // Белые разряды как у assembly-sphere-visual / купола.
    pocketVisual: {
      shape: 'cylinder',
      height: 0.055,
      color: '#e8eef5',
      glowColor: '#ffffff',
      coreColor: '#ffffff',
      baseOpacity: 0.82,
      voidOpacity: 0.04,
      streakOpacity: 0.95,
      fogContrast: 2.4,
      noiseScale: 1.35,
      scrollSpeed: 0.42,
      streakSharpness: 4.2,
      fresnelStrength: 0.62,
      fogOverlay: 0.45,
      widthSegments: 24,
      heightSegments: 12,
      renderOrder: 8,
    },
    // Голубое мерцание занятого кармана (только если внутри есть деталь).
    occupiedVisual: {
      color: '#18b8d8',
      glowColor: '#66f5ff',
      coreColor: '#d4feff',
    },
    // Голубые разряды на детали внутри кармана.
    storedEnergy: {
      color: '#18b8d8',
      glowColor: '#66f5ff',
      coreColor: '#d4feff',
      energyIntensity: 0.88,
      energyTint: 0.9,
      boltCount: 5,
    },
    slotVisual: {
      intensityIdle: 0.92,
      intensityNear: 1.0,
      intensityInside: 1.08,
      intensityOccupied: 0.88,
      intensityRetrieve: 1.05,
      occupiedPulseSpeed: 0.007,
      occupiedPulseAmp: 0.22,
      rayColor: '#f0f8ff',
      rayOpacity: 0.48,
      rayCount: 12,
    },
    // Local #leftHand: X=вбок, Y=вперёд (−), Z=вверх. Калибровка — Quest QA.
    slots: [
      { position: { x: 0.0, y: 0.2, z: -0.01 } },
      { position: { x: 0.0, y: 0.13, z: -0.01 } },
    ],
  },

  // === Пульт прыжка на #rightHand (wrist-travel-remote.js) ===
  // Открывает travel-меню в любой момент игры (выход / wireframe), не только после travel-ready.
  wristTravelRemote: {
    // Local #rightHand — как второй карман на #leftHand (slots[1]).
    // Открытие — левая рука у пульта (не правая у своего запястья).
    position: { x: 0.0, y: 0.13, z: 0.01 },
    pressRadius: 0.09,
    idleIntensity: 0.55,
    activeIntensity: 0.95,
    nearIntensity: 1.08,
    pulseOnUnlockMs: 2500,
    visual: {
      shape: 'cylinder',
      radius: 0.032,
      height: 0.045,
      color: '#ffb866',
      glowColor: '#ff9933',
      coreColor: '#fff0d0',
      baseOpacity: 0.88,
      voidOpacity: 0.05,
      streakOpacity: 0.92,
      fogContrast: 2.3,
      noiseScale: 1.2,
      scrollSpeed: 0.38,
      streakSharpness: 4.0,
      fresnelStrength: 0.58,
      fogOverlay: 0.48,
      widthSegments: 24,
      heightSegments: 12,
      renderOrder: 8,
    },
  },

  // === Таймер петли на #rightHand (Фаза 5, loop-timer.js) ===
  // Один на весь забег: game-started → тик × timeScale → 0 = defeat. Travel не сбрасывает.
  loopTimer: {
    durationSec: 180,
    // Local #rightHand — рядом с пультом (wristTravelRemote.position ≈ y:0.13).
    position: { x: 0.0, y: 0.15, z: 0.01 },
    // Кольцо: дуга remaining/duration; центр — canvas M:SS:CC (сотые в 2× мельче).
    radius: 0.028,
    tube: 0.004,
    ringColor: '#33e0ff',
    ringEmptyColor: '#0a3040',
    textColor: '#66f5ff',
    textBgColor: 'rgba(6, 16, 24, 0.55)',
    textPlaneSize: 0.04,
    fontSize: 42,
    warnBelowSec: 30,
    warnBlinkHz: 2,
  },

  // === Прыжок между эпохами (Фаза 4+, travel-ui / wrist-travel-remote) ===
  travel: {
    // Auto-меню при квоте: 1 туториал + 1 после поломки; дальше только пульт.
    autoMenuEnabled: true,
    autoMenuMaxPerLocation: 2,
    // Forced slo-mo пока открыто travel-меню (не victory-freeze).
    menuSlowMoScale: 0.12,
    ringSpinBoostMult: 5,
    ringInnerSpinBoostMult: 5,
    // veil + искры при выборе эпохи (travel-ui → menu-world-veil / menu-backdrop-vfx).
    transition: {
      coverDurationMs: 450,
      sparkDurationMs: 2500,
      revealDurationMs: 1500,
      orbitCenterId: 'assembly-hub',
      orbitSpeed: 3.5,
      orbitSpeedSpread: 0.35,
      hubShellRadiusMin: 1.0,
      hubShellRadiusMax: 2.8,
      hubYMin: -0.55,
      hubYMax: 1.15,
      hubBobAmp: 0.08,
    },

    // travel-ui.js — то же меню с пульта и после auto.
    // Comic travel-ready / jump — CONFIG.comic + comic-slides.js.
    // Размер панели = victory/defeat (1536×1024 → 1.20×0.80 м).
    ui: {
      handPressRadius: 0.18,
      hereMarkerText: 'вы тут',
      // Порядок на линии слева → направо: прошлое → настоящее → будущее.
      timelineOrder: ['past', 'present', 'future'],
      layout: {
        // ×2 в VR относительно прежнего 1.20×0.80 (удобнее на Quest).
        panelWidth:   2.40,
        panelHeight:  1.60,
        // Эпохи/закрыть 300×90 PNG → в мире ×2.
        btnWidth:     0.4688,  // 300 px ×2
        btnHeight:    0.1406,  // 90 px ×2
        btnGap:       0.08,
        btnBottomPad: 0.16,
        closeWidth:   0.4688,
        eraRowY:      0.0,
        // marker_here 202×374 ×2
        markerWidth:  0.3156,
        markerHeight: 0.5844,
        markerGap:    0.020,
        lineHeight:   0,
        iconSize:     0.150,
        iconSidePad:  0.1908,
        // Confirm ×2
        confirmWidth:  1.40,
        confirmHeight: 0.58,
        confirmBtnW:   0.50,
        confirmBtnH:   0.150,
        confirmBtnGap: 0.10,
        confirmBtnY:  -0.12,
      },
      assets: {
        basePath: 'assets/ui/travel/',
        panel: 'panel_travel.png',           // 1536×1024
        // Текст эпохи в самом PNG — код не рисует поверх.
        loc: {
          past: {
            idle: 'btn_past_idle.png',
            hover: 'btn_past_hover.png',
            disabled: 'btn_past_disabled.png',
            current: 'btn_past_current.png',
          },
          present: {
            idle: 'btn_present_idle.png',
            hover: 'btn_present_hover.png',
            disabled: 'btn_present_disabled.png',
            current: 'btn_present_current.png',
          },
          future: {
            idle: 'btn_future_idle.png',
            hover: 'btn_future_hover.png',
            disabled: 'btn_future_disabled.png',
            current: 'btn_future_current.png',
          },
        },
        closeIdle: 'btn_close_idle.png',     // 400×90 «Закрыть»
        closeHover: 'btn_close_hover.png',
        hereMarker: 'marker_here.png',       // 400×50 «вы тут»
        homeOff: 'icon_home_off.png',        // 256×256, выход в меню
        homeOn:  'icon_home_on.png',
        gearOff: 'icon_gear_off.png',        // как в game-menu
        gearOn:  'icon_gear_on.png',
        confirmPanel: 'panel_confirm_exit.png',
        confirmYesIdle:  'btn_confirm_yes_idle.png',
        confirmYesHover: 'btn_confirm_yes_hover.png',
        confirmNoIdle:   'btn_confirm_no_idle.png',
        confirmNoHover:  'btn_confirm_no_hover.png',
      },
    },
  },
};

// Делаем CONFIG доступным глобально, чтобы любой компонент мог его использовать.
// (Простое решение для проекта без сборщика. Для большого продакшена использовали бы модули.)
window.CONFIG = CONFIG;