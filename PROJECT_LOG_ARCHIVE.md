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
| machine-rig, снеп-цепочка A→E, ring_inner | 57 | ADR-24; **не** orbit-ring/sideCount |
| follow-slot снеп, force eKINEMATIC, ring reverse | 58 | ADR-24 v2; **не** DOM-реперент детали |
| phase4, travel-ui, wrist-inventory | 62 | ADR-25; план phase4_locations.plan |
| location-manager, travel-ready, travel-ui | 63 | Фаза 4 шаги 1–6; co-rotation freeze fix |
| outside-scenery epoch, spawn quota, wrist-inventory | 64 | Фаза 4 шаги 7–9; **не** fog/HDR по эпохе |
| wrist-inventory QA, cylinder pockets, collider fix | 65 | Фаза 4 шаг 10 ✅; retrieve правая рука |
| wrist-travel-remote, live travel menu, cascade lock | 66 | forced slo-mo; time-lock travel/victory |

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
| 49–56 | ✅/⚠️ | руки GLB, 3.5B детали/призраки/разряды, меню PNG, сложности 5 lvl |
| 57–61 | ✅ | GLB-машина A→E, co-rotation, ring сегменты, victory-freeze, Quest QA |
| 62 | ✅ | меню карточки + план Фазы 4 (ADR-25) |
| 63 | ✅ | Фаза 4 шаги 1–6: config, location-manager, travel-ready, travel-ui, veil |
| 64 | ✅ | Фаза 4 шаги 7–9: пейзаж домов, спавн по эпохе, wrist-inventory |
| 65 | ✅ | Фаза 4 шаг 10: wrist QA, цилиндры, collider fix — **фаза закрыта** |
| 66 | ✅ | Пульт прыжка + живое меню эпох, cascade/time-lock — Quest QA |
| → | — | **Фаза 5** — опасности, таймер петли |

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

---

## Сессия 50 — 3.5A.5 руки, magnet off, cartoon купол откат ✅

### Сделано

- **Коммит `b115e2e` + push:** новые `leftHandLow.glb` / `rightHandLow.glb`; удалены
  `magnet.glb` и `hand-magnet-mesh.js` — магнит только VFX + `#*HandCollider`.
- **VFX:** swap cyan/red искр в `magnetVfx` (`config.js`).
- **3.5A.5.0:** пробовали `magnet.glb` + `hand-magnet-mesh` — отключено по решению пользователя.
- **3.5B.0:** пересчёт слотов от центра сферы — **откат** пользователем (оставлены старые позы).
- **Cartoon `room-fog-dome`:** эксперимент (cel-cyan, контуры, штриховка) — **полный откат**
  на energy-шейдер (ленты + fbm).

### Откат / не использовать

- Cartoon `renderStyle` на `#room-fog-dome` — «стена», статичные контуры (с.50).
- `magnetMesh` / отдельный GLB магнита — отложено; руки с магнитом в меше — в бэклоге 3.5A.5.

**Файлы:** `config.js`, `index.html`, `assets/models/*HandLow.glb`, `room-fog-dome.js` (energy).

**Следующая сессия:** **3.5B.0** — слоты (если снова нужно) или **3.5B.1** GLB-детали.

---

## Сессия 51 — 3.5B.1 vis + _COL, part-entity, Quest QA ✅

### Сделано

- **3.5B.1a–c:** `config.js` — `colliderModel`, `glbPartIds: ['fa_core','fa_coil']`;
  пути `phase_splitter_trident` / `phase_modulator_ring` + `_COL.glb`.
- **`part-entity.js`:** vis (дочерний, `physx-no-collision`) + `_COL` (невидим,
  `physx-hidden-collision`); `physx-body` на корне без geometry; wireframe ON → контур COL.
- **`spawn-floating-cubes.js`:** GLB-детали на первых позициях, остальное — кубы.
- **Quest QA ✅** (пользователь): grab → snap, wireframe `_COL`, FPS ok.

### Контракт ассетов

- Пара файлов: `имя.glb` (vis) + `имя_COL.glb` (low-poly convex collider).
- Pivot vis = pivot COL = точка снепа.

