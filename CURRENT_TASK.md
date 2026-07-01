---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: Фаза 3.5A — магнитные руки

**Мастер-план:** `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md` → Фаза 3.5A.

**Цель:** хват «магнитом» на кончиках рук — деталь/бита липнут к tip, не к origin collider.

**Критерий завершения:** в Quest захват куба/биты визуально на кончике пальцев/магнита;
release без регрессий physx-grab; slo-mo без изменений.

### Микро-шаги

- ⬜ **3.5A.1** — якорь магнита (tip offset на руке, CONFIG).
- ⬜ **3.5A.2** — joint / grab point на tip (не `#leftHandCollider` origin).
- ⬜ **3.5A.3** — VFX grip (заряд магнита, опционально).
- ⬜ **3.5A.4** — Quest QA хват + бита.
- ⬜ **git commit** (по запросу, один микро-шаг = один коммит).

**Не делаем в 3.5A:** GLB-детали, смена слотов (→ 3.5B). **Не трогаем:** floor-fog, outside-scenery, ядро 2.x.

---

## Закрыто: Фаза 3 — слои мира ✅ (с.43–44)

| Шаг | Статус |
|-----|--------|
| 3.1 outside-scenery | ✅ desktop + Quest |
| 3.2 room-floor-fog | ✅ depth-prepass, slo-mo, Quest |
| 3.3 world-hdri-sky | ✅ {id}→base, manifest, tint, Quest |
| 3.x QA | ✅ Quest (пользователь) |

---

## Working Context

### ИЗВЕСТНО (с.44)

- **3.2:** `room-floor-fog.js` — 20 слоёв, depth-prepass + discard, `useTimeScale: true`.
- **3.3:** небо — `assets/hdri/{locationId}.*` → `base.*`; список в `manifest.json`; без 404-перебора.
- **3.1:** 7 домов, `floorRadius: 50`. Фаза **2.x ✅**, меню adaptive.
- Коммит floor-fog: `dfeb141`. Следующий — 3.5A.

### НЕИЗВЕСТНО

- Оптимальный offset tip для Quest GLB рук (нужен QA после 3.5A.1).

### РЕШЕНО (с.44)

- Туман на кубах: **depth-prepass**, не `depthTest:true` (см. журнал 3.2 в ARCHIVE).
- HDR: локация не хранит имя файла — только `id`; файлы `future.jpg` / `base.jpg` в `assets/hdri/`.
- `hdriAuto: false` по умолчанию; random только для dev.

## Следующее действие

Микро-шаг **3.5A.1** — CONFIG + якорь tip на `#leftHand` / `#rightHand`.
