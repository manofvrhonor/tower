# PROJECT LOG — АРХИВ СЕССИЙ

> Архитектурные «почему» — в `PROJECT_LOG.md` → **ADR**.
> **Не прикладывать целиком** при старте. Навигация: `PROJECT_START.md` → ARCHIVE-индекс → grep/read нужную сессию.

---

## Оглавление — быстрый grep

| grep / тема | Сессия | Примечание |
|---|---|---|
| Cannon, super-hands | 1–4 | отменены |
| physx-grab, enum, rigidBody | 5–6 | ADR-02 |
| dome-builder, collisionLayers | 8–12 | ADR-05–07 |
| time-scale, float-motion-trail | 13–16 | ADR-12 |
| victory-ui, red-ball | 17–21 | Этапы 5–7 |
| _touchEl, early-grab | 20 | **откат** — ломает кубы |
| kinematic grab, setKinematicTarget, бита | 26 | **откат** — прошивает пьедestal |
| isWorldSlowMo, in-hand удары | 28 | ADR-18 |
| game-menu, HTML overlay | 29 | overlay отменён |
| room-fog-dome, world-hdri-sky | 30–31 | ADR-20 |
| assembly-core, setKinematic latch | 32–36 | snap, ADR-02 п.7 |
| menu-ui-layout, orbit-ring | 37–41 | cyan-купол, меню |
| outside-scenery | 42 | 7 домов, floorRadius 50 |
| room-floor-fog, depth-prepass | 43–44 | ADR-21, HDR manifest |
| hand-body-collider, joint target HandCollider | 47 | **не** #leftMagnet (нет physx-body) |
| PROJECT_START, DECISIONS LOCK | 45 | старт сессии, grep ARCHIVE |
| hand-controls-local, magnet tip | 46 | 3.5A.0–3.3 |
| Fixed joint, snap грань red-tip | 48 | **не** faceStandoff / сдвиг collider |

## Хронология (одной строкой)

| Сессии | Статус | Тема |
|---|---|---|
| 1–4 | ✅/отмена | A-Frame, Cannon→PhysX |
| 5–12 | ✅ | PhysX, float, купол, layers |
| 13–16 | ✅ | slo-mo, trail, gravity fix |
| 17–28 | ✅ | победа, шары, бита, in-hand |
| 29–31 | ✅ | меню, купол R=2, MVP-прогон |
| 32–41 | ✅ | стильная игра, snap, cyan, кольца |
| 42–44 | ✅ | outside-scenery, floor-fog, HDR |
| 45 | ✅ | PROJECT_START, DECISIONS LOCK, slim docs |
| 46 | ✅ | 3.5A офлайн, magnet tip, VFX, contact joint |
| 47 | ✅ | 3.5A body collider кулака; grab anchor (зазор tip — открыто) |
| 48 | ⚠️ | 3.5A.4 Fixed joint + snap грани; faceStandoff откат; Quest QA открыт |
| → | в работе | 3.5A.4 Quest QA (`CURRENT_TASK.md`) |

---

## Сессии 1–4 (до PhysX)

- **1:** A-Frame 1.5, комната, Netlify.
- **2:** Cannon physics — позже отменён.
- **3:** GLB-модели рук (руки без VPN).
- **4:** super-hands — не регистрируется, отменён.

---

## Сессия 5 — PhysX, захват ✅

Миграция на `@c-frame/physx@v0.3.0` + `physx-grab`, A-Frame 1.7.1, явный wasmUrl,
`useDefaultScene: false`. Задача 1 закрыта. Песочница `sandbox-physx.html`.

---

## Сессия 6 — один float-кубик ✅

`floating-cube.js`, `CONFIG.floatingCubes`. Открытия → ADR-02 (enum-обёртки, plain vectors,
поллинг rigidBody). Гонка инициализации → ADR-11.

---

## Сессия 7 — 11 кубиков, дрейф ✅

Долговечный дрейф → ADR-04. `spawn-floating-cubes.js`, 5+6 кубиков, Quest OK.
Задача 2 закрыта.

---

## Сессия 8 — купол: визуал + плитки + временная фантомизация

- Визуал купола (`CONFIG.dome`), 89 плиток → ADR-05.
- Collision layers → ADR-06, ADR-07.
- Release containment, float/gravity → ADR-08, ADR-09.
- Задача 3 закрыта (сессия 12).

---

## Сессии 9–12 — купол QA, layers refactor

- Шаг 3.5.C: индексы слоёв в physx-material (не битовые маски).
- Lenient containment, пол→float.
- Quest QA купола ✅ (сессия 12).

---

## Сессии 13–15 — SUPERHOT + trail (Этап 4) ✅

- `time-scale.js`, velocity-scale на float-кубах → ADR-12.
- Loft trail (4c), deploy-якорь, grab fade-out. Quest OK.
- **Этап 4 закрыт.**

---

## Сессия 16 — фикс физики кубов на столе ✅

- sleepThreshold, damping, wakeUp → ADR-13.
- Solver/CCD, материалы, soft-grab, velocity clamp → ADR-14.
- Git: `a90695b` «Physix fix».

---

## Сессии 17–18 — Этап 5 + начало Этапа 6

### Этап 5 — Цель и победа ✅

- Критерий: 4 цветных башней, порядок цветов.
- `victory-check.js`, рандом-схема (`init-session.js`, 4 из 5 цветов).
- Призрачная башня (`ghost-tower-hint.js`).
- `victory-ui.js`: canvas-кириллица, панель в мире, grip+proximity,
  рестарт без `reload` (VR сохраняется). Quest QA ✅.

### Этап 6 — красные шары (начат)

- `CONFIG.balls`, `spawn-red-balls.js`, `red-ball.js`.
- 3 шара, speed×2 от кубов, `float-motion-trail`, timeScale.
- BALL×DOME off (проход сквозь стенку купola), homing к центру.
- `physx-grab` не хватает шары.

### Quest QA — баги (сессия 18 → частично закрыты в 19)

1. ~~Застревание в центре~~ — закрыто (десктоп).
2. ~~Вылет за стены~~ — закрыто (`collidesWithLayers` BALL на статиках).
3. Пьедестал / сбивание башни — правки внесены, **Quest QA не пройден**.
4. **Бита** — захват сломан (сессия 19).

