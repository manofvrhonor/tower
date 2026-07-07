# PROJECT LOG — TOWER OF TIME

> **Полный справочник ADR.** Не прикладывать при старте — используй `PROJECT_START.md` (индекс ADR + DECISIONS LOCK).
> История сессий — `PROJECT_LOG_ARCHIVE.md`. Текущая задача — `CURRENT_TASK.md`.

---

## ГЛАВНАЯ ЦЕЛЬ (кратко)

VR **Tower of Time** для Quest 3 (WebXR). Белая комната 3×3×3 м, стол с куполом.
Плавающие кубики (цветные + серые) → сборка башни. Красные шары — опасность.
Замедление времени (SUPERHOT): `timeScale` 0.05↔1.0 для скриптового движения;
физика рук и стола — реальное время. MVP: друг проходит за 2–5 мин без инструкций. **Меню входа + режимы сложности** — в scope (с.29).

**Не-цели:** уровни/кампания, сохранения прогресса, AAA-графика, мультиплеер.

---

## СТЕК

| Компонент | Версия / путь |
|---|---|
| A-Frame | 1.7.1, `vendor/` |
| PhysX | `@c-frame/physx@v0.3.0`, явный `wasmUrl` |
| Захват | локальный `js/components/physx-grab.js` (из examples/grab.js) |
| Руки | `hand-controls` + GLB в `assets/models/`, kinematic sphere r=0.05 |
| Код | HTML + `<script>`, `js/config.js`, без сборщиков/TS/npm |

**Отменено (не возвращать):** Cannon, `super-hands`, A-Frame 1.5.0, авто-деплой Netlify.

---

## ADR — АРХИТЕКТУРНЫЕ РЕШЕНИЯ

Формат: **Решение → Причина → Не делать**.

---

### ADR-01: PhysX + physx-grab вместо Cannon / super-hands

**Решение:** `@c-frame/physx@v0.3.0` + локальный `physx-grab`. A-Frame 1.7.1.
`<a-scene physx>`: `autoLoad`, `delay: 1000`, `useDefaultScene: false`, явный `wasmUrl`.

**Причина:** Cannon несовместим с Three r125+; super-hands не регистрируется в A-Frame 1.7.

**Не делать:** миграция на другой движок без явного запроса.

---

### ADR-02: PhysX-WASM API (@c-frame/physx@0.3.0)

Прямой доступ из компонентов — только по этим правилам:

1. Биндинг: `sceneEl.systems.physx.PhysX` (глобального `PhysX` нет).
2. Энумы (`PxActorFlag`, …) — объекты-обёртки, не числа. Число **молча игнорируется**.
3. `rigidBody` — **поллинг** ~100 ms; события `body-loaded` ненадёжны.
4. Векторы — plain `{x, y, z}`. Класса `PxVec3` **нет** (`new PX.PxVec3` падает).
5. Сон: `setSleepThreshold(0)` недостаточно → `wakeUp()` в `tick` для float-тел.
6. Потери энергии в контакте — баг/особенность биндинга; restitution=1.0 не спасает.
7. Смена типа тела на лету `el.setAttribute('physx-body', 'type: kinematic'|'dynamic')`
   **не пересоздаёт actor** — ссылка `rigidBody` стабильна (перепол­линг не нужен).
   Kinematic-тело держит позу из `object3D` entity каждый кадр (двигать — менять
   `object3D`, не `setGlobalPose`). `PX.PxTransform` **конструктора нет** (как и `PxVec3`),
   `setGlobalPose`/`setKinematicTarget` есть, но без конструктора transform не зовём.
   `PX.PxRigidBodyFlag.eKINEMATIC` — обёртка `{value:1}`. Проверено диагностикой (с.32).
   **Защёлка `setKinematic` (с.33):** биндинг ставит `eKINEMATIC` в `tock()` ОДИН раз
   через `if (type==='kinematic' && !this.setKinematic){…; this.setKinematic=true}`
   (physics.js ~1257) и назад НЕ сбрасывает. `update()` при `type:dynamic` снимает флаг,
   но защёлку не трогает. Поэтому ПОВТОРНЫЙ `dynamic→kinematic` без ручного сброса
   `bodyComp.setKinematic=false` оставляет тело dynamic (визуал расходится с физ-телом:
   объекты проходят насквозь, тело не схватить). Лечение — сбрасывать защёлку при
   возврате в dynamic (`floating-cube._resetKinematicLatch`).