**Файлы:** `config.js`, `part-entity.js`, `spawn-floating-cubes.js`, `index.html`,
`assets/models/phase_*.{glb,_COL.glb}`.

**Следующая сессия:** **3.5B.2** — призраки слотов под форму детали.

---

## Сессия 52 — 3.5B.2 призраки слотов + fix restart после победы ✅

### Сделано

- **`assembly-core.js`:** призрак слота по `parts[].model` (vis GLB + wireframe/fill);
  box `slotSize` fallback если model null; GLTF cache.
- **Fix победы после Restart:** `game-lifecycle.restartGame()` — clear + spawn +
  `victory-check.reset()`; `victory-ui` «Заново» больше не вызывает `startGame()`
  (тот выходил при `state===playing`).
- **Quest QA ✅** (пользователь): призраки ok; restart → повторная победа ok.

**Файлы:** `assembly-core.js`, `game-lifecycle.js`, `victory-ui.js`.

**Следующая сессия:** **3.5B.3** — состояния визуала детали.

---

## Сессия 53 — 3.5B.3 разряды + пол asphalt, QA ✅

### Сделано

- **Пол:** `assets/textures/floor/asphalt.jpg` → `room-fog-dome.js` (тайл 2 m).
- **3.5B.3:** `part-entity.setVisualState`; хуки в `floating-cube.js`.
- **`part-snap-energy.js`:** cyan разряды — ridged-noise шейдер по mesh + jagged LineSegments
  по поверхности (случайный spawn/glow); не bbox-палки, не жёлтый emissive.
- Итерации: контраст/яркость шейера; живые bolt-пути по triangle-samples mesh.
- **QA ✅** (пользователь): снеп, разряды, победа, ПК ok.

**Файлы:** `config.js`, `room-fog-dome.js`, `part-entity.js`, `part-snap-energy.js`,
`floating-cube.js`, `index.html`, `assets/textures/floor/asphalt.jpg`.

**Следующая сессия:** **Фаза 4** — `location-manager`.

**Commit:** `ba9ecdd` — push main ✅.

---

## Сессия 54 — Фаза 6: VR-меню PNG (veil, искры, карусель) ⚠️ не закрыта

### Сделано

- **Medium** — 5-й уровень сложности в `CONFIG.game.difficulties`.
- **Ассеты:** 9 PNG в `assets/ui/menu/`; спека в `CONFIG.game.menu.assets`.
- **`menu-world-veil.js`** — чёрная завеса на камере, мир скрыт до Start.
- **`menu-backdrop-vfx.js`** — cyan-искры; взрыв по кругу при Start.
- **`game-menu.js`** — переписан под PNG: карусель, Start, gear, hover/pointer.
- **`index.html`** — подключены новые компоненты.

### Не закрыто / регрессии (пользователь, конец сессии)

- **Карусель:** нужен **wrap** (выбранная по центру, боковые сзади), не линейный ряд Easy→Hardcore.
- **Неактивные карточки:** нужны **обесцвеченные, opacity 1** — не полупрозрачные (`inactiveOpacity: 0.42` — ошибка).
- **Слои:** боковые не должны наезжать на центр; occlusion без прозрачности.
- **Hover:** прицел должен ловить **всю площадь** карточки (hit-plane + перекрытия боковых).
- **Свечение:** мягкое по контуру **часов**, не прямоугольник PNG.
- **Quest QA** — не прогоняли.

### Технический долг

- Не вызывать `_sortCarouselDom` (ломает DOM/mesh).
- Не путать «не просвечивать» с `opacity < 1`.

**Файлы:** `game-menu.js`, `menu-world-veil.js`, `menu-backdrop-vfx.js`, `config.js`, `index.html`, `assets/ui/menu/*.png`.

**Следующая сессия:** **6.6-fix** — карусель wrap + opaque desaturate + hover/layers → Quest QA.

**Commit:** нет (незакоммичено).

---

## Сессия 55 — Фаза 6: меню PNG — карусель, hover, искры, рамка ⚠️ Quest QA

### Сделано