**Следующая сессия:** шаг **7a** — починить захват биты; затем Quest QA этапа 6.

---

## Сессия 19 — Этап 6 (продолжение) + начало Этапа 7

### Шары

- Скорость ×2–×3 per-ball; homing-циклы (0/1/2 отскока, переброс после разворота).
- Убран `steerContinuous`; разворот только от стен комнаты.
- Trail: круглый профиль для сфер (`CONFIG.balls.trail`).
- `collidesWithLayers` BALL на пол/стены/пьедестал; шары не вылетают из комнаты.
- Импульс по кубам: mass 2.0, restitution 0.32, `cubeHitImpulseMultiplier`.
- QA десктоп: центр OK, стены OK.

### Бита-сковородка (Этап 7)

- `ball-bat.js`, `spawn-ball-bat.js`, `CONFIG.bat`, рестарт в `victory-ui`.
- Попытки захвата: joint на ручке → отлёт при движении; kinematic+parenting → **не берётся**, дёргается на пьедестале.

**Открыто:** 7a — починить захват (см. `CURRENT_TASK.md`, ADR-16).

---

## Сессия 20 — Этап 7: захват биты починен

### Захват биты (7a — закрыт по коду, ждёт Quest QA)

- **Причина бага найдена в исходнике `@c-frame/physx`:** бита ставила kinematic-флаг
  вручную, но `physx-body` этого не отслеживал и каждый кадр возвращал dynamic-тело
  на пьедестал → «прилипает / дёргается».
- **Фикс:** захват биты через встроенный state `grabbed` → `physx-body` сам делает
  `setKinematicTarget` (читает мировой pose через `getWorldPosition/Quaternion`),
  бита следует за рукой (parenting к руке для transform). На release — `removeState`
  + импульс от скорости руки.
- **Регрессия и откат:** временная логика `_touchEl` / early-grab в `physx-grab`
  ломала захват кубиков (особенно под куполом) → убрана, путь кубиков возвращён
  к исходному (D6 softFixed joint).

### Захват по всей бите

- Баг: `physx-body.createShapes` строит **один** шейп из `geometry` корня и
  игнорирует дочерние меши. Блин был на корне → коллайдер только на блине,
  за ручку не взять.
- **Фикс:** `geometry` убрана с корня; блин (`a-cylinder`) и ручка (`a-box`) —
  дочерние → коллайдер на каждом, захват по всей бите включая кончик ручки.

### Удар битой по шару

- `red-ball._deflectOffBat`: при контакте с битой отскок сохраняет
  пост-столкновительное направление, но величину возвращает к скорости до удара
  (`_preHitWorldSpeed`, фиксируется в `tick`). Цель — взмах не разгоняет шар.
- **Замечание пользователя:** скорость **не поправилась** как ожидалось →
  занесено в бэклог (`CURRENT_TASK.md`).

**Файлы:** `physx-grab.js`, `ball-bat.js`, `spawn-ball-bat.js`, `red-ball.js`.

**Итог:** захват биты работает (десктоп). Бэклог на следующие сессии — в `CURRENT_TASK.md`.

---

## Сессия 21 — Этап 7: отбивание шара битой починено ✅

### Скорость шара при отбивании (бэклог №1 — закрыт)

- **Симптом:** шар при ударе битой разгонялся от взмаха, а должен лететь со своей
  обычной скоростью (Quest).
- **Причина:** бита в руке — kinematic. `_deflectOffBat` сбрасывал скорость к доударной
  **один раз** по `contactbegin`, но kinematic-бита продавливает шар ещё несколько
  кадров, солвер заново его разгоняет, нового `contactbegin` нет → сброс перетирался.
- **Фикс (`red-ball.js`):** clamp-окно. `_deflectOffBat` запоминает `_batClampSpeed` +
  `_batClampUntilMs`; новый `_clampBatDeflect(rb)` в `tick` каждый кадр в течение окна
  возвращает «мировую» скорость к доударной, сохраняя направление от солвера. На время
  окна `_preHitWorldSpeed` не обновляется завышенным значением.
- **Параметр (`config.js`):** `CONFIG.balls.batDeflect.clampMs: 250`.
- **Quest QA ✅** — шар отлетает с обычной скоростью при любом замахе.

**Файлы:** `config.js`, `red-ball.js`.

**Следующая задача:** бэклог №3 — рассинхрон видимой и физической комнаты.

---

## Сессия 22 — рассинхрон комнаты починен (a-box) ✅

### Коллайдеры стен/пола/потолка (бэклог №3 — закрыт)

- **Симптом:** кубы и шары отскакивают не по видимым стенам, а раньше — зазор ~15–20 см
  (не `contactOffset`, а реальный размер коллайдера).
- **Причина (исходник `@c-frame/physx` `src/physics.js`):** `createGeometry` не имеет
  ветки для `primitive: plane` → `a-plane` уходит в `default` → `createConvexMeshGeometry`.
  Convex hull из плоского копланарного quad строится ненадёжно, коллайдер уезжает внутрь.
  `box`/`sphere` обрабатываются явно (`PxBoxGeometry`/`PxSphereGeometry`) — точно.
- **Диагностика:** перевёл одну стену (южную, ближнюю) на `a-box` → отскок стал ровно
  по видимой поверхности, остальные `a-plane` — нет. Гипотеза подтверждена эмпирически.
- **Фикс (`index.html`):** все 6 поверхностей комнаты → `a-box`, толщина 0.1 наружу,
  внутренние грани ровно на границах 3×3×3. `#floor` сохранён (ADR-09). → ADR-17.
- **Десктоп QA ✅.**

**Файлы:** `index.html`.

**Следующая задача:** не выбрана — взять пункт из бэклога (меню/сложность, размер шаров,
руки-пальцы, текстуры).

---

## Сессия 23 — уменьшение шаров + открытые баги контактов

- Шары Ø4 см, хвост — визуал ✅. Ранний контакт шар→куб и пьедestal — отложено на 24.
- **Файлы:** `config.js`, `float-motion-trail.js`, `floating-cube.js`.