**Не делать:** угадывать API по C++ доке; передавать числа вместо enum-обёрток;
повторно переключать `dynamic↔kinematic` без сброса защёлки `setKinematic`.

---

### ADR-03: Захват через Fixed joint, тело остаётся dynamic

**Решение:** `physx-grab`: `gripdown` → `contactbegin` → `physx-joint type: Fixed`;
`gripup` → joint удаляется, тело dynamic.

**Причина:** можно ставить кубик на кубик и реалистично бросать.

**Не делать:** переводить схваченное тело в kinematic без веской причины.

---

### ADR-04: Float-кубики — дрейф и материалы

**Решение:** gravity off (`eDISABLE_GRAVITY`), damping, стартовые linear + angular velocity,
`wakeUp()` каждый кадр. Restitution стен/пола **выше**, чем у кубика (0.95 vs 0.9).
11 кубиков: 5 цветных + 6 серых; красный цвет зарезервирован под шары (Этап 6).

**Причина:** без wakeUp + angular velocity кубики замирают; один restitution на кубике
не компенсирует потери энергии в биндинге (ADR-02 п.6).

**Не делать:** полагаться только на `setSleepThreshold(0)` или restitution=1.0.

---

### ADR-05: Купол — 89 static-плиток, не цилиндр/полусфера

**Решение:** визуал — `a-cylinder` + `a-sphere` (без физики). Коллайдер — 89 мелких
static box-плиток (`dome-builder.js`), плотно без щелей.

**Причина:** PhysX/A-Frame на open-ended cylinder и theta-sphere строит дырявые shapes;
кубики прошивали стенки.

**Не делать:** один static collider на цилиндр/сферу «для простоты».

---

### ADR-06: Прозрачность купола — collision layers, не eSIMULATION_SHAPE

**Решение:** точечная фильтрация через `CONFIG.collisionLayers` + `physx-material`
(`collisionLayers` / `collidesWithLayers`). При grab — смена слоя на `GRABBED_CUBE`.

**Причина:** снятие `eSIMULATION_SHAPE` с кубика отключало **все** коллизии — нельзя
отбивать другие кубики, проход сквозь стол/пол.

**Не делать:** фантомизацию всего shape'а ради «пройти сквозь купол».

---

### ADR-07: Реестр collision layers (индексы 0..8)

**Решение:** `CONFIG.collisionLayers` хранит **индексы**, не битовые маски.
Биндинг в `physx-material` принимает CSV индексов и сам делает `1 << index`.
В `physx-grab.js` (PxFilterData напрямую) — маски вручную: `(1 << i) >>> 0`.

| Слой | Idx | Назначение | Ключевые коллизии |
|---|---|---|---|
| WORLD | 0 | пол, стены, пьедестал | дефолт physx (word0=1) |
| DOME | 1 | 89 плиток | FLOAT_CUBE — **не** GRAVITY_CUBE, **не** BALL (сессия 18) |
| FLOAT_CUBE | 2 | state float | WORLD, DOME, кубики, BALL, BAT |
| GRAVITY_CUBE | 3 | state gravity | WORLD, кубики, BALL, BAT — **не DOME** |
| GRABBED_CUBE | 4 | **куб** в руке | WORLD, кубики, BALL — **не DOME** |
| BALL | 5 | красные шары (Этап 6) | WORLD, кубики, BAT — **не DOME** |
| HAND | 6 | сфера руки | кубики, BALL, BAT |
| BAT | 7 | бита (сессия 25) | WORLD, кубики, BALL — **не DOME** |
| WAVE_BALL | 8 | шары волны «атомы времени» (с.35) | кубики, BAT — **не** WORLD-купол комнаты; пол/пьедestal — **да** (WAVE_BALL в их масках) |

**Отключённые пары (осознанно):** `GRABBED_CUBE × DOME`, `GRAVITY_CUBE × DOME`, `BALL × DOME`.
Боковина пьедestala: **без** `GRABBED_CUBE`; **с** `BAT`.

**Причина:** передача готовой маски 63 в атрибут → биндинг делал `1 << 63` → краш
`-2147483648` (int32 overflow).

**Не делать:** битовые маски в строке `physx-material`; `(1 << i)` без `>>> 0`.
**Не делать:** биту на `GRABBED_CUBE` — слой `BAT`.

**Потребители:** `dome-builder.js`, `spawn-floating-cubes.js`, `spawn-ball-bat.js`,
`ball-bat.js`, `pedestal-builder.js`, `physx-grab.js`.

---