- **`game-menu.js`** — полный rewrite: wrap-карусель (2+2), dim боковых (opacity 1), occlusion (renderOrder), hit-plane hover, неон-рамка + **бегущий огонёк на canvas** (`runnerSpeed` 0.67 м/с).
- **`config.js`** — carousel (`dimNear/dimFar`, `sideScaleFar`, `clickableMaxOffset`, `frame*`, `runner*`), `defaultDifficulty: medium`, `backdropVfx` shell/orbit.
- **Фикс старта:** `_layoutCarousel()` после `loaded` меша карточки (renderOrder до загрузки → наезд).
- **`victory-ui.js`** — `victory-ui-clickable` только при показе плашки (`_setClickable`); скрытые кнопки перехватывали луч над нижней половиной карточек (THREE-raycaster игнорирует `visible`).
- **`menu-backdrop-vfx.js`** — искры в **мировых** координатах (орбита вокруг игрока), не на камере.
- **Тюнинг карусели:** ближние раздвинуты; крайние меньше/темнее/некликабельны; клик только center + соседи.
- **Анимация огонька:** `tick()` компонента вместо `addEventListener('tick')` (Event ≠ time/delta).

### ПК smoke ✅ (браузер)

- F12 без красных; MEDIUM по центру; карусель/hover/Start/gear/искры; огонёк по рамке.

### Не закрыто

- **6.7 Quest QA** — grip + raycaster, визуал в шлеме (пользователь не прогонял).

### Технический долг (не повторять)

- Огонёк на отдельном mesh за PNG — не виден; рисовать на canvas рамки.
- `inactiveOpacity < 1` для боковых карточек — ошибка (с.54).
- `_sortCarouselDom` — ломает mesh (с.54).

**Файлы:** `game-menu.js`, `victory-ui.js`, `menu-backdrop-vfx.js`, `config.js`, `CURRENT_TASK.md`.

**Следующая сессия:** **6.7** Quest QA → закрыть Фазу 6 → **Фаза 4**.

**Commit:** нет (незакоммичено).

---

## Сессия 56 — Сложности 5 lvl, machine roll, меню polish ⚠️ core spin

### Сделано

- **Папки моделей:** `assets/models/machine/core`, `sides`, `junk/`; GLB перенесены; `scripts/refresh-machine-manifest.ps1`.
- **Сложность:** 5 уровней — `ballCount`, `sideCount`, `junkCount`; `rollAssemblySession()`; спавн из `CONFIG.session`; динамические слоты `assembly-core`.
- **Убрано:** `stackHeight`, `shuffleVictoryScheme` для победы (остался `ghost-tower-hint` legacy).
- **Меню (продолжение Ф.6):** огонёк — бег невидим + вспышки 1 с / 4–6 с, scale 0→100→0; runner ×2 speed; Start −⅓; крайние карточки 0.40 м, `dimFar` 0.10.
- **Core spin:** `part-entity` — `_bakeRootTransform`, `coreSpinAxis: 'x'|'y'|'z'`; крутится vis, collider статичен.

### Не закрыто

- **Core spin axis** — пользователь: ось всё ещё не та; нужна **буква X/Y/Z из Blender** (не угадывать).
- **diff-5 Quest QA** — 5 сложностей, junk fallback, hardcore стол.
- **6.7 Quest QA** меню — не прогоняли.

### Техдолг

- Не возвращать bbox/world/assembly-up авто-оси для spin.
- GLB root rotation — только через `_bakeRootTransform`, ось в `CONFIG.machine.coreSpinAxis`.

**Файлы:** `config.js`, `init-session.js`, `game-lifecycle.js`, `spawn-floating-cubes.js`, `assembly-core.js`, `part-entity.js`, `floating-cube.js`, `game-menu.js`, `index.html`, `assets/models/machine/**`, `machine-manifest.json`, `scripts/refresh-machine-manifest.ps1`.

**Следующая сессия:** **core spin** (X/Y/Z от пользователя) → **diff-5** + **6.7** Quest QA.

**Commit:** нет (незакоммичено).

---

## Сессия 57 — Переделка сборки: GLB-машина + снеп-цепочка A→E ⚠️ Quest QA

### Сделано (ПК, код)