---

## Сессия 25 — collider-debug PhysX, слой BAT, круглая крышка (QA частично)

- **collider-debug-viz:** контуры из **PxShape** (`getBoxGeometry`/`getSphereGeometry`), pose
  из `getGlobalPose`; материалы объектов не трогаются.
- **Слой BAT (7):** отдельно от `GRABBED_CUBE`; `ball-bat.js`, `spawn-ball-bat.js`,
  `pedestal-builder` (боковина + крышка), `index.html`, spawn-скрипты.
- **pedestal-builder:** крышка — **один** `a-cylinder` (диск r=0.3); убран квадрат 0.6×0.6.
- **dome-builder:** плитки всегда `visible: false` (ghost-башня не перекрывается).
- **QA ❌:** бита **в руке** проходит сквозь пьедestal — **не слои**; kinematic grab
  (`setKinematicTarget`, ADR-16). → сессия 26.
- **Файлы:** `collider-debug-viz.js`, `config.js`, `pedestal-builder.js`, `ball-bat.js`,
  `spawn-ball-bat.js`, `dome-builder.js`, `index.html`, `floating-cube.js`, `physx-grab.js`.

---

## Сессия 26 — бита × пьедestal; эксперименты захвата (откат)

### Закрыто

- **Бита в руке × пьедestal ✅:** kinematic `grabbed` прошивал static; фикс —
  **dynamic + D6 softFixed**, слой BAT (`physx-grab.js`, `ball-bat.js`). QA ✅.

### Откат (не в коде)

- Усиление joint / tick / dual-mode / damping / solver — дрожь биты, отскок кубов.
- Offset сферы HAND + anchor по `contactbegin` — регрессия (мизинец, «парит»).

### Бэклог (оставляем как есть)

- Отлёт при тряске; естественный хват — только VR-калибровка.

**Файлы (итог):** `physx-grab.js`, `ball-bat.js`.

**Следующая сессия:** парящий стол + gravity × timeScale.

---

## Сессия 27 — парящий стол, gravity × timeScale, бита float/gravity ✅

### Закрыто

- **Парящий стол:** визуал — тонкий диск (r=0.3, h=0.03); PhysX — один диск
  (`pedestal-builder`, `wallSegments: 0`). Убраны 12 стенок и «невидимые препятствия».
- **Gravity-кубы × timeScale (ADR-12 v2):** `setGravityScale` нет в биндинге → manual
  `g×ts`, velocity-scale, clamp world-space (`floating-cube.js`, `config.js`).
- **Шар→куб:** импульс world-space; убран slo-mo ghost-boost; pending + visual hit сохранены.
- **Куб в руке → шар:** `_deflectOffBat` — без разгона от руки.
- **Бита:** float вне купола / gravity внутри (как кубы); старт y=0.55 между полом и столом.
- Десктоп QA timeScale + bat float — **OK** (пользователь).

### Открыто → с.28

- Удары **кубом/битой в руке** по кубам башни и между собой — доработка clamp/impulse.

**Файлы:** `index.html`, `pedestal-builder.js`, `floating-cube.js`, `red-ball.js`,
`ball-bat.js`, `config.js`, `time-scale.js`, `PROJECT_LOG.md`.

**Git:** ранний коммит сессии `7e774e1` (стол + pedestal); правки timeScale/bat — **не закоммичены**
(по запросу пользователя).

**Следующая сессия:** in-hand удары (с.28).

---

## Сессия 28 — in-hand удары (куб/бита × шар/куб) ✅

### Закрыто

- **ADR-18:** `time-scale.isWorldSlowMo()` — recentMinScale за 600 мс; fix ложного
  realtime при взмахе в slo-mo (мгновенный scale → 1.0).
- **Slo-mo:** куб/бита-жертва — deflect+clamp (striker + victim side); шар — только
  перенаправление, без boost.
- **Realtime:** шар — `max(preHit×1.6, solver×0.45)`, cap 2.8 м/с; куб×куб — PhysX.
- **Quest QA ✅** (пользователь).

**Файлы:** `time-scale.js`, `red-ball.js`, `floating-cube.js`, `ball-bat.js`, `config.js`.

**Следующая сессия:** меню входа + сложность (с.29).

---

## Сессия 29 — меню входа, сложность, wireframe DOME ✅

### Сделано

- **Меню:** `game-menu.js` — 3 сложности, «Старт», toggle wireframe коллайдеров.
- **Lifecycle:** `game-lifecycle.js` — `startGame()` / `returnToMenu()`; spawn только после «Старт».
- **Сложность:** шары 1/3/5, башня 3/4/5; 6-й цвет палитры; fix shuffle (только spawned-цвета).
- **Ghost-схема:** декоративный wireframe по цветам (не debug colliders).
- **UI-прицел:** `desktop-ui-cursor.js` — Quest + desktop; скрыт в игре, возврат на победе/меню.
- **Debug DOME:** `layerOpacity.DOME` 0.12; `showColliders` default false.
- **Кубы → купол:** float-куб после 2–5 отскоков от стен — homing к куполу (как red-ball).
- **QA:** только Quest 3; ПК — localhost/отладка.
- **Quest QA ✅** (пользователь, incl. меню/победа/прицел/режимы).

**Файлы:** `config.js`, `init-session.js`, `game-lifecycle.js`, `desktop-ui-cursor.js`,
`game-menu.js`, `ghost-tower-hint.js`, `victory-ui.js`, `victory-check.js`, `floating-cube.js`,
`spawn-*.js`, `collider-debug-viz.js`, `index.html`.

**ADR-19.** **Следующая сессия:** комната-купол + skybox (с.30).

---

## Сессия 30 — комната-купол, HDR-небо, collider полусферы ✅

### Сделано

- **`world-hdri-sky`:** мировая сфера (не на `#player`); fallback-градиент; random HDR/JPG
  из `assets/hdri/` (`hdriAuto`); парсер `.hdr`; `scripts/refresh-hdri-manifest.ps1`.