### ADR-08: Float vs gravity — материалы и release

**Решение:**
- `floatMaterial` — упругий дрейф; `gravityMaterial` — дерево (restitution 0.15, friction 0.7).
- Стол/пол — `CONFIG.pedestal.physxMaterial` / `world.woodMaterial`.
- Release: `floating-cube.onGrabReleased()` ← `physx-grab`; containment → `gravity` или `float`.
- `CONFIG.dome.releaseContainment: 'lenient'` — release при частичном проносе через стенку.

**Containment (капсула купола):**
- lenient (release): центр до `R + halfCube`.
- strict: центр до `R - halfCube`.
- Y в `[wallBottomY, wallTopY]` → `dx²+dz² ≤ innerR²`; выше — расстояние до полюса; epsilon 0.01.

**Причина:** strict ломал release «наполовину через стенку»; разная физика облака и башни.

**Не делать:** один материал на float и gravity; strict containment на release без причины.

---

### ADR-09: Пол → возврат в float

**Решение:** `#floor` с `emitCollisionEvents`; `floating-cube` слушает `contactbegin` →
если gravity + пол → `_enterFloatMode()` + импульс вверх.

**Причина:** скатившийся с пьедестала кубик возвращается в облако (геймплей).

---

### ADR-10: Зависимости — vendor в репо (офлайн)

**Решение:** A-Frame 1.7.1, PhysX 0.3.0 (+ wasm) — `vendor/`; жесты рук — `hand-controls-local.js` + `assets/models/*.glb`. Пути относительные (`index.html`).

**Причина:** игра без интернета (localhost, GitHub Pages); раньше jsDelivr + cdn.aframe.io (сессия 3 — неполный fix).

**Не делать:** runtime-загрузка A-Frame/PhysX/рук с CDN; дубль `gltf-model` + `hand-controls` на одной entity.

**Версии:** aframe@1.7.1, @c-frame/physx@v0.3.0 (зафиксированы в `vendor/`).

---

### ADR-11: Гонка инициализации float-кубиков

**Решение:** принято как есть до централизованного спавнера / Этапа 4.

**Причина:** ~100–200 ms до `rigidBody` — кубик чуть смещается под гравитацией; на геймплей не влияет.

---

### ADR-12: Время мира (timeScale) и slo-mo VFX

**Решение:**
- Система `time-scale`: activity головы/рук → `timeScale` 0.05↔1.0; асимметричная
  разморозка; jitter-filter рук.
- «Время мира»: `sceneEl.systems['time-scale'].getScale()` — шары, float-кубики и
  **gravity-кубики на столе** умножают velocity на scale (`floating-cube._tickGravityWithTimeScale`).
- Gravity-кубики (сессия 27+): `dome.gravityMode.useTimeScale: true` — slo-mo отключает
  PhysX-gravity на теле, интегрирует `sceneGravityY × ts` (fallback без `setGravityScale`);
  clamp в world-space. **Режим gravity** (материалы, friction, release) без изменений.
- **Realtime:** руки, rig, захват (`grabbed-dynamic` → early return в tick), стол/купол/комната.
- Float-кубики: velocity-scale + `_maintainFloatDrift`; `_driftDir` — seed trail.
- VFX trail: `float-motion-trail` — **loft mesh** (14 сечений, квадратный профиль,
  Catmull-Rom, UV-fade 0→1→0 по длине mesh). Яркость 10% realtime / 15% slo-mo.
  **Deploy:** якорь кончика в мире, голова у куба, `deployLengthM` → follow по path.
  **Grab:** fade-out `grabFadeOutSec`. Буфер geometry in-place (11 draw calls).
- VFX виньетка: только `slowmo-vignette-3d` (CSS-оверлей удалён). **VR-виньетка
  отложена** на конец разработки (этап 8) — в Quest не видна, на геймплей не влияет.

**Причина:** SUPERHOT-механика; руки в realtime, мир (включая башню) — slo-mo.

**Не делать:** глобальный physx timestep; seed trail через `_driftDir` (удалён — deploy по якорю + path).

**Устарело (сессия 27):** «gravity-кубики на столе — real time» — башня и удары шара
в slo-mo выглядели как realtime; исправлено velocity-scale + manual g×ts.

**In-hand strikes (с.28, ADR-18):** API `isWorldSlowMo()` / `getRecentMinScale()` —
для ударов в руке не использовать мгновенный `getScale()` (при взмахе → 1.0).

