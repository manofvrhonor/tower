---
name: Current Task
alwaysApply: true
---

# CURRENT_TASK.md — Текущая задача

## Задача 3 — Купол над столом

**Статус:** шаги 1–5 закрыты и проверены в Quest. Остался **Шаг 6** — формальный QA.
**Этап 3** в `PROJECT_LOG.md`: ~95%.

---

## Шаг 6 — QA и закрытие ← **сейчас**

Прогнать в Quest (после паузы):

1. **Тест 1** — float-кубик отскакивает от купола изнутри.
2. **Тест 1.5** — схваченным кубиком отбить другой (не проходит насквозь).
3. **Тест 2** — схватить снаружи, протащить через стенку, release внутри → падает на пьедестал.
4. **Тест 3** — с пьедестала вытащить наружу, release → снова float.
5. **Тест 4** — gravity-кубик с пола → возврат в облако.
6. Консоль — без ошибок PhysX.

**После QA:** Этап 3 → ✅ в `PROJECT_LOG.md`, обнулить этот файл, начать **Этап 4** (time scale).

---

## Working Context

**Файлы:**
- `js/config.js` — dome, collisionLayers, floatMaterial/gravityMaterial, pedestal
- `js/components/dome-builder.js` — 89 плиток, слой DOME
- `js/components/floating-cube.js` — float/gravity, release, floor, containment
- `js/components/physx-grab.js` — grab/release → `onGrabReleased()`
- `js/spawn-floating-cubes.js` — спавн 11 кубиков
- `index.html` — визуал купола, `#floor`, `#pedestal`

**Архитектура (подробно):** `PROJECT_LOG.md` → раздел **ADR** (купол, layers, материалы, containment).

**Не входит в задачу 3:** красные шары, цветные свойства кубиков, звуки, персистентность башни.
