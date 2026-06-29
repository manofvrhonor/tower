---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: «Стильная игра» — Фаза 1.4 (слом снепа при ударе)

**Мастер-план:** `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md` (фазы 0–7).
> ⚠️ Файл лежит в **скрытой** папке `.cursor/`. Поиск по маске (`.cursor/plans/*`,
> `**/*.plan.md`) её часто НЕ обходит (dot-папка) и возвращает «0 файлов» —
> это не значит, что плана нет. Открывать по полному пути выше.

**Цель 1.4:** контакт опасного объекта (красный шар / WAVE_BALL) со **снепнутой** деталью
→ `type: dynamic` + импульс `breakImpulse`, состояние float/gravity, слот освобождается.

**Критерий завершения:** шар (или бита/куб в realtime — уточнить) сбивает снепнутую деталь
с ядра; слот снова свободен (призрак виден); деталь падает/улетает; можно снова снепнуть
или подобрать.

### Микро-шаги

- ⬜ **1.4.1 — точка входа:** в `floating-cube.js` слушать `contactbegin` (или хук из
  существующего `_onContactBegin`) — только state `snapped` + контакт с `red-ball` / WAVE_BALL.
- ⬜ **1.4.2 — слом:** `_breakSnapFromHit()` — `releaseSlot()`, `type: dynamic`,
  `_resetKinematicLatch()`, импульс из `CONFIG.assembly.breakImpulse`, state → float или gravity
  (по containment, как при обычном release).
- ⬜ **Quest QA:** шар волны сбивает снепнутую деталь; slo-mo; слот освобождается;
  повторный снеп работает (защёлка kinematic).

### После 1.4

- ⬜ **1.5 — победа по слотам:** `victory-check.js` — все слоты механизма заполнены →
  `mechanism-complete`/`victory`; `ghost-tower-hint` убрать или заменить слотами.

## Working Context

### ИЗВЕСТНО (Фаза 1, с.32–33)

- Снеп = kinematic-lock; поза из `object3D` (ADR-02 п.7).
- `assembly-core`: `occupySlot`/`releaseSlot`/`findFreeSlotNear`.
- `floating-cube`: `_snapToSlot`, `_unsnapFromSlot`, `_resetKinematicLatch`.
- Слой снепнутой детали — как у обычного куба (после grab → `GRABBED_CUBE`); сталкивается
  с BALL/WAVE_BALL → слом 1.4 должен сработать.
- `CONFIG.assembly.breakImpulse` — уже в config (Фаза 0), не подключён к рантайму.

### ИЗВЕСТНО (Этап 6, с.35 ✅)

- Волны «атомы времени» включены (`waves.enabled=true`), Quest QA ✅.
- `ball-wave-manager.js`, слой WAVE_BALL, ADR-15 обновлён.

### НЕИЗВЕСТНО / РЕШИТЬ ПОТОМ

- Ломает ли удар **только** шар, или также grabbed-куб/бита в realtime (v1 — шар).
- Допуск снепа `snapPosTolerance=0.05` — при необходимости поднять после QA 1.4.

### РЕШЕНО

- v1 слома: контакт **шара** (BALL или WAVE_BALL) со снепнутой деталью.
- Серый мусор и неснепнутые кубы — без изменений (уже бьются шаром как раньше).

## Файлы

- **Трогаем:** `floating-cube.js` (1.4), возможно минимально `red-ball.js` (если нужен
  явный callback — по умолчанию достаточно contactbegin на кубе).
- **Не трогаем без нужды:** `physx-grab.js`, `ball-wave-manager.js`, купол/локации.

## Подводные камни

- Повторный снеп после слома — обязательно `_resetKinematicLatch()` (ADR-02 п.7).
- В slo-mo импульс — world-space с учётом `timeScale` (как cube-hit у шара).
- Kinematic snapped + dynamic ball — contactbegin должен генериться (проверено для grab).

## Следующее действие

Реализовать **1.4.1–1.4.2** в `floating-cube.js` — один микро-шаг, один коммит.