- **Отмена процедурной зоны:** убраны `orbit-ring-0/1` + коллайдеры из `index.html` (`orbit-ring.js` не подключён). `diff-5` (старая схема) закрыт как неактуальный — не тестировали.
- **GLB-машина** (`machine-rig.js`): `machine.glb` статичен; `ring.glb` крутится вокруг центральной оси; `ring_inner.glb` крутится случайно (ось+знак per session; hardcore ×`ringInnerSpinMult`).
- **Иерархия** (`index.html`): `#assembly-hub → #machine-rig`, `#machine-ring → #machine-ring-inner →` (`#assembly-core`, купол-коллайдер, сфера-визуал). Снеп-схема и купол вращаются с `ring_inner`.
- **Данные** (`config.js`): `machine.assemblyChain` (axis/step/originOffset/stages A–E), `machine.rig`; `difficulties` через `preAssembled` (easy ABC / normal AB / medium A / hard,hardcore пусто), `ballCount`/`junkCount` сохранены, `sideCount`/`rotateAssemblyWithRing` убраны. Manifest + PS1 под папки `attach/box/core/drum/end/junk`.
- **Цепочка** (`init-session.js`): по 1 случайной GLB из каждой папки → упорядоченные слоты; leftover-варианты + `junk/` → junk-пул; добор цветными кубами.
- **Гейтинг** (`assembly-core.js`): `nextRequiredOrder` + `findFreeSlotNear` только для следующей стадии; `getSlotPose` (world+local).
- **Снеп + co-rotation** (`floating-cube.js`): снепнутая деталь реперентится под `#assembly-core` (kinematic, крутится с `ring_inner`); `snapToSlotById` (старт предустановленных); `fixed` — несбиваема шаром, неснимаема рукой; un-snap/слом → реперент назад под `#floating-cubes-root`.
- **Спавн** (`spawn-floating-cubes.js`): `preAssembled` → `startSnapped`+`fixed`; остальные грабабельны; `clearCubes` чистит и реперентнутые детали под `#assembly-core`.
- **assembly-hub.js** — сведён к позиционному якорю + reset occupancy.

### Не закрыто

- **Quest QA** новой сборки — не прогоняли (чек-лист в `CURRENT_TASK.md`).
- **Тюнинг** `assemblyChain` (axis/step/originOffset/повороты стадий) — на глаз на ПК.
- **Уборка** дубль-папок `assets/models/machine/hold/`, `tip/` (не подключены; оставлены — удалить вручную).

### Техдолг / риски (проверить в Quest)

- Co-rotation снепнутых деталей опирается на sync kinematic-actor из world-matrix при вращении родителя (как у рук). Если physx не тянет — деталь визуально оторвётся от схемы.
- Купол-коллайдер (капсула, открытый низ) теперь вращается — при наклонной оси возможны утечки float-inside кубов; тюнить при QA.

**Файлы:** `config.js`, `index.html`, `machine-rig.js` (нов.), `assembly-hub.js`, `assembly-core.js`, `floating-cube.js`, `init-session.js`, `spawn-floating-cubes.js`, `game-lifecycle.js`, `machine-manifest.json`, `scripts/refresh-machine-manifest.ps1`.

**Следующая сессия:** Quest QA сборки → тюнинг цепочки → **Фаза 4** (локации).

**Commit:** нет (незакоммичено).

---

## Сессия 58 — Фикс снепа (co-rotation) + разворот кольца ⚠️ Quest QA

### Диагностика (браузер MCP, ПК)

- **ПК smoke** через браузер: F12 без красных; `machine/ring/ring_inner` грузятся; roll medium собрал цепочку A*(pre) B C D E, junk 7, `_COL`-пути ок.
- **Баг «деталь A орбитит далеко за куполом»** (риск с.57 реализовался). На живой сцене: снепнутая деталь = `PxRigidDynamic`, флаг `eKINEMATIC` НЕ выставлен, латч `physx-body.setKinematic` пуст, хотя `data.type='kinematic'`. Тело остаётся dynamic → physx пишет **мировую** позу в **локальный** `object3D` → вращающийся `ring_inner` раскручивает большой локальный офсет.
- **Краш `table index out of bounds`** (`_snapToSlot → coreEl.appendChild → disconnectedCallback → physx-body.remove → wakeUp`): DOM-реперент детали под `#assembly-core` сносит/пересоздаёт physx-тело во время захвата.
- Биндинг `tock` (из `toString()`): kinematic-флаг ставится по латчу `type==='kinematic' && !setKinematic`, затем `kinematicMove()` гонит `setKinematicTarget` из world-matrix. Форс флага вживую → деталь мгновенно встала в слот (`partWorld===slotWorld`), co-rotation ок.

