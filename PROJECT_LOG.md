# PROJECT LOG — TOWER OF TIME

> Долгая память проекта. **ADR** — архитектурные решения и «почему так» (читать перед правками физики).
> История сессий — `PROJECT_LOG_ARCHIVE.md`.
> При старте: `AGENTS.md` + этот файл (разделы ADR и «Где мы») + `CURRENT_TASK.md`.

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
| A-Frame | 1.7.1, jsDelivr |
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

### ADR-10: CDN — только jsDelivr

**Решение:** все библиотеки через `https://cdn.jsdelivr.net/`, версии зафиксированы.

**Причина:** стабильность из РФ без VPN.

**Не делать:** aframe.io, unpkg, cdnjs и др.

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

**Не делать:** жёсткий Fixed joint для захвата; полагаться на дефолтные 4/1 итерации
для стопок; искать `setMaxDepenetrationVelocity` (в этом биндинге отсутствует).

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
- **Захват кубов:** без изменений — `grabbed-dynamic` + D6 softFixed + слой
  `GRABBED_CUBE` (купол игнорирует).

**Устарело (сессия 26):** state `grabbed` + `setKinematicTarget` для биты — прошивала
пьедestal; откатан.

**Не делать:**
- Kinematic `grabbed` на бите (прошивает static).
- Возвращать `geometry` на корень биты (сломает коллайдер ручки).
- Логику «запомни контакт и хватай по grip» (`_touchEl`) в общем пути `physx-grab` —
  ломает захват кубиков (сессия 20).
- Править захват «вслепую»: offset сферы руки и anchor joint по `contactbegin` без
  калибровки в VR (сессия 26 — регрессия). Ghost-contact + неверные оси hand-controls.

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
(сфера в корне сцены, не на камере; HDR random из `assets/hdri/`). Физика стен/потолка —
`room-dome-collider`: ~281 тонких `a-box` по внутренней полусфере (слой WORLD), R =
`fogDome.radius`. Пол — один `a-box` `#floor` (5×5 m, ADR-09). Spawn/clamp/containment
(`room-spawn-utils`, `room-containment`) — float-тела внутри купола.

**Причина:** куб 3×3×3 не совпадал с визуалом; `physx-body` на сфере = convex hull (ADR-05).

**Не делать:** один `physx-body` на полусферу комнаты; спавн без проверки R купола.

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

---

## ДОРОЖНАЯ КАРТА

| Этап | Название | Статус |
|---|---|---|
| 0 | Каркас + деплой | ✅ |
| 1 | Стол и хватание | ✅ |
| 2 | Плавающие кубики | ✅ |
| 3 | Купол над столом | ✅ |
| 4 | Замедление времени (SUPERHOT) | ✅ |
| 5 | Цель и победа | ✅ |
| 6 | Красные шары | ✅ (Quest QA с.28) |
| 7 | Предмет для отбивания (бита) | ✅ in-hand удары с.28 |
| 8 | Полировка (меню, skybox, …) | ✅ Quest QA + MVP-прогон (с.29–31) |

---

## ГДЕ МЫ СЕЙЧАС

- Этапы 0–5 ✅.
- **Этап 5 (сессии 17–18):** `victory-check`, рандом-схема (`init-session.js`),
  призрачная башня, `victory-ui` (canvas-текст, рестарт без reload, Quest OK).
- **Этап 6 (сессии 18–19):** шары, trail, homing-циклы, слои WORLD×BALL, импульс по кубам.
  Десктоп QA: центр/стены OK; пьедестал/башня/Quest — в процессе.
- **Этап 7 (сессии 19–21):** бита-сковородка; захват **починен** (state `grabbed`,
  коллайдер на блине и ручке). Отбивание шара **починено** (сессия 21): clamp-окно
  скорости (`_clampBatDeflect`), шар отлетает с обычной скоростью. Quest QA ✅.
- **Полировка (сессия 22):** коллайдеры комнаты `a-plane → a-box` (ADR-17) — отскоки
  теперь ровно по видимым стенам/полу/потолку. Десктоп QA ✅.
- **Полировка (сессия 23):** шары Ø7→Ø4 см (`balls.radius` 0.04), хвост — та же абсолютная
  ширина (`trail.sizeScale` 0.91), длиннее (`trailSpacingM` 0.045). Визуал ✅.