**Отложено (не блокирует MVP):** абстракция профиля trail (`square | circle | …`) — когда
появятся шары/другие формы (Этап 6+).

---

### ADR-13: Порог сна и damping gravity-кубиков

**Решение:** `dome.gravityMode.sleepThreshold` снижен `25 → 0.01`; `linearDamping`
`0.08 → 0.02`, `angularDamping` `0.12 → 0.04`. В `floating-cube._onContactBegin`
gravity-кубик при контакте явно вызывает `rb.wakeUp()`.

**Причина:** порог 25 (≈ скорость 7 м/с) усыплял тело **в движении** — кубик виснул,
игнорируя гравитацию: башня падала и замирала «как о прозрачное препятствие», кубы
застывали на ребре. Высокий damping добавлял «вязкость». Авто-wake биндинга
ненадёжен (ADR-02) → уснувшую стопку будит явный wakeUp по контакту.

**Не делать:** высокий sleepThreshold ради «засыпания в стопке»; `wakeUp()` каждый
кадр для gravity (стопка не уснёт, будет дрожать). Затухание даёт friction+restitution.

---

### ADR-14: Качество контактов кубов + soft-grab

**Решение:**
- Все кубы при инициализации тела получают `setSolverIterationCounts(16, 4)` и
  `setRigidBodyFlag(eENABLE_SPECULATIVE_CCD, true)` (метод `_applyContactQuality`,
  параметры в `CONFIG.floatingCubes`).
- `gravityMaterial`: restitution `0.15 → 0.05`, staticFriction `0.70 → 0.90`,
  dynamicFriction `0.60 → 0.70`.
- Захват: joint `Fixed → D6; softFixed: true` (пружинный drive @c-frame/physx).

**Причина:** дефолт солвера PhysX 4/1 давал скольжение стопок (мало velocity-итераций)
и «резиновый» выброс на рёберных ударах (глубокое продавливание при малом числе
position-итераций; speculative CCD не даёт проникнуть на быстром ударе). Жёсткий Fixed
joint перебарывал контакты — схваченный куб продавливал стоящий насквозь; softFixed
уступает контакту (куб смещается относительно руки).

**API подтверждён по исходникам `@c-frame/physx@v0.3.0`** (`src/physics.js`):
`physx-body` использует `setSolverIterationCounts` и `PxRigidBodyFlag`; `physx-joint`
поддерживает `softFixed` для D6 (drive stiffness 1000 / damping 500 / forceLimit 1000).

**Доп. фикс «резинового» отскока (после QA):** restitution/CCD/итерации не убрали
сильный отскок на рёберных ударах — причина в депенетрации (шаг `simulate` до 30 мс
без подшагов, куб проникает в стол, солвер выталкивает с большой скоростью). Метода
`setMaxDepenetrationVelocity` в биндинге **нет** (проверено: имена методов в WASM,
не в JS-glue). Решение — два подтверждённых рычага:
- `contactOffset: 0.03` (CONFIG.floatingCubes) → контакт ловится до проникновения;
- клэмп скорости gravity-куба в `tick` (`maxLinearSpeed 1.8`, `maxAngularSpeed 8.0`)
  через `get/setLinearVelocity` — гарантированно обрезает выброс.

**Не делать:** D6 softFixed для magnet-grab куба (с.48 — резинка в VR); полагаться на дефолтные 4/1 итерации
для стопок; искать `setMaxDepenetrationVelocity` (в этом биндинге отсутствует).

**Сессия 48 (3.5A.4):** для **захвата куба магнитом** вернули **`Fixed`** joint вместо
`D6 softFixed` — пользователь отверг «резинку» при тряске руки. Риск ADR-14 (продавливание
стопки) принят; snap грани + gravity off на grab. Бита — отдельный путь в `addJoint`.

---

### ADR-15: Красные шары — коллизии и угроза (Этап 6)

**Решение (сессии 18–19, переработка с.35):**
- `red-ball.js` + `spawn-red-balls.js`, слой **BALL**, float-физика, скорость ×2–×3 (per-ball).
- **BALL × DOME отключено** — шар пролетает сквозь стенку купola.
- **BALL × WORLD** — пол/стены/пьедестал: явные `collidesWithLayers: 2,3,4,5` на статиках
  комнаты и пьедестале (+ top-cap box на столе).
- Homing: разворот к куполу **только** при отскоке от стен комнаты; задержка 0/1/2
  **перебрасывается после каждого** разворота (не фикс на весь матч). `steerContinuous: 0`.