### Сделано (ПК, код)

- **ФИКС снепа** (`floating-cube.js`, ADR-24 v2): **убран DOM-реперент** под `#assembly-core`. Деталь остаётся под `#floating-cubes-root`; `_forceKinematicFlag` дожимает `eKINEMATIC` явно; `_setObjWorldPose` ставит в мировую позу слота; `_followSlot` в `tick` (state `snapped`) каждый кадр держит деталь в текущей мировой позе слота (co-rotation без реперента). Проверено: зазор деталь↔слот ~2–5 мм (лаг 1 кадр); снеп рукой (part B) — без крашей и ошибок консоли.
- **Разворот кольца** (`config.js`): `machine.rig.ringSpinDeg` `18 → -18`.

### Не закрыто

- **Quest QA** новой сборки — не прогоняли.
- **Тюнинг цепочки** — сейчас поза стадии считается **только вдоль одной оси** `assemblyChain.axis` с равным `step` (`stagePose` в `init-session.js`); у стадии есть только `rotation`, **пер-деталь позиции нет**. Пользователь: «не все детали на нужной оси» → **следующий шаг: добавить пер-стадийный `position:{x,y,z}`-сдвиг** в `stagePose` + примеры в config.
- **Уборка** дубль-папок `hold/`, `tip/`.

**Файлы:** `floating-cube.js`, `config.js`, `CURRENT_TASK.md`.

**Следующая сессия:** пер-деталь position-сдвиг стадий A–E → тюнинг цепочки → Quest QA → Фаза 4.

**Commit:** нет (вся с.57–58 незакоммичена).

---

## Сессия 59 — Position A–E, containment, machine _COL, hand↔ball ⚠️ ring collider

### Сделано

- **Commit `cd7c328`** — `Time machine real Snap-scheme fix` (push main): с.57–56 накопленное (машина, снеп, co-rotation, меню, assets).
- **Пер-деталь position** (`init-session.js` `stagePose` + `assemblyChain.stages[].position` в config); пользователь подогнал позы — визуально ок на ПК.
- **room-containment:** разделены `spawnMargin` (0.12, только спавн) и `containmentMargin` (0.01, tick-отскок у cyan); `nearWallRatio` 0.98 — убран «отскок от пустоты» ~20 см от vis.
- **Отбивание шаров рукой:** `HAND` в маске BALL (`spawn-red-balls.js`, `ball-wave-manager.js`); `red-ball` — контакт `hand-body-collider` → `_deflectOffBat`. Пользователь: ок.
- **machine-rig _COL (черновик):** загрузка `machine_COL` / `ring_COL` / `ring_inner_COL` как static PhysX (WORLD). Корпус `machine` — ок.

### Не закрыто / баг

- **Коллайдеры `ring` / `ring_inner`:** static PhysX **не двигается** с vis (`object3D.rotateOnAxis` в tick); wireframe `_COL` не совпадает с вращающейся геометрией. **→ с.60: kinematic + sync pose каждый кадр.**
- **Quest QA** полный чек-лист — не закрыт (частичный фидбек: сборка ок, правки выше).
- **coreSpinAxis** — пользователь подбирает в `config.js` (`coreSpinAxis` / `coreSpinByFile`).

### Техдолг

- Clamp спавна по реальному радиусу GLB `_COL` (не `size/2`).
- Уборка `assets/models/machine/hold/`, `tip/`.

**Файлы (локально):** `config.js`, `init-session.js`, `room-spawn-utils.js`, `room-containment.js`, `machine-rig.js`, `spawn-red-balls.js`, `ball-wave-manager.js`, `red-ball.js`, `CURRENT_TASK.md`.

**Следующая сессия:** **коллайдеры ring/ring_inner (kinematic sync)** → commit локального → Quest QA → coreSpinAxis.