- **Полировка (сессия 24):** физика контактов — частичные фиксы; редизайн пространства.
- **Полировка (сессия 25):** `collider-debug-viz` — контуры **PhysX PxShape**; слой **BAT**;
  крышка пьедestala — один диск; плитки купola скрыты.
- **Полировка (сессия 26):** бита × пьедestal **в руке ✅** — dynamic + D6 softFixed (слой BAT).
  Бэклог захвата: отлёт при тряске; естественный хват — VR-калибровка.
- **Полировка (сессия 27):** **парящий стол** — визуал-диск + PhysX-диск (r=0.3, h=0.03,
  `wallSegments: 0`). **Gravity-кубы × timeScale** (ADR-12 v2): velocity-scale + manual g×ts;
  шар→куб world-space; куб в руке отбивает шар (`_deflectOffBat`). **Бита:** float вне купола /
  gravity внутри (как кубы), старт y=0.55. Десктоп QA timeScale ✅ (пользователь).
- **Полировка (сессия 28):** **in-hand удары** (ADR-18): `isWorldSlowMo()`, deflect+clamp
  кубов/биты в slo-mo; realtime boost шара; Quest QA ✅. **Сессия закрыта.**
- **Следующая (с.29):** **меню входа + сложность** + wireframe DOME — ✅ Quest QA (ADR-19).
- **Следующая (с.30):** **комната-купол + HDR skybox** — ✅ ПК QA (ADR-20).
- **Полировка (с.31):** R=2 m, непрозрачный пол Ø4 m, контрастный туман; меню `z:-0.65`
  (depthTest + прицел renderOrder 100). **Quest QA ✅** (пользователь).
- **MVP-прогон Quest ✅** (пользователь): меню → башня → шары → победа, без блокеров.
- **Критерий MVP из лога — выполнен.**
- **Стильная игра (с.32, в работе):** новый мастер-план (machine-time, снеп-сборка,
  cyan-поле, слои мира, N-локаций, комикс) — `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md`
  (точное имя с хэшем; папка `.cursor/` скрытая — поиск по маске её может не находить,
  открывать по полному пути).
  Сделано: Фаза 0 (модель данных в config: parts/locations/mechanisms/progression/assembly),
  диагностика kinematic (ADR-02 п.7), Фаза 1.2 (`assembly-core` — призрачные слоты).
- **Стильная игра (с.33):** Фаза **1.3 ✅** (Quest QA) — снеп детали в слот при release
  (kinematic-lock, `assembly-core` учёт занятых слотов), **ручной разбор** снепа рукой
  (для деталей-обманок), фикс защёлки `setKinematic` биндинга (ADR-02 п.7).
  Дальше: 1.4 слом при ударе → 1.5 победа по слотам.
- **Шары в круглой комнате (с.34 ✅ по коду):** отскок от стенки комнаты
  вынесен в общий `room-containment.js` (`CONFIG.room.wallBounce`) — **физичное отражение от
  нормали** сферы для кубов, шаров (старый режим) и биты. Quest QA — не в фокусе с.35.
- **Этап 6 «атомы времени» (с.35 ✅ Quest QA):** волны угроз — `ball-wave-manager.js`,
  `CONFIG.balls.waves`, слой **WAVE_BALL**, спавн за туманом, полёт к сборке, деспавн+
  респавн, отскок от пола/стола наружу-вверх. Коммит `1b53d51`.
- **Стильная игра — следующая:** Фаза **1.4** (слом снепа при ударе) → **1.5** (победа по слотам).
- **Не делаем:** VR-виньетка slo-mo (снято с бэклога). **Пропускаем:** захват VR отлёт.
- **Закрыто:** пьедestal «запинание» (парящий диск, с.27).
- Стек стабилен: PhysX 0.3.0 + physx-grab. **Тесты — Quest Link + localhost**; ПК не для геймплея.

---

## ИЗВЕСТНЫЕ ПРОБЛЕМЫ