- Удар по кубу: mass **2.0**, restitution **0.32**, `cubeHitImpulseMultiplier` ~2.8.
- Trail на шарах: круглый профиль, `CONFIG.balls.trail`.
- Шары **не** хватаются (`physx-grab` игнорирует `red-ball`).

**QA десктоп (сессия 19):** не застревает в центре; не вылетает за стены. Пьедестал/башня — частично, Quest не проверен.

**Не делать:** включать BALL × DOME; постоянный homing к центру (старый режим).

**Волны «атомы времени» (с.35, Quest QA ✅):** `ball-wave-manager.js`, `CONFIG.balls.waves`,
слой **WAVE_BALL (8)** — пролет сквозь купол комнаты, коллизия с полом/пьедestalом и кубами/битой;
фильтр PhysX по «ИЛИ» масок; `_deflectWaveOffSurface` при ударе о пол/стол.

**Не делать (волны):** WAVE_BALL × купол; outer-box; homing каждый кадр.

---

### ADR-16: Бита-сковородка (Этап 7) — захват

**Решение (сессии 19–20, уточнено сессия 26):**
- `CONFIG.bat`, `spawn-ball-bat.js`, `ball-bat.js`, `respawnBallBat()` в `victory-ui`.
- Визуал и физика: блин (`a-cylinder`) и ручка (`a-box`) — **дочерние** entity, без
  `geometry` на корне. Иначе `physx-body.createShapes` строит один шейп из geometry
  корня и игнорирует детей → коллайдер только на блине. Дочерние = коллайдер на
  каждом, захват по всей бите.
- **Захват биты (сессия 26):** `dynamic + D6 softFixed` joint, как кубы; слой **BAT**
  **не** меняется на `GRABBED_CUBE` → бита в руке **упирается** в пьедestal (WORLD).
  `ball-bat`: `onGrabAcquired` / `attachToHand` (скорость руки для броска), **без**
  `object3D.attach` к руке и **без** state `grabbed` (kinematic-телепорт).
- **Захват кубов:** `grabbed-dynamic` + D6 softFixed + слой `GRABBED_CUBE` (купол игнорирует).
  **Magnet tip (3.5A, с.46–47):** collider-сфера `#*HandCollider` (r=0.01) внутри
  `#leftMagnet` / `#rightMagnet`; VFX/magnet offset — `CONFIG.player.hands.*.magnet`;
  **body collider кулака** — отдельно `bodyCollider.parts` + `hand-body-collider.js` (ADR-22).
  Joint **target** — `#*HandCollider` (physx-body), **не** `#leftMagnet` (с.47 — хват ломается).
  Якорь на кубе: грань к magnet tip (`_closestLocalOnBox`) + `detail.points` если есть;
  иначе зазор ~½ ребра (0.05 м) — **открыто 3.5A.4**.

**Не делать:**
- Kinematic `grabbed` на бите (прошивает static).
- Возвращать `geometry` на корень биты (сломает коллайдер ручки).
- Логику «запомни контакт и хватай по grip» (`_touchEl`) в общем пути `physx-grab` —
  ломает захват кубиков (сессия 20).
- **physx-joint target на `#leftMagnet`** — нет physx-body (с.47).
- Править захват «вслепую»: только offset сферы HAND **без** точки contact / грани куба (с.26 — регрессия).

**Удар по шару (сессии 21, 28):** `red-ball._deflectOffBat` + `_clampBatDeflect`.
Slo-mo: только перенаправление (доударная скорость). Realtime: `max(preHit×boost,
solver×swingRetain)`, cap. Критерий slo-mo — `time-scale.isWorldSlowMo()` (ADR-18),
не мгновенный `getScale()` при взмахе. Quest QA ✅ (с.21, с.28).

---

### ADR-17: Коллайдеры комнаты — a-box, не a-plane (сессия 22)

**Решение:** пол, потолок и 4 стены — `a-box` с тонкой толщиной (0.1), внутренняя
грань ровно по границе комнаты 3×3×3. НЕ `a-plane`.

**Причина:** `physx-body` в `createGeometry` (`src/physics.js`) не имеет ветки для
`primitive: plane` → плоскость уходит в `default` → `createConvexMeshGeometry`. Convex
hull из плоского (вырожденного, копланарного) quad строится ненадёжно: коллайдер
уезжал внутрь на **15–20 см**, объекты отскакивали заметно раньше видимой стены.
`box` обрабатывается явно → `PxBoxGeometry` точного размера. Подтверждено эмпирически:
одна стена-`a-box` стала отбивать ровно по видимой поверхности, остальные `a-plane` — нет.