**Commit сессии:** `cd7c328` (основной объём); пост-правки **не закоммичены**.

---

## Сессия 60 — ring _COL откат, WAVE_BALL на machine, convex-пробка ⚠️

### Сделано

- **machine-rig:** ring/ring_inner — пробовали **kinematic** + sync `updateMatrixWorld` (static не следовал за spin).
- **machine-rig:** маска collidesWith как у **pedestal** (+ `WAVE_BALL`) — шары волны должны биться о корпус машины.
- **Диагностика:** convex `_COL` на `#machine-ring` / `#machine-ring-inner` + vis без `physx-no-collision` → PhysX **сплошая** оболочка (дырка кольца залита), блокирует центр сборки; wireframe выглядит как два шара.
- **Откат:** PhysX **снят** с колец — остаётся только **static `machine_COL`** на `#machine-rig`. Kinematic-хелперы убраны.

### Не закрыто

- **Коллайдеры колец** — следующая сессия: **сегменты** (паттерн `orbit-ring.js`), не convex `_COL.glb` на вращающемся entity.
- **Quest QA** — чек-лист открыт.
- **Commit** локального (containment, hand↔ball, machine-rig) — по запросу.
- **coreSpinAxis** — пользователь.

### Техдолг

- `machine-rig._loadVisual`: vis на child + `physx-no-collision` (ADR-23), когда вернём col кольца.
- Clamp спавна по GLB `_COL`; уборка `hold/`/`tip/`.

**Файлы (локально):** `machine-rig.js`, `CURRENT_TASK.md` (+ накопленное с.59: `config.js`, `room-containment.js`, `spawn-red-balls.js`, `ball-wave-manager.js`, `red-ball.js`, …).

**Следующая сессия:** **коллайдеры ring/ring_inner (сегменты)** → smoke ПК → Quest QA.

**Commit сессии:** нет.

---

## Сессия 61 — Сегменты колец, victory-freeze, Quest QA ✅

### Сделано

- **machine-ring-collider.js:** kinematic box-сегменты на `#machine-ring` / `#machine-ring-inner` (паттерн `orbit-ring.js`); radius outer **0.34** / inner **0.30** (калибровка ПК).
- **victory-freeze.js:** на `victory` — stopWaves, сброс velocity, sleep; guards в `red-ball` / `floating-cube` / `ball-bat` / `part-entity` / `time-scale`. Кольца крутятся; снепнутые — `_followSlot`.
- **Фикс:** `PxVec3 is not a constructor` — velocity через `{x,y,z}` (ADR-02).
- **collider-bounds-cache.js:** clamp спавна по `_COL`; разведение + отложенный импульс (фикс дёрганья на старте).
- **Quest QA ✅** — пользователь ПК + Quest.
- **coreSpinAxis** — ✅ пользователь.

### Не закрыто

- **Фаза 4** — локации.

**Файлы:** `machine-ring-collider.js`, `victory-freeze.js`, `collider-bounds-cache.js`, `spawn-floating-cubes.js`, `floating-cube.js`, `config.js`, `index.html`, `machine-rig.js`, `room-containment.js`, `room-spawn-utils.js`, `spawn-red-balls.js`, `ball-wave-manager.js`, `red-ball.js`, `ball-bat.js`, `time-scale.js`, `part-entity.js`, `CURRENT_TASK.md`, `PROJECT_LOG*.md`, `PROJECT_START.md`.

**Следующая сессия:** **Фаза 4** (локации).

**Commit сессии:** `f6ac1c5`

---

## Сессия 62 — Меню карточки + план Фазы 4 ✅

**Дата:** 2026-07-08

### Сделано

- **game-menu / config:** карточки сложности — вертикально, `cardWidth: 0.39` (+30%), PNG **666×998**; `cardRotationZ: 0`.
- **Дизайн Фазы 4** (согласовано с пользователем, без кода локаций):
  - Сложность: во всех 5 режимах пустая машина (`preAssembled: []`); разница только шары + мусор; Hardcore сохраняет `ringInnerSpinMult`.
  - Старт эпохи: **Present** (не Future из старого config).
  - Маршрут: Present (снеп A+B) → Past (C+D) → Future (E) → победа; 2+2+1.
  - Прыжок: freeze мира + быстрые кольца + комикс-панель (кнопки эпох) + veil + искры 2–3 с + fade-in.
  - Перенос: до 2 деталей в инвентаре **левого запястья** (HL:Alyx), не снеп на ядре.
  - Пейзаж: Past — дома ниже (×0.4), Future — выше (×2.5); v1 только множитель height.
  - Боковые апгрейд-слоты — отложены.