- **`room-fog-dome`:** туманная полусфера, procedural shader (движущийся туман).
- **`room-dome-collider`:** ~281 static box-плиток (WORLD), R=`fogDome.radius` (2.5 m).
- Пол `#floor` 5×5 m; кубические стены/потолок удалены.
- **Spawn/containment:** `room-spawn-utils`, `room-containment` — кубы/шары внутри купола.
- ПК QA ✅ (пользователь).

**Файлы:** `world-hdri-sky.js`, `room-fog-dome.js`, `room-dome-collider.js`,
`room-spawn-utils.js`, `room-containment.js`, `config.js`, `index.html`, `spawn-*.js`,
`floating-cube.js`, `red-ball.js`, `assets/hdri/`.

**ADR-20.** **Следующая:** меню в VR / Quest HDR по желанию.

---

---

## Сессия 35 — Этап 6 «атомы времени»: волны угроз ✅

### Сделано

- **`CONFIG.balls.waves`:** параметры спавна за туманом, прицел на стол, деспавн+респавн.
- **`ball-wave-manager.js`:** пул N шаров, `spawnOne()`, `startWaves()`/`stopWaves()`,
  респавн по `ball-retired`; развилка в `game-lifecycle.js`.
- **`red-ball` wave-режим:** `_waveMode`, подлёт по `dataset`-прицелу, `_waveTick` без
  containment/homing/floorEscape, деспавн за `despawnRadius`.
- **Слой WAVE_BALL (8):** пролет сквозь купол комнаты (нет в маске `room-dome-collider`);
  коллизия с полом/пьедestalом (WAVE_BALL добавлен в их маски) и кубами/битой.
- **Фиксы по ходу QA:**
  - OR-фильтр PhysX — исключение слоя только на шаре не хватало (купол держит BALL).
  - Сквозь стол/пол — добавили WAVE_BALL в маски пола и пьедestala.
  - Катится по полу — `_deflectWaveOffSurface` (наружу+вверх).

### QA

- **Quest QA ✅** (пользователь): углы атаки, проход сквозь туман, удар по деталям,
  отбивание битой/кубом → деспавн → новый, отскок от пола/стола.

**Коммит:** `1b53d51` — `feat: волны «атомы времени»… (Этап 6)`.

**Следующая сессия:** Фаза 1.4 (слом снепа при ударе) → 1.5 (победа по слотам).

---

## Сессия 34 — отскок шаров/кубов от стенки комнаты (по коду ✅, ждёт Quest QA)

### Проблема и итог

После круглого купола (ADR-20) все float-тела «катались» вдоль стенки комнаты и
скапливались. Перебрали несколько подходов, оставили **физичное отражение от нормали**.

### Сделано

- **Общий отскок в `room-containment.js`** (`CONFIG.room.wallBounce`): `bounceOffRoomDomeWall`
  отражает скорость от нормали сферы `v' = v − (1+e)(v·n)n` (только при `v·n > 0`), касательная
  сохраняется; `enforceRoomDomeWallBounce` — tick-страховка у стенки; `enforceRoomDomeContainment`
  на sphere-clip вызывает тот же отскок. Подключено для **кубов** (`floating-cube`, float+gravity),
  **шаров** (`red-ball`) и **биты** (`ball-bat`) — `contactbegin` + tick.
- **`red-ball.floorEscape`** — отдельный разворот к башне при «качении» по полу (`maxY`,
  `minHorizDist`, `minHorizSpeed`, `cooldown`, `upBias`). Пол — ✅ по фидбеку.

### Тупиковые попытки (откатаны)

- Отскок **строго к центру −n** → все стягивались **под стол** (центр полусферы на полу, y=0).
- `wallSlideEscape` / `apexEscape` / `perimeterSteer` (homing к куполу или рандом) → кучкование
  и «поезд» у макушки, неорганично.

### Решение по Этапу 6 (следующая сессия)

- Шары почти всегда бьют стол **снизу**. Выбран **вариант D — «атомы времени»**: волны угроз,
  спавн **за туманом**, полёт к сборке, деспавн при отбивании + респавн. По лору — атомы
  времени, притягиваются к ядру. Дизайн и микро-шаги — в `CURRENT_TASK.md`.

**Файлы:** `room-containment.js`, `red-ball.js`, `floating-cube.js`, `ball-bat.js`, `config.js`,
`CURRENT_TASK.md`, `PROJECT_LOG.md`, `PROJECT_LOG_ARCHIVE.md`.

**Следующая сессия:** Этап 6 «атомы времени» (вариант D, за туманом) → затем Фаза 1.4 / 1.5.

---

---

---

---

---

---

## Сессия 47 — Фаза 3.5A: body collider кулака, калибровка рук, grab anchor ⚠️

### Сделано

- **`hand-body-collider.js`:** compound kinematic `a-box` на `#leftHandBody` / `#rightHandBody`;
  кубы не проходят сквозь кулак. Паттерн как у биты: дети → потом `physx-body` на корне;
  невидимые боксы — `physx-hidden-collision`.
- **`CONFIG.player.hands.bodyCollider.parts`:** position / rotation / size; **rotation
  запекается** в position+size (`_bakePart`) — иначе PhysX/wireframe не видят поворот
  (180° по Z = симметрия, шаг ±90°).
- **Quest QA ✅ (пользователь):** `bodyCollider` и `magnet` подогнаны под GLB в `config.js`.
- **`hand-magnet-vfx.js`:** magnet offset через `setAttribute('position')`, не только
  `object3D.position` — согласованность с иерархией A-Frame.
- **`physx-grab.js`:** якорь joint — ближайшая точка на **грани** куба к magnet tip;
  улучшено чтение `detail.points` (PxVec3Vector / массив). **target joint** — только
  `#*HandCollider` (kinematic physx-body).

### Откат / не сработало

- **target `#leftMagnet`** — нет `physx-body` → joint не создаётся, **хват пропал** (откат).
- **`_closestLocalOnBox` + magnet world pos** — хват восстановлен, но **зазор ~5–7 см**
  у cyan-искр **как до сессии** (≈ половина ребра куба 0.1 м). → остаётся **3.5A.4**.

### Решения (→ ADR-22)