**Реализация:** внутренние грани на `y=0` (пол), `y=3` (потолок), `±1.5` по X/Z (стены);
толщина 0.1 уходит наружу, изнутри комната выглядит как раньше. `#floor` сохранён
(возврат кубов в float, ADR-09). Числа совпадают с `CONFIG.room` (3×3×3), но прописаны
inline: A-Frame-атрибуты не читают `window.CONFIG` (как и у купола, см. index.html).

**Не делать:** `a-plane` с `physx-body` (любой статик-коллайдер из плоскости); полагаться
на convex hull там, где подходит примитив `box`/`sphere` (ср. ADR-05 про купол).

---

### ADR-20: Комната — туманный купол + плиточный collider (сессия 30)

**Решение:** визуал — `room-fog-dome` (shader, CONFIG.room.fogDome). Небо — `world-hdri-sky`
(сфера в корне сцены, не на камере). **HDR (с.44):** `manifest.json` → файл
`assets/hdri/{locationId}.*` (приоритет ext: hdr, jpg…); если нет — `base.*`;
`room.hdri` — только отладка. `sky.tint` + `exposure` согласуют тон с cyan-куполом.
Физика стен/потолка —
`room-dome-collider`: ~281 тонких `a-box` по внутренней полусфере (слой WORLD), R =
`fogDome.radius`. Пол — один `a-box` `#floor` (5×5 m, ADR-09). Spawn/clamp/containment
(`room-spawn-utils`, `room-containment`) — float-тела внутри купола.

**Причина:** куб 3×3×3 не совпадал с визуалом; `physx-body` на сфере = convex hull (ADR-05).

**Не делать:** один `physx-body` на полусферу комнаты; спавн без проверки R купола;
перебор URL неба в рантайме (404 в консоли) — только через manifest/listing.

---

### ADR-21: Туман у пола снаружи купола (сессия 43–44, Фаза 3.2)

**Решение:** `room-floor-fog.js` — кольца annulus снаружи R купола; `depthTest: false`.
Depth-prepass + discard в шейдере (кубы без налёта). Анимация × `time-scale.getScale()`.
`gameplayRenderOrder: 4`; пол купола `depthWrite: false`.

**Причина:** transparent + `depthTest:true` = плоский слой; без prepass + `depthTest:false`
= туман на кубах.

**Не делать:** «фикс» только переключением depthTest/opacity; stencil xz-диск.

---

### ADR-22: Body collider кулака + grab joint (сессия 47, Фаза 3.5A)

**Решение:**
- **`hand-body-collider.js`** на `#leftHandBody` / `#rightHandBody`: compound kinematic
  `a-box`; offsets — `CONFIG.player.hands.bodyCollider.parts`.
- **Rotation в CONFIG** запекается в position/size (`_bakePart`) — `rotation` на
  дочернем `a-box` PhysX/wireframe не подхватывает; шаг калибровки ±90° по Z
  (180° = симметрия бокса, визуально без изменений).
- Невидимые primitive: **`physx-hidden-collision`**; `physx-body` на корне **после**
  append детей + `object3dset`.
- **Захват** — только `#*HandCollider` (сфера r=0.01, `emitCollisionEvents`); body
  collider **не** слушает `contactbegin` для grab.
- **physx-joint target** — `#*HandCollider` (единственный physx-body у magnet tip).
  `#leftMagnet` — VFX-якорь (`hand-magnet-vfx`), **без** physx-body.
- **Magnet offset** — `CONFIG.player.hands.*.magnet` (position `#*Magnet` на кулаке).
  **Grab якорь** — `#*HandCollider` + `hands.grab.colliderLocal` (с.49).
- **Snap грани куба** — world-pos collider; фронт — `hands.grab.attachAxis`
  (Quest: `{0, -1, 0}` = к пальцам, с.49). Fixed joint (с.48).
- **VFX** — `hand-magnet-vfx` sync к collider; `sparkSeparation` (с.49).

**Quest QA ✅ (с.49):** snap фронтом, release, slo-mo.

**Не делать:**
- `physx-joint target: #leftMagnet` — хват пропадает (с.47).
- **`faceStandoff` / сдвиг collider от red-tip** «чтобы не пересекались искры» (с.48 откат).
- Один offset на body collider вместо magnet для искр и grab-сферы.
- `data-physx-hidden-collider` вместо `physx-hidden-collision` на fist boxes (PhysX
  игнорирует invisible mesh).