- **Документация:** план [`.cursor/plans/phase4_locations.plan.md`](../.cursor/plans/phase4_locations.plan.md); ADR-25; `CURRENT_TASK.md`.

### Не закрыто (код)

- Шаги 1–9 плана Фазы 4 — **следующая сессия**.

**Файлы (правки сессии):** `js/config.js`, `js/components/game-menu.js`, `CURRENT_TASK.md`, `PROJECT_LOG*.md`, `PROJECT_START.md`, `.cursor/plans/phase4_locations.plan.md`.

**Следующая сессия:** Фаза 4 — **шаг 1** (config сложность + эпохи).

**Commit сессии:** _(нет — только docs + menu config)_

---

## Сессия 63 — Фаза 4: шаги 1–6 (прыжок во времени) ✅

**Дата:** 2026-07-08

### Сделано

- **Шаг 1–2 (`config.js`):** `preAssembled: []` везде; `locations` — present start, `stageIds` 2+2+1, `sceneryHeightMult`, `progression.route`.
- **Шаг 3 (`location-manager.js`):** API эпох, персистент комнат, `travelTo`, `travel-ready`; `index.html`.
- **Шаг 4:** `stage-snapped` → квота → `travel-ready`; `victory-freeze` + spin boost ×5 (`machine-rig`).
- **Шаг 5 (`travel-ui.js`):** комикс-панель, кнопки ←/→ эпох, `travelTo` по нажатию.
- **Шаг 6:** `menu-world-veil` cover/reveal + `menu-backdrop-vfx` — быстрая орбита искр вокруг `#assembly-hub` на `travel-ready` и при переходе.
- **Фикс:** снепнутая деталь не «зависала» при freeze — `_followSlot` первым в `tick`, `travel-ready` на следующий кадр.
- **QA ✅** (пользователь): чек-листы шагов 1–6, co-rotation fix, искры orbit.

### Не закрыто

- **Шаг 7–8** — `outside-scenery` height mult, HDR/fog по эпохе, спавн по локации, victory-check квота.
- **Шаг 9** — `wrist-inventory.js`.
- Визуально эпохи пока одинаковы (пейзаж/HDR — шаг 7).

**Файлы:** `config.js`, `location-manager.js`, `index.html`, `floating-cube.js`, `victory-freeze.js`, `machine-rig.js`, `travel-ui.js`, `menu-world-veil.js`, `menu-backdrop-vfx.js`, `desktop-ui-cursor.js`, `CURRENT_TASK.md`, `.cursor/plans/phase4_locations.plan.md`.

**Следующая сессия:** Фаза 4 — **шаг 7–8** (пейзаж/HDR/fog + спавн).

**Commit сессии:** _(нет)_

---

## Сессия 64 — Фаза 4: шаги 7–9 (пейзаж, спавн, запястье) ✅

**Дата:** 2026-07-08

### Сделано

- **Шаг 7 (`outside-scenery`):** высота домов × `sceneryHeightMult`; текстуры стен — `locations[].scenery.primaryWalls` / `backgroundWalls` (present-/past-/future-*.jpg). Геометрия — `room.outsideScenery.*Prototypes` без `wall`.
- **Решение пользователя:** купол, туман, HDR **не** меняются по эпохе — отличие только застройка за куполом.
- **Шаг 8:** `spawn-floating-cubes.js` — детали только текущей эпохи; `location-changed` travel → доспавн; `victory-check` — победа только в Future (`unlocks == null`).
- **Шаг 9 (`wrist-inventory.js`):** 2 слота на `#leftHand`, cyan-карманы; store — grip/trigger **up** любой рукой у запястья; retrieve — grip/trigger **down** левой; **любой** `floating-cube` (механизм + мусор); хуки `floating-cube` / `physx-grab`.
- **`machine-manifest.json`:** junk 9 GLB (`01 junk.glb` … `08 junk.glb`, `pulse_capacitor_bank.glb`); fallback в `config.js`.