- Захват (`contactbegin`) — только `#*HandCollider` (r=0.01); body collider **не** эмитит grab.
- Joint target — **только** entity с `physx-body` (сфера magnet), не `#leftMagnet` (VFX-якорь).
- Калибровка кулака — `bodyCollider.parts`; искры/magnet tip — `hands.*.magnet` (раздельно).

**Файлы:** `hand-body-collider.js`, `physx-grab.js`, `hand-magnet-vfx.js`, `config.js`, `index.html`, docs.

**Следующая сессия:** **3.5A.4** — убрать зазор куба у magnet tip (joint anchor / softFixed / Quest).

---

## Сессия 46 — Фаза 3.5A: офлайн, magnet tip, VFX, contact joint ✅

### Сделано

- **Офлайн (3.5A.0):** `vendor/` (A-Frame 1.7.1, PhysX 0.3.0, wasm); ADR-10 → vendor в репо;
  `hand-controls-local.js` (GLB + жесты без cdn.aframe.io); убран дубль `gltf-model` + CDN.
- **Руки:** кулак по умолчанию; grip/trigger → `magnetcharge` / `magnetdischarge`.
- **`hand-magnet-vfx.js`:** cyan-искры + red +3 см по local Z; оси якоря Quest зафиксированы
  (`X` вбок, `Y` вперёд, `Z` вверх) — `CONFIG.player.hands.*.magnet`.
- **Magnet tip (3.5A.1–2):** `#leftMagnet` / `#rightMagnet`; collider внутри; offset
  `(0, -0.08, -0.01)`; radius **0.01** м.
- **`physx-grab`:** joint якорь в **точке contactbegin** (не origin куба) — иначе зазор ~5–10 см;
  `contactbegin` на collider; бита — скорость от `#leftMagnet`.

### QA

- **ПК ✅** (пользователь): офлайн, жесты, искры, позиция tip.
- **Quest:** крепление кубов к magnet — **донастройка** (след. сессия).

**Файлы:** `vendor/*`, `index.html`, `js/config.js`, `js/components/hand-controls-local.js`,
`hand-magnet-vfx.js`, `physx-grab.js`, `assets/models/*HandLow.glb`, docs.

**Следующая сессия:** **3.5A.4** — настройка крепления кубов/биты к magnet tip (Quest QA).

---

## Сессия 45 — оптимизация контекста агента ✅

### Сделано

- **`PROJECT_START.md`** (`alwaysApply`): стартовый бандл вместо полного `PROJECT_LOG` при старте;
  DECISIONS LOCK, ADR/ARCHIVE-индексы, триггеры «когда grep/read ARCHIVE».
- **`AGENTS.md`:** slim ~130 строк; § «Работа с ARCHIVE и DECISIONS LOCK».
- **`PROJECT_LOG.md`:** сжат (все ADR сохранены); убраны дубли «Что сделано» / длинная хроника.
- **`CURRENT_TASK.md`:** только активная задача 3.5A.
- **`PROJECT_LOG_ARCHIVE.md`:** оглавление grep в шапке (тела сессий без изменений).

**Workflow старта:** `AGENTS.md` + `PROJECT_START.md` + `CURRENT_TASK.md`.

**Следующая сессия:** микро-шаг **3.5A.1** — CONFIG + tip offset на `#leftHand` / `#rightHand`.

---

## Сессия 43–44 — Фаза 3.2 floor-fog + 3.3 HDR ✅ → Фаза 3.5A

### Сделано

- **3.2 `room-floor-fog.js`:** низкий туман annulus снаружи купола; 20 слоёв, depth-prepass +
  discard (объём + чистые кубы); `useTimeScale` (slo-mo мира); `gameplayRenderOrder: 4`;
  пол купола `depthWrite: false`. Коммит **`dfeb141`**, push.
- **3.3 `world-hdri-sky`:** небо `{locationId}.*` → `base.*` по `manifest.json` (без 404-перебора);
  `sky.tint` / `exposure` под cyan-купол; `assets/hdri/base.jpg`; удалены черновики city/ignore.
- **Quest QA ✅** (пользователь): дома, туман, slo-mo, HDR — без блокеров.

**Коммиты:** `dfeb141` (3.2 floor-fog), **`ab3c4ce`** (3.3 HDR + slo-mo + docs, push).

### Решения

- Туман на кубах: **depth-prepass**, не `depthTest:true` (ADR-21).
- HDR: локация не хранит имя файла; `id` → файл на диске или `base.*`.

**Файлы:** `room-floor-fog.js`, `world-hdri-sky.js`, `config.js`, `index.html`,
`room-fog-dome.js`, `room-spawn-utils.js`, gameplay renderOrder, `assets/hdri/*`,
`CURRENT_TASK.md`, `PROJECT_LOG.md`.

**Следующая сессия:** **Фаза 3.5A** — магнитные руки (tip anchor). **Сессия закрыта ✅**

---

## Сессия 42 — Фаза 3.1 outside-scenery + пол ✅ → Фаза 3.2

### Сделано

- **`outside-scenery.js` (new):** застройка за cyan-куполом — 4 **primary** (диагонали
  `(±d,±d)`, `textureOnly` + wall-JPG) + 3 **background** (оси N/E/S/W, серый tint + JPG).
  Чёрная обводка (`EdgesGeometry`). Смещения: `axisDistanceOffset`, `positionOffset` per prototype.
- **`CONFIG.room.outsideScenery`:** прототипы с размерами; `primaryRing.axisDistance` 7;
  `backgroundRing.axisDistance` 26; без roof-текстур (только `wall`).
- **`room-fog-dome`:** `floorRadius: 50` — «бесконечный» пол на y=0 под домами.
- **`menu-ui-draw.js`:** `menuUiButtonDrawOpts` — accent-кнопки с видимой рамкой (`borderDim`).
- **`victory-ui.js`:** те же `uniformFontScale` / `_menuBtnFont`, что у `game-menu`.
- **fix:** `floating-cube.js` — `inside is not defined` в `_breakSnapFromHit` (шар сбивает снеп).
- **Текстуры:** папка `assets/textures/outside-buildings/` — 7 файлов `*-wall.jpg`
  (пользователь подготовил часть; остальные — warn 404 до добавления).

