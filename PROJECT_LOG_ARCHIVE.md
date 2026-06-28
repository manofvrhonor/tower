# PROJECT LOG — АРХИВ СЕССИЙ

> Хронология работ. Архитектурные «почему» — в `PROJECT_LOG.md` → **ADR**.
> Не прикладывать целиком при старте сессии; читать по необходимости.

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

**Следующая сессия:** парящий стол + купол.

---

## Сессия 24 — pedestal-builder, red-ball, collider-debug (QA частично)

- **pedestal-builder** вместо convex hull; квадратная крышка 0.6×0.6 на круге r=0.3 —
  **не закрыто** (запинание). Диагностика: бита на столе — отдельный collider.
- **red-ball:** `_isNearVisualCubeHit`, pending/hold, slo-mo ghost-boost. Slo-mo QA ❌.
- **collider-debug-viz** прототип (один розовый цвет).
- **Файлы:** `pedestal-builder.js`, `red-ball.js`, `collider-debug-viz.js`, `config.js`,
  `index.html`, `dome-builder.js`.
- **Следующая сессия (25):** wireframe по типам; парящий стол + купол; комната-купол + skybox.