### Не закрыто / Quest QA

- Калибровка позиций `wristInventory.slots` на Quest (карманы на запястье).
- **Шаг 10** — финальный чек-лист Фазы 4, обновление ADR-25 «Где мы».

**Файлы:** `outside-scenery.js`, `world-hdri-sky.js`, `room-fog-dome.js`, `room-floor-fog.js`, `spawn-floating-cubes.js`, `victory-check.js`, `wrist-inventory.js`, `floating-cube.js`, `physx-grab.js`, `config.js`, `index.html`, `machine-manifest.json`, `assets/textures/outside-buildings/*`, `CURRENT_TASK.md`, `.cursor/plans/phase4_locations.plan.md`.

**Следующая сессия:** Фаза 4 — **шаг 10** (Quest QA + закрытие фазы).

**Commit сессии:** _(нет)_

---

## Сессия 65 — Фаза 4: шаг 10 + wrist-inventory Quest QA ✅

**Дата:** 2026-07-09

### Сделано

- **Wrist-inventory (итерации QA):** store только внутри `pocketRadius`; лучи-притяжение (12, тонкие) — только от **ближайшего** пустого слота; retrieve — **правая** рука (не левая).
- **Визуал карманов:** цилиндры (`assembly-sphere-visual`, preset `wrist`); пустые — белые разряды; занятый слот — голубое мерцание; деталь в кармане — cyan `part-snap-energy` + полупрозрачность.
- **Collider fix:** при store/retrieve — `_forceKinematicFlag` / `_resetKinematicLatch` + полный `physx-body` (mass, emitCollisionEvents) + `object3dset` (повторный store/retrieve без потери коллайдера).
- **Калибровка Quest:** `CONFIG.wristInventory.slots` — пользователь подобрал позиции цилиндров на запястье.
- **Шаг 10:** Quest QA пройден → **Фаза 4 закрыта**.

### Файлы

`wrist-inventory.js`, `assembly-sphere-visual.js`, `part-snap-energy.js`, `part-entity.js`, `floating-cube.js`, `config.js`, `CURRENT_TASK.md`, `PROJECT_LOG.md`, `PROJECT_START.md`, `.cursor/plans/phase4_locations.plan.md`.

### Следующая сессия

**Фаза 5** — опасности, отбивание, таймер петли (мастер-план `tower_stylish_game_c39f4c3b.plan.md`).

**Commit сессии:** _(нет)_

---

## Сессия 66 — Пульт прыжка + живое меню эпох ✅

**Дата:** 2026-07-09

### Сделано

- **`wrist-travel-remote`** на `#rightHand` (позиция как второй карман слева); открытие **левой** рукой; toggle Close.
- **`travel-ui`:** всегда все эпохи; кнопки по `canTravelTo` (живая квота); Close; auto 1–2 раза (first/rebuilt); forced slo-mo вместо victory-freeze на travel.
- **Живая квота:** `stage-unsnapped`; лишняя стадия выше tip эпохи гасит переход; visited — всегда доступны.
- **Цепочка A→E:** каскадный unsnap (снял A → B+ отваливаются).
- **Time-lock:** при прыжке вперёд — стадии эпохи; при победе — все A→E; `physx-grab` не хватает fixed.
- **Quest QA:** пульт, travel туда-обратно, cascade, victory lock.

### Файлы

`wrist-travel-remote.js`, `travel-ui.js`, `location-manager.js`, `floating-cube.js`, `assembly-core.js`, `physx-grab.js`, `time-scale.js`, `victory-freeze.js`, `victory-check.js`, `machine-rig.js`, `assembly-sphere-visual.js`, `config.js`, `index.html`, `CURRENT_TASK.md`, `PROJECT_LOG.md`, `PROJECT_START.md`, `PROJECT_LOG_ARCHIVE.md`.

### Следующая сессия

**Фаза 5** — опасности, таймер петли.

**Commit сессии:** `f368fbf`
