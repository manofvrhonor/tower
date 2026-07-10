---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: travel wrist — home/gear + always-open

**Статус:** пульт открывает меню в любой момент игры. Ждём QA.

### Working Context

- Пульт открывает меню в любой момент после Start.
- **Фикс Quest Link crash:** travel-ui больше не уничтожает/перезагружает PNG на каждый open/close.
- Слоты эпох 300×90 — PNG пользователь переделает.
- Дальше: `hazardLevel` → шары; comic-преамбула.

### Чек-лист

1. [ ] Quest: открыть/закрыть wrist-меню 3+ раз подряд — Link не падает
2. [ ] Пульт сразу после Start; домик/шестерёнка работают
3. [ ] Эпохи disabled до unlock
4. [ ] hazardLevel → число/скорость шаров
5. [ ] Comic-преамбула → travel-меню

### Не трогать без запроса

- Бита / `ball-bat` (выключена).
- Canvas-текст поверх PNG-кнопок travel/end (подписи эпох).