### Решения

- Крыша/низ бокса — **без текстуры** (снизу не видно); только `wall` на 4 стенах.
- Ближние дома — чистая текстура; дальние — лёгкий серый multiply (`color` + JPG).
- Расстановка **не** по полному кругу, а по **схеме перекрёстка** (rotation Y = 0).

**Файлы:** `outside-scenery.js`, `config.js`, `index.html`, `room-fog-dome.js`,
`menu-ui-draw.js`, `victory-ui.js`, `game-menu.js`, `floating-cube.js`.

**Quest QA 3.1:** не в фокусе сессии (desktop ✅ по домам).

**Следующая сессия:** микро-шаг **3.2** — туман у пола снаружи купола.

---

## Сессия 41 — меню adaptive + кольца 72 + план Фазы 3.5 ✅ → Фаза 3

### Сделано

- **VR-меню:** `menu-ui-layout.js` — строковый layout, плашка растёт с числом кнопок;
  `contentWidth` 1.45 m, `btnFontSize` 60, `uniformFontScale`; сложность в один ряд.
- **Меню EN:** Easy/Normal/Hard/Hardcore, Start, Wireframe ON/OFF; victory — VICTORY/Restart/Main Menu.
- Убран заголовок «TOWER OF TIME» из стартового меню.
- **`menu-ui-draw.js`:** `menuUiUniformFontScale`, `menuUiFontSizeOnPlane`.
- **Кольца:** `CONFIG.assemblyZone.rings[*].segments` **72** (округлее контур).
- **План:** Фаза **3.5** между 3 и 4 — **3.5A** магнитные руки (первым),
  **3.5B** сборка/GLB (вторым). Обновлены `PROJECT_LOG.md`, `CURRENT_TASK.md`,
  `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md`.

### Решения

- Снеп-схему и GLB-детали **не** трогаем до **3.5A** (руки) — иначе перегонять release/снеп.
- Фаза 3 (outside-scenery, туман, HDR) — **следующая**; 3.5 — после неё.

**Файлы:** `menu-ui-layout.js` (new), `menu-ui-draw.js`, `game-menu.js`, `victory-ui.js`,
`config.js`, `orbit-ring.js`, `index.html`, `PROJECT_LOG.md`, `CURRENT_TASK.md`, plan.

**Следующая сессия:** микро-шаг **3.1** — `outside-scenery.js`.

---

## Сессия 40 — Фаза 2.x QA + фиксы ✅ → Фаза 3

### Сделано

- **ПК + Quest QA ✅** по чек-листу 2.x (8 пунктов): сфера, cyan-кольца, float inside/outside,
  снеп, hardcore-вращение слотов, бита в комнате, шары×кольца.
- **fix:** `assembly-zone.js` — `})(window)` (красная ошибка в консоли).
- **fix:** `orbit-ring.js` — cyan-визуал сегментов (кольца были невидимы).
- **fix:** `assembly-hub.js` — hardcore без `appendChild` на кольцо (слоты пропадали);
  rotation sync в `tick`.
- **fix:** `assembly-core` — жёлтые призраки слотов (fill + wireframe), `ensureSlotsBuilt`.
- **git commit + push** ядра 2.x — `9205f2c`.
- **CURRENT_TASK** → план **Фазы 3** (outside-scenery → floor fog → HDR).

**Следующая сессия:** микро-шаг **3.1** — `outside-scenery.js`.

---

## Сессия 39 — Фаза 2.x: ядро (сфера + кольца + float-inside) ⬜ QA

### Сделано (код, не закоммичено на момент закрытия)

- **Дизайн согласован** (чат): закрытая белая сфера вместо капсулы; два наклонных
  вращающихся кольца вместо стола; внутри сферы — float-inside (без g, сквozь DOME);
  снаружi — float + барьер DOME; hardcore — `#assembly-core` parent → `orbit-ring-0`.
- **CONFIG.assemblyZone** + слой **FLOAT_INSIDE (9)**; difficulty **hardcore**.
- **Новые:** `assembly-zone.js`, `orbit-ring.js`, `assembly-hub.js`, `assembly-sphere-visual.js`.
- **dome-builder:** `_buildFullSphere` для коллайдера сферы ядра.
- **floating-cube:** states `float` / `float-inside`; release inside → float-inside.
- **index.html:** `#assembly-hub` вместо `#pedestal` + `#dome-visual`.
- **game-menu:** 4-я кнопка «Хардкор», panel h 1.0.
- **Бита:** `randomPositionInRoomDome` в `room-spawn-utils.js`.
- **Сессия началась с push** коммита `7aad71c` (cyan-купол, меню, victory — с.37–38).

### Не сделано / следующая сессия

- **ПК QA → Quest QA** по чек-листу 2.x.
- **git commit** изменений 2.x (после QA или по запросу).
- Полировка: sync kinematic-колец, баланс радиусов, hardcore-снеп на вращении.

**Файлы:** `config.js`, `index.html`, `assembly-zone.js`, `orbit-ring.js`, `assembly-hub.js`,
`assembly-sphere-visual.js`, `dome-builder.js`, `floating-cube.js`, `ball-bat.js`, `red-ball.js`,
`game-menu.js`, `room-spawn-utils.js`, `spawn-ball-bat.js`, `CURRENT_TASK.md`.

**Следующая сессия:** 2.x QA → фиксы → commit; потом Фаза 3.1 или полировка ядра.

---

## Сессия 38 — фикс layout victory-ui ✅

### Сделано

- **victory-ui:** panel height 0.46 → **0.50**; кнопки подняты («Заново» y −0.03,
  «В главное меню» y −0.16) — нижняя плашка не выходит за чёрную панель; запас под scale 1.08.
- **Quest QA ✅** (пользователь): старт-меню + меню победы — ровно, без обрезки.

**Файлы:** `victory-ui.js`.

**Следующая сессия:** Фаза 3.1 — `outside-scenery.js` (или 2.x малый купол по выбору).

---

## Сессия 37 — Фаза 2.1 cyan-купол + меню cyan-theme + victory-ui ✅ (UI layout — баг)

### Сделано

