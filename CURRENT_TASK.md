---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: (следующая)

**Статус:** с.73 закрыта — hazardLevel + comic-slides (boot/start/travel/victory).

### Working Context

- hazardLevel → шары ✅ (с.72–73).
- Comic: `comic-slides.js` + `CONFIG.comic.slideDurationMs`; PNG в `assets/ui/comic/`.
- Маркер «вы тут» ездит по X над текущей эпохой ✅.
- Quest QA comic/start — частично (светлые stubs); полный прогон travel/victory — по желанию.

### Чек-лист (следующая сессия)

1. [ ] PNG эпох 300×90 (если ещё не заменены)
2. [ ] Арт вместо stub comic (по папкам `assets/ui/comic/`)
3. [ ] Quest QA: jump comics + victory comics

### Не трогать без запроса

- Бита / `ball-bat` (выключена).
- Canvas-текст поверх PNG-кнопок travel/end.
- Пересоздание travel PNG на каждый open/close (с.71).
- Метод компонента comic не называть `play()` (lifecycle A-Frame).
