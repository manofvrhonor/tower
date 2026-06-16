# PROJECT LOG — TOWER OF TIME

> Долгая память проекта. **ADR** — архитектурные решения и «почему так» (читать перед правками физики).
> История сессий — `PROJECT_LOG_ARCHIVE.md`.
> При старте: `AGENTS.md` + этот файл (разделы ADR и «Где мы») + `CURRENT_TASK.md`.

---

## ГЛАВНАЯ ЦЕЛЬ (кратко)

VR **Tower of Time** для Quest 3 (WebXR). Белая комната 3×3×3 м, стол с куполом.
Плавающие кубики (цветные + серые) → сборка башни. Красные шары — опасность.
Замедление времени (SUPERHOT): `timeScale` 0.05↔1.0 для скриптового движения;
физика рук и стола — реальное время. MVP: друг проходит за 2–5 мин без инструкций.

**Не-цели:** уровни, меню, сохранения, AAA-графика, мультиплеер.

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

**Не делать:** угадывать API по C++ доке; передавать числа вместо enum-обёрток.

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

### ADR-07: Реестр collision layers (индексы 0..6)

**Решение:** `CONFIG.collisionLayers` хранит **индексы**, не битовые маски.
Биндинг в `physx-material` принимает CSV индексов и сам делает `1 << index`.
В `physx-grab.js` (PxFilterData напрямую) — маски вручную: `(1 << i) >>> 0`.

| Слой | Idx | Назначение | Ключевые коллизии |
|---|---|---|---|
| WORLD | 0 | пол, стены, пьедестал | дефолт physx (word0=1) |
| DOME | 1 | 89 плиток | FLOAT_CUBE, BALL — **не** GRAVITY_CUBE |
| FLOAT_CUBE | 2 | state float | WORLD, DOME, все кубики, BALL |
| GRAVITY_CUBE | 3 | state gravity | WORLD, кубики, BALL — **не DOME** |
| GRABBED_CUBE | 4 | в руке | WORLD, кубики, BALL — **не DOME** |
| BALL | 5 | красные шары (Этап 6) | резерв |
| HAND | 6 | контроллеры | резерв |

**Отключённые пары (осознанно):** `GRABBED_CUBE × DOME`, `GRAVITY_CUBE × DOME`.
Float снаружи — купол барьер; gravity на столе — может выпасть за край.

**Причина:** передача готовой маски 63 в атрибут → биндинг делал `1 << 63` → краш
`-2147483648` (int32 overflow).

**Не делать:** битовые маски в строке `physx-material`; `(1 << i)` без `>>> 0`.

**Потребители:** `dome-builder.js`, `spawn-floating-cubes.js`, `physx-grab.js`.

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

## ДОРОЖНАЯ КАРТА

| Этап | Название | Статус |
|---|---|---|
| 0 | Каркас + деплой | ✅ |
| 1 | Стол и хватание | ✅ |
| 2 | Плавающие кубики | ✅ |
| 3 | Купол над столом | ⏳ ~95% (QA, шаг 6) |
| 4 | Замедление времени (SUPERHOT) | план |
| 5 | Цель и победа | план |
| 6 | Красные шары | план |
| 7 | Предмет для отбивания | план |
| 8 | Полировка | план |

---

## ГДЕ МЫ СЕЙЧАС

- Этапы 0–2 ✅. Этап 3 ~95%: купол, layers, release gravity/float, пол→облако, деревянная физика.
- **Следующее:** Шаг 6 QA (`CURRENT_TASK.md`) → Этап 4 (time scale).
- Стек стабилен: PhysX 0.3.0 + physx-grab. Тесты — localhost + Quest Link.

---

## ИЗВЕСТНЫЕ ПРОБЛЕМЫ

- **Руки без VPN** — решено локальными GLB (`assets/models/`).
- **`extensionPageScript.js` в Network** — расширение браузера, игнорировать.
- **Гонка spawn float** — ADR-11.

---

## СТРУКТУРА ПРОЕКТА

```
Tower/
├── index.html
├── js/config.js, main.js, spawn-floating-cubes.js
├── js/components/  physx-grab, floating-cube, dome-builder
├── assets/models/  leftHandLow.glb, rightHandLow.glb
├── AGENTS.md, CURRENT_TASK.md, PROJECT_LOG.md, PROJECT_LOG_ARCHIVE.md
```

---

## ЧТО СДЕЛАНО (сводка)

- **0–1:** комната, PhysX, руки, grab.
- **2:** `floating-cube.js`, 11 кубиков, дрейф (ADR-04).
- **3:** визуал + 89 плиток (ADR-05), layers (ADR-06–07), release/float (ADR-08),
  пол→float (ADR-09), lenient containment, float/gravity материалы.

Детали по сессиям — `PROJECT_LOG_ARCHIVE.md`.