---

### ADR-23: GLB-детали vis + _COL (сессия 51, Фаза 3.5B.1)

**Решение:**
- **vis:** дочерний entity, GLB через `GLTFLoader`, атрибут `physx-no-collision`.
- **col:** дочерний entity, `_COL.glb`, `visible=false`, `physx-hidden-collision` +
  `data-physx-hidden-collider` → PhysX convex; **wireframe ON** рисует COL (`collider-debug-viz`).
- **CONFIG:** `parts[].model` + `parts[].colliderModel`; спавн — `floatingCubes.glbPartIds`.
- **Именование:** `имя_COL.glb` рядом с vis. Загрузка в `play()` (после attach к сцене).

**Quest QA ✅ (с.51):** grab → snap, wireframe `_COL`, FPS ok.

**Не делать:**
- High-res GLB mesh как PhysX collider на корне entity.
- `gltf-model` в `init()` до insert в DOM (GLB не грузится).

---

### ADR-18: Удары кубом/битой в захвате (сессия 28)

**Решение:**
  (~600 мс) < `worldSlowMoThreshold` (0.5). **Не** мгновенный `getScale()`: при взмахе
  в slo-mo scale кратко → 1.0 (SUPERHOT), но recentMin ≈ 0.05.
- **Жертва-куб/бита (slo-mo):** `_deflectOffGrabbedStriker` + `_clampStrikerDeflect`
  (`CONFIG.inHandStrike.sloMoDeflectClampMs`); striker-side (`_applyGrabbedStrikeToVictim`)
  + victim-side (`receiveGrabbedStrikerHit`).
- **Шар от grabbed-куба/биты:** `_deflectOffBat` + `_clampBatDeflect`. Slo-mo — только
  перенаправление (доударная). Realtime — `max(preHit×realtimeSpeedBoost, solver×swingRetain)`,
  cap `realtimeSpeedMax`. Deflect только если striker `grabbed-dynamic`.
- Realtime куб×куб / бита×куб — PhysX без deflect (ускорение сохраняется).

**Причина:** kinematic-рука + joint разгоняет жертву несколько кадров; clamp-окно как
ADR-16; мгновенный scale ломал slo-mo/realtime ветки.

**Не делать:** `if (getScale() < 0.999)` для in-hand ударов; boost шара в slo-mo.

**Quest QA ✅** (с.28).

---

### ADR-19: Меню входа, сложность, game-lifecycle (сессия 29)

**Решение:**
- `game-menu.js` — UI в мире (canvas plane, VR proximity + grip, Quest прицел через `desktop-ui-cursor.js`).
- `game-lifecycle.js` — `startGame()` / `returnToMenu()`; спавн только после «Старт»; без autoshuffle на load.
- Сложность: `CONFIG.game.difficulties` — шары 1/3/5, башня 3/4/5; `shuffleVictoryScheme()` только из spawned-цветов (`coloredCubeCount`); 6-й цвет палитры — excluded в hard.
- Ghost-схема: декоративный wireframe (`ghost-tower-hint`), не `debug.showColliders`.
- «Заново» → меню, не instant-restart. `debug.showColliders` по умолчанию `false`; toggle в меню.
- DOME debug wireframe: `debug.layerOpacity.DOME` (~0.12).
- Float-куб: после 2–5 отскоков от стен — разворот скорости к куполу (`steerTowardDome`, как red-ball).
- UI-прицел: `desktop-ui-cursor.js` — пересоздание a-cursor; Quest vr-mode OK.
- **QA:** только Quest 3 (Quest Link + localhost); ПК — serve/консоль.

**Причина:** MVP требует выбор сложности; shuffle из 6 цветов при 5 кубах ломал победу в easy/normal.

**Не делать:** HTML-оверлей поверх WebXR; autospawn на load.

**Quest QA ✅** (с.29).

**Дополнение (с.56):** сложность 5 уровней — `ballCount` + `sideCount` + `junkCount`; победа = слоты assembly-core (не башня кубов). `rollAssemblySession()` + `assets/models/machine/{core,sides}`, `junk/` + `machine-manifest.json`. Core spin: `CONFIG.machine.coreSpinAxis` = `'x'|'y'|'z'`; `_bakeRootTransform` в part-entity. Старая `stackHeight` / `shuffleVictoryScheme` — не использовать.

---

### ADR-24: GLB-машина времени + снеп-цепочка A→B→C→D→E (с.57)

