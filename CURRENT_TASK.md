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

**Не делаем в 3.5A:** GLB-детали, смена слотов (→ 3.5B).
**Не трогаем:** `room-floor-fog.js`, `outside-scenery.js`, `assembly-hub` / ядро 2.x.
**Закрытое (Фаза 3):** см. ARCHIVE с.43–44, `PROJECT_START.md` → ARCHIVE-индекс.

---

## Working Context

### ИЗВЕСТНО

- Joint сейчас на `#leftHandCollider` / `#rightHandCollider` в **origin** entity — визуально не tip.
- GLB рук: `assets/models/leftHandLow.glb`, `rightHandLow.glb`; kinematic sphere r=0.05.
- Захват: `physx-grab.js`, D6 softFixed (ADR-03, ADR-14). Бита: dynamic + BAT (ADR-16).
- Фазы 0–3 ✅. DECISIONS LOCK: не kinematic grab биты, не `_touchEl` (ARCHIVE с.20, с.26).

### НЕИЗВЕСТНО

- Оптимальный offset tip для Quest GLB рук (QA после 3.5A.1).

### Следующее действие

Микро-шаг **3.5A.1** — CONFIG + якорь tip на `#leftHand` / `#rightHand`.