- **Руки без VPN** — решено локальными GLB (`assets/models/`).
- **`extensionPageScript.js` в Network** — расширение браузера, игнорировать.
- **Гонка spawn float** — ADR-11.
- **In-hand удары (с.28):** ✅ Quest QA. ADR-18.
- **Захват VR (отлёт при тряске):** пропущено по решению пользователя (с.29).
- **VR-виньетка slo-mo:** не делаем (снято с бэклога, с.29).
- **Пьедestal «запинание» (с.24):** закрыто — парящий диск (с.27).
- **Шар→куб (башня):** pending + visual hit; ghost-boost убран (с.27).
- **Шары в круглой комнате (с.34):** ✅ по коду — `CONFIG.room.wallBounce`, общий
  `room-containment.js`. Quest QA не в фокусе с.35 (старый режим шаров заменён волнами).
- **Шары бьют стол только снизу (с.34):** ✅ закрыто с.35 — волны «атомы времени»
  (`waves.enabled=true`, WAVE_BALL, Quest QA ✅).
- **Парящий стол ✅** (с.27).
- **Бэклог** — см. `CURRENT_TASK.md`.

---



## СТРУКТУРА ПРОЕКТА

```
Tower/
├── index.html
├── js/config.js, main.js, init-session.js, game-lifecycle.js, desktop-ui-cursor.js
├── js/room-spawn-utils.js, room-containment.js
├── js/spawn-floating-cubes.js, spawn-red-balls.js, spawn-ball-bat.js
├── js/components/  physx-grab, floating-cube, red-ball, ball-bat, dome-builder,
│                   room-fog-dome, room-dome-collider, world-hdri-sky,
│                   pedestal-builder, collider-debug-viz, time-scale, slowmo-vignette-3d,
│                   float-motion-trail, ghost-tower-hint, victory-check, victory-ui,
│                   game-menu
├── assets/models/  leftHandLow.glb, rightHandLow.glb
├── AGENTS.md, CURRENT_TASK.md, PROJECT_LOG.md, PROJECT_LOG_ARCHIVE.md
```

---

## ЧТО СДЕЛАНО (сводка)

- **0–1:** комната, PhysX, руки, grab.
- **2:** `floating-cube.js`, 11 кубиков, дрейф (ADR-04).
- **3:** визуал + 89 плиток (ADR-05), layers (ADR-06–07), release/float (ADR-08),
  пол→float (ADR-09), lenient containment, float/gravity материалы. QA ✅ (сессия 12).
- **4:** `time-scale` + float velocity-scale + `_maintainFloatDrift` + `_driftDir` (ADR-12);
  VFX trail loft (14 sect, deploy anchor, grab fade, UV-fade); CSS-виньетка удалена;
  VR-виньетка отложена. QA trail ✅ (сессии 14–15). **Этап 4 закрыт.**
- **Пред-5 (сессия 16):** физика gravity-кубов на столе — ADR-13/14. Quest QA ✅.
- **5 (сессии 17–18):** победа (4 цветных, рандом-схема), призрачная башня,
  `victory-ui` + рестарт без reload. Quest QA ✅.
- **6 (сессии 18–19):** шары (скорость ×2–×3, homing-циклы, trail круглый, импульс кубам,
  слои стен/пьедестала). Десктоп: не в центре, не за стены.
- **7 (сессия 19–21, 26, 28):** `ball-bat`; in-hand удары ADR-18. Quest QA ✅.
- **8 (с.29):** меню, 3 сложности, lifecycle, ghost wireframe, UI-прицел Quest,
  shuffle fix, DOME layer opacity, float-куб homing к куполу. Quest QA ✅ (ADR-19).
- **8 (с.30):** `world-hdri-sky`, `room-fog-dome`, `room-dome-collider`, spawn/containment
  внутри купола. ПК QA ✅ (ADR-20).
- **8 (с.31):** `fogDome.radius` 2 m, пол-диск, туман (fogLift/contrast); меню дальше +
  видимость за игровым куполом; прицел поверх меню. Quest QA ✅.

**QA купола (уточнение теста 1):** float-кубики сталкиваются с куполом **снаружи**
(слой FLOAT_CUBE × DOME). Внутри на пьедестале кубики в gravity и **не** бьются о
стенку купola (GRAVITY_CUBE × DOME отключена намеренно, ADR-07). Альтернатива:
после теста 4 (пол → float + импульс вверх) кубик может удариться о крышку купола
ещё в режиме float.

Детали по сессиям — `PROJECT_LOG_ARCHIVE.md`.