**Решение:**
- Убрана процедурная cyan-зона: `orbit-ring-0/1` + коллайдеры (`orbit-ring.js` не подключён).
- GLB-машина (`machine-rig.js`): `machine.glb` статичен; `ring.glb` крутится вокруг центральной оси; `ring_inner.glb` крутится случайно (ось+знак per session, hardcore быстрее — `ringInnerSpinMult`).
- Снеп-схема (`#assembly-core`), сфера-визуал, купол-коллайдер — **дети `#machine-ring-inner`**, вращаются вместе с ним.
- Цепочка вдоль `CONFIG.machine.assemblyChain` (`axis`, `step`, `originOffset`, `stages`): по 1 случайной GLB из папок `attach/box/core/drum/end`. Стадия C = role `core` (доп. спин своей оси, прежний `_bakeRootTransform`).
- Последовательный гейтинг: `assembly-core.findFreeSlotNear` → только следующая по `order` незанятая стадия (B нельзя без A).
- Снепнутая деталь **без DOM-реперента** под `#assembly-core`: остаётся под `#floating-cubes-root`, `_forceKinematicFlag` + `_followSlot` в tick (co-rotation, с.58).
- Un-snap/слом → kinematic off, dynamic float.
- Сложность = `preAssembled` (стоящие на старте, несбиваемые `fixed`): easy ABC, normal AB, medium A, hard/hardcore пусто. Мусор: `junk/` + неиспользованные варианты стадий (leftovers) + добор цветными кубами.

**Причина:** нужен визуально законченный вытянутый механизм и детерминированная сборка по сложности вместо случайных слотов «на столе».

**Не делать:**
- Возвращать cyan `orbit-ring` как зону сборки/коллизию.
- Крутить physx-body core напрямую; whole-assembly rotation — только через реперент под вращающийся `ring_inner`.
- `stackHeight` / `shuffleVictoryScheme` / `sideCount` (устарели).

**Quest QA ✅ (с.61).** Machine `_COL`: static корпус. **Кольца:** kinematic box-сегменты (`machine-ring-collider.js`), не convex `_COL`. **Победа:** `victory-freeze.js` — стоп шаров/мусора/биты; кольца крутятся.

**Дополнение (с.60):** `_COL.glb` на вращающихся кольцах через convex — **не использовать**. Коллизия — **box-сегменты** (kinematic), маска как machine (+ WAVE_BALL).

**Дополнение (с.61):** на `victory` — `freezeWorldOnVictory`: stopWaves, velocity `{x:0,y:0,z:0}` (не `PxVec3`), guards в tick компонентов; снепнутые детали — `_followSlot` (co-rotation). **Clamp спавна:** `collider-bounds-cache.js`, per-part `spawnRadius`, разведение + `impulseDelayMs`.

---

## ДОРОЖНАЯ КАРТА

Этапы **0–8 ✅** (MVP). Стильная игра: Фазы **0–3 ✅**, **3.5A ✅**. Детали — `PROJECT_LOG_ARCHIVE.md`, `PROJECT_START.md`.

---

## ГДЕ МЫ СЕЙЧАС

- **MVP ✅** (с.29–31): меню, сложность, купол R=2 m, Quest-прогон без блокеров.
- **Стильная игра:** Фазы 0–3 ✅, **3.5B ✅** `ba9ecdd`.
- **Сейчас:** **Фаза 4** (локации). Переделка сборки ✅ (с.57–61, ADR-24).
- **Дальше:** **Фаза 4** (локации); техдолг: clamp спавна по `_COL`.
- **Не делаем:** VR-виньетка slo-mo. **Пропускаем:** захват «отлёт при тряске» (с.29).
- **Тест:** Quest Link + localhost.

Хроника по сессиям — `PROJECT_LOG_ARCHIVE.md`, оглавление в шапке ARCHIVE. **С.45:** старт сессии через `PROJECT_START.md` (DECISIONS LOCK).

---

## ИЗВЕСТНЫЕ ПРОБЛЕМЫ (активные)

- **Гонка spawn float** — ADR-11, на геймплей не влияет.
- **`extensionPageScript.js`** — расширение браузера, игнорировать.
- **Бэклог задачи** — `CURRENT_TASK.md`. Закрытые — ARCHIVE / DECISIONS LOCK в START.

---

## СТРУКТУРА ПРОЕКТА

Сжатая версия — `PROJECT_START.md`. Полный список компонентов — grep `js/components/`.