- **2.1 cyan-купол:** `room-fog-dome.js` — ridged-ленты + sin-вихри + слой fbm-дыма
  (`fogOverlay`); параметры в `CONFIG.room.fogDome`. Пользователь подкрутил визуал ✅.
- **victory-ui:** позиция = `game.menu.worldPosition`; кнопки «Заново» (`startGame`) и
  «В главное меню» (`returnToMenu`); убран hint «Поднеси руку + grip».
- **game-menu:** hint убран.
- **Палитра меню:** `CONFIG.game.menuTheme`, `js/menu-ui-draw.js` — cyan/чёрный/белый,
  обводка кнопок, центрирование текста по метрикам шрифта.
- **Wireframe fix (с.36, QA ✅):** `collider-debug-viz` — без WASM crash при grab×купол.

### Баг (→ следующая сессия)

- **VR-меню layout:** на скрине победы плашки смещены влево, «В главное меню» выходит за
  нижний край панели. Вероятно: размер панели vs позиции кнопок / pivot canvas-текстур.

**Файлы:** `room-fog-dome.js`, `config.js`, `victory-ui.js`, `game-menu.js`,
`menu-ui-draw.js`, `index.html`, `floating-cube.js`, `assembly-core.js`, `victory-check.js`,
`game-lifecycle.js`, `collider-debug-viz.js`, логи.

**Следующая сессия:** фикс layout VR-меню (game-menu + victory-ui).

---

## Сессия 36 — Фаза 1.4–1.5: слом снепа, победа по слотам, wireframe fix ✅

### Сделано

- **1.4 — слом снепа шаром:** `floating-cube._breakSnapFromHit` — `releaseSlot`, dynamic,
  `_resetKinematicLatch`, импульс `CONFIG.assembly.breakImpulse` (+ доля скорости шара),
  state float/gravity по containment. Точка входа: `_onContactBegin` + `_isDangerBall`.
- **1.5 — победа по слотам:** `victory-check.js` переписан — все слоты `assembly-core`
  заняты снепнутыми деталями → `mechanism-complete` + `victory` (устойчивость 1 с).
  `assembly-core`: `areAllSlotsOccupied`, `resetOccupancy`, `getOccupiedSlots`.
  `game-lifecycle`: ghost-tower-hint не показывается; сброс слотов при старте/меню.
- **Фикс wireframe:** `collider-debug-viz` — grabbed/snapped/kinematic читают позу из
  `object3D`; `getGlobalPose` в try/catch с fallback. Устранён WASM crash при проносе
  куба сквозь купол (Quest зависал — чёрный экран).

### QA

- **Quest QA ✅** (пользователь): 1.4 слом, 1.5 победа, wireframe без зависания.

**Файлы:** `floating-cube.js`, `assembly-core.js`, `victory-check.js`, `game-lifecycle.js`,
`collider-debug-viz.js`, `index.html`, `CURRENT_TASK.md`.

**Следующая сессия:** Фаза **2.1** — cyan-шейдер купола (`room-fog-dome.js`).

---

## Сессия 33 — Фаза 1.3: снеп детали + ручной разбор ✅

### Сделано

- **Мастер-план — точный путь зафиксирован:** `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md`
  (папка `.cursor/` скрытая — поиск по маске её может не находить; в `CURRENT_TASK`/`PROJECT_LOG`
  записан полный путь + предупреждение, чтобы будущие сессии не делали вывод «плана нет»).
- **Шаг 1.3 — снеп при release:**
  - `assembly-core.js`: API занятости слотов — `findFreeSlotNear()` (ближайший свободный слот
    в допуске `CONFIG.assembly.snapPosTolerance`, мировая поза), `occupySlot`/`releaseSlot`/
    `isSlotOccupied`; призрак занятого слота скрывается.
  - `floating-cube.js`: `onGrabReleased` → `_trySnapToSlot` (только `dataset.isTarget==='true'`)
    → `_snapToSlot` ставит деталь в позу слота (world→local), `type: kinematic`, state `snapped`;
    `tick` для `snapped` — early-return. Серый мусор не снепится.
- **Ручной разбор снепа (по запросу):** `floating-cube._onStateAdded` ловит переход в
  `grabbed-dynamic` у снепнутой детали → `_unsnapFromSlot` (освобождает слот, `type: dynamic`).
  Нужно для перестановки ошибочной детали и будущих деталей-обманок. `physx-grab` не тронут.
- **Фикс бага биндинга (защёлка `setKinematic`):** `@c-frame/physx@0.3.0` выставляет
  `eKINEMATIC` в `tock()` один раз через защёлку, назад не сбрасывает (physics.js ~1257).
  Повторный снеп после un-snap не становился kinematic → визуал расходился с физ-телом
  (объекты проходят насквозь + деталь нельзя снова взять). Лечение — `_resetKinematicLatch()`
  при возврате в dynamic. → ADR-02 п.7.

### QA

- **Quest QA ✅** (пользователь): снеп в слот, разбор рукой, повторный цикл снеп↔разбор,
  без сквозного прохождения.

**Файлы:** `assembly-core.js`, `floating-cube.js`, `CURRENT_TASK.md`, `PROJECT_LOG.md`,
`PROJECT_LOG_ARCHIVE.md`.

**Следующая сессия:** 1.4 (слом снепа при ударе опасного объекта) → 1.5 (победа по слотам);
+ фикс поведения шаров в круглой комнате (катаются по полу вдоль купола, не ломают башню).

---

## Сессия 32 — старт «стильной игры»: модель данных + снеп-слоты (в работе)

### Сделано

- **Мастер-план** превращения MVP в стильную игру (machine-time, снеп-сборка деталей,
  cyan-поле времени, слои мира, N-локаций-комнат с графом маршрутов, меню/комикс).
  Файл плана: `.cursor/plans/tower_stylish_game_*.plan.md` (вне репозитория).
- **Фаза 0:** в `js/config.js` добавлены декларативные структуры (НЕ подключены к рантайму):
  `parts`, `locations` (массив произвольной длины, start-флаг), `mechanisms` (слоты),
  `progression` (граф рёбер requiresMechanism→unlocksLocation + finalMechanism), `assembly`
  (допуски снепа, breakImpulse). 3 локации — лишь начальное наполнение; движок N-локационный.
