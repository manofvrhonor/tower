---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: Фаза 5 — таймер петли

**Статус:** план готов, код не начат. **С.68 закрыта** (cyan-шары, пулы, призрак, deflect).

**План следующей сессии:** [`.cursor/plans/phase5_loop_timer.plan.md`](.cursor/plans/phase5_loop_timer.plan.md)

**Мастер-план:** [`.cursor/plans/tower_stylish_game_c39f4c3b.plan.md`](.cursor/plans/tower_stylish_game_c39f4c3b.plan.md) → § «Фаза 5».

### Старт сессии

1. Прочитать план `phase5_loop_timer.plan.md`.
2. Микро-шаги: config → `loop-timer.js` → defeat UI → QA.

### Закрыто с.68 (до таймера)

- [x] Cyan-шары + fade in/out (spawn 6.5 м, outStart 3 м)
- [x] Рука / grip → redirect как бита (детали/мусор)
- [x] junk/decoy per location по сложности (4+3 / 6+4 / 8+5)
- [x] Призрак схемы: только следующий слот
- [x] План таймера петли зафиксирован

### Дальше (после таймера)

- [ ] hazardLevel → число/скорость шаров
- [ ] (бита — только по явному запросу)

### Не трогать без запроса

- Бита / `ball-bat` (выключена).

### Не делать

- Convex `_COL` на кольцах (DECISIONS LOCK).
- Боковые апгрейд-слоты (ADR-25, v1).
