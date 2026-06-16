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

## Сессия 12 — оптимизация инструкций

Сжаты AGENTS.md, CURRENT_TASK.md, PROJECT_LOG.md; ADR вынесены в отдельный раздел;
история сессий — в этот архив. Agent mode: агент правит код сам.