- **Шаг 1.1 (диагностика):** подтверждён kinematic-API биндинга → ADR-02 п.7
  (смена type на лету не пересоздаёт тело; поза kinematic из object3D; PxTransform конструктора нет).
- **Шаг 1.2:** компонент `js/components/assembly-core.js` — призрачные cyan-слоты механизма
  на ядре (эволюция ghost-tower-hint), читает CONFIG.mechanisms. Только визуал. ПК-проверка ✅.

### Решения

- Снеп фиксируем **кинематик-локом** (деталь → поза слота → `type: kinematic`; слом → dynamic + импульс).
- v1: снеп к фиксированному ядру; прототип Фазы 1 на текущих кубах (цветные=детали, серые=мусор).

**Коммиты:** `feat: модель данных… (Фаза 0)`, `feat: призрачные слоты сборки… (Фаза 1.2)`.

**Следующая сессия:** Фаза 1.3 (снеп при release) → 1.4 (слом при ударе) → 1.5 (победа по слотам).

---

## Сессия 31 — купол R=2 m, пол, туман, меню VR ✅

### Сделано

- **`fogDome.radius`:** 2.5 → **2.0 m**; PhysX-пол 4×4 m; процедурный **непрозрачный пол-диск**
  в `room-fog-dome`.
- **Туман:** контрастные движущиеся зоны (`fogMin`/`fogMax`, `fogLift`, `fogContrast`,
  `scrollSpeed`); итерация по фидбеку пользователя.
- **Меню:** `worldPosition` `{ x:0, y:1.55, z:-0.65 }` (+1 m от старта); `depthTest: false`
  + `renderOrder: 50` — видно за игровым куполом на месте.
- **Прицел:** `desktop-ui-cursor.js` — `renderOrder: 100`, поверх меню.
- **Quest QA ✅** (пользователь): купол, пол, туман, меню, прицел.

**Файлы:** `config.js`, `room-fog-dome.js`, `game-menu.js`, `desktop-ui-cursor.js`, `index.html`.

**MVP-прогон ✅** — см. блок ниже.

---

## MVP-прогон Quest ✅

- Полный цикл: меню → сложность → башня → шары → победа → «Заново».
- **Quest QA ✅** (пользователь): блокеров нет.
- **Критерий MVP** (2–5 мин без инструкций) — подтверждён пользователем.

---

## Сессия 24 — pedestal-builder, red-ball, collider-debug (QA частично)

- **pedestal-builder** вместо convex hull; квадратная крышка 0.6×0.6 на круге r=0.3 —
  **не закрыто** (запинание). Диагностика: бита на столе — отдельный collider.
- **red-ball:** `_isNearVisualCubeHit`, pending/hold, slo-mo ghost-boost. Slo-mo QA ❌.
- **collider-debug-viz** прототип (один розовый цвет).
- **Файлы:** `pedestal-builder.js`, `red-ball.js`, `collider-debug-viz.js`, `config.js`,
  `index.html`, `dome-builder.js`.
- **Следующая сессия (25):** wireframe по типам; парящий стол + купол; комната-купол + skybox.

---

## Сессия 48 — Фаза 3.5A.4: Fixed joint, snap грани к red-tip ⚠️

### Сделано

- **`physx-grab.js`:** `D6 softFixed` → **`Fixed`** joint — жёсткий хват без «резинки» (ПК ✅).
- **Snap куба:** `_snapCubeToMagnetFace` — фронтальная грань к магниту (`attachAxis` +Z world);
  якорь joint на **грани** box (не origin); gravity off на захвате.
- **Единый якорь tip:** world-pos из `magnetVfx.redAbove.offsetZ` (0.03 local `#*Magnet`);
  `#*HandCollider` на том же tip (`_applyHandColliderAttachOffset`).
- **`config.js`:** `hands.grab` — только `attachAxis`; убраны `attachLocal`, `faceStandoff`.

### Не сработало / откат

- **`faceStandoff` / `grabLocal`** — сдвиг collider на 0.08 local; пользователь: «спустил вниз»,
  «ползунки от балды»; **удалено**.
- **Snap к `handCollider.getWorldPosition()`** при смещённом collider — грань не у искр.
- **Промежуточные `_closestLocalOnBox` без поворота грани** — липнет с любой стороны.

### Открыто

- **Quest QA 3.5A.4:** грань у red/cyan tip, release, slo-mo; калибровка `attachAxis` / `redAbove.offsetZ`.

**Файлы:** `physx-grab.js`, `config.js`, `CURRENT_TASK.md`.

**Следующая сессия:** Quest QA 3.5A.4 → при OK закрыть фазу 3.5A.

---

## Сессия 49 — Фаза 3.5A закрыта: collider якорь, snap фронтом ✅

### Сделано

- **Единый якорь `#*HandCollider`:** `hands.grab.colliderLocal` — position/rotation;
  snap + joint target = world-pos collider (`_getGrabAnchorWorld`).
- **`hand-magnet-vfx.js`:** VFX sync к collider (`_syncVfxToCollider` на `#*Magnet` —
  `visible=false` на a-sphere скрывает детей object3D); `sparkSeparation: 0.04` (cyan/red ±2 см).
- **Snap фронтом:** `attachAxis: {0, -1, 0}` — Quest −Y к пальцам (не +Z «снизу»).
- **Quest QA ✅** (пользователь): захват фронтом, release, slo-mo — OK.
- Удалены дубликаты `*.new.glb` (остаток скачивания агента с.46, не использовались).

### Открыто (не блокирует 3.5B)

- **GLB руки с магнитом** (`leftHandMagnet.glb`) — в мастер-плане 3.5A; отложено (сейчас HandLow + VFX).

- Snap к `redAbove.offsetZ` — red только visual offset, не grab point.
- VFX через `setObject3D` на `#*HandCollider` — невидим из-за `visible=false`.

**Файлы:** `physx-grab.js`, `hand-magnet-vfx.js`, `config.js`.

**Следующая сессия:** **3.5B.0** — слоты от центра сферы/колец.
