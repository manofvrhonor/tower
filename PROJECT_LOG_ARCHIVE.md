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
- Временно: `eSIMULATION_SHAPE` на схваченном кубике — проход сквозь купол OK,
  но ломает отбивание других кубиков → привело к ADR-06.
- Открытия: shapes в `el.components['physx-body'].shapes`, `shape.setFlag()`.

---

## Сессия 9 — collision layers ✅

Разведка API: layers через `physx-material`, не `physx-body`.
Ошибка с битовыми масками → краш `-2147483648` → рефакторинг на индексы → ADR-07.
Фантомизация удалена. Тест 1.5 пройден.

---

## Сессия 10 — release → gravity/float ✅

`onGrabReleased()`, containment, `_enterGravityMode` / `_enterFloatMode`.
Quest: тесты 2, 3, 1.5.

---

## Сессия 11 — пол, материалы, lenient ✅

`#floor`, contactbegin → float. `releaseContainment: 'lenient'`.
`GRAVITY_CUBE × DOME` отключена. `floatMaterial` / `gravityMaterial` → ADR-08.
Quest: тест 4. Пауза перед Шагом 6 QA.

---

## Сессия 12 — оптимизация инструкций + QA купола ✅

- Сжаты AGENTS.md, CURRENT_TASK.md, PROJECT_LOG.md; ADR; PROJECT_LOG_ARCHIVE.md.
- QA Этапа 3 в Quest: тесты 1.5–4 и консоль — OK.
- **Тест 1 уточнён:** «изнутри» в старых чек-листах — неточная формулировка.
  Проверка отскока — float-кубик **снаружи** о купол, либо float после подъёма с пола.
- Этап 3 закрыт. Следующий — Этап 4 (time scale).

---

## Сессия 13 — SUPERHOT (timeScale) + slo-mo VFX ✅

- Система `time-scale`, float velocity-scale, `_maintainFloatDrift`, jitter-filter рук.
- VFX: CSS-виньетка, `slowmo-vignette-3d`, `float-motion-trail` (trace 0.4 м).
- ADR-12 зафиксирован. Этап 4 закрыт по геймплею.
- **Открыто на полировку:** VR-виньетка в Quest; trail opacity/visibility.
- AGENTS.md v4: при закрытии сессии агент сам обновляет PROJECT_LOG / ARCHIVE.

---

## Сессия 14 — slo-mo VFX polish (4b) ✅

- **Trail змейка:** фикс. отставание сегментов (`headSkipM + i*trailSpacingM`), живая голова,
  буфер trace 0.5 м, 20 сегментов; fade opacity и blend размера head→tail.
- **Seed хвоста:** `floating-cube._driftDir` (импульс при спавне) — корректное направление
  у каждого куба (fix: все хвосты вверх при чтении getLinearVelocity).
- **Яркость trail:** 10% realtime / 15% slo-mo (`minVisibility` / `maxVisibility`).
- **CSS-виньетка удалена** (`slowmo-vfx.js`); только 3D-quad на камере.
- **VR-виньетка:** не видна в Quest → **отложена на конец разработки** (этап 8).
- Quest QA trail: OK («теперь норм»), но угловатый вид → решено делать **loft** (4c).

---

## Сессия 15 — trail loft + visibility (4c) ✅

- **Loft mesh:** 20 `a-box` → один `BufferGeometry` на куб (14 сечений, квадратный профиль,
  Catmull-Rom, path-aligned frame — без «ленты» при spin).
- **Fade:** 0→1→0 по длине mesh (`headFadeInM` у объекта, `fadePower` к концу); без
  двойного growFactor на material.
- **Deploy:** якорь кончика в мире, голова у куба, пробег `deployLengthM` → follow по path
  (без seed `_driftDir`, без скачков сечений).
- **Grab:** fade-out `grabFadeOutSec` (замороженный path в мире).
- **Config:** `loftSectionCount`, `deployLengthM`, `headFadeInM`, `grabFadeOutSec`, taper tail.
- Quest QA: OK («вроде хорошо»). **Задача 4c закрыта.** Абстракция профиля — отложена.
- **Этап 4 полностью закрыт.** Следующий: **Этап 5 — Цель и победа**.

---

## Сессия 16 — фикс физики кубов на столе ✅

Пред-шаг перед Этапом 5: жалобы на «странную» физику gravity-кубов под куполом.

- **Замирание/виснет в воздухе/на ребре:** причина — `sleepThreshold: 25` (≈ скорость
  7 м/с) усыплял тело в движении. Снижен до `0.01`; damping `0.08/0.12 → 0.02/0.04`;
  `wakeUp()` по контакту gravity-куба. → **ADR-13**.
- **«Резиновый» отскок (особенно ребром) + скольжение стопок:** дефолт солвера 4/1 +
  депенетрация. Добавлены `setSolverIterationCounts(16,4)` + speculative CCD (для всех
  кубов), `gravityMaterial` restitution `0.05` / friction `0.90/0.70`, `contactOffset 0.03`,
  и клэмп скорости gravity-куба в `tick` (`maxLinearSpeed 1.8`, `maxAngularSpeed 8`).
  `setMaxDepenetrationVelocity` в биндинге отсутствует. → **ADR-14**.
- **Захват продавливал стоящий куб:** joint `Fixed → D6 softFixed` (пружинный drive). → **ADR-14**.
- Quest QA: OK («стало хорошо»). Числа подобраны итеративно в Quest.
- Файлы: `js/config.js`, `js/components/floating-cube.js`, `js/components/physx-grab.js`.
