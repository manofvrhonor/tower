---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: PNG эпох / QA

**Статус:** с.78 закрыта — start comic ✅ (7 кадров, сцена ок). Дальше: PNG эпох.

### Working Context

- Start comic ✅: sparks → 7 PNG из пояса, cross без паузы, trigger скип.
- `CONFIG.comic.startAnim` + `sequences.start` 01–07.

### Чек-лист

1. [ ] PNG эпох 300×90 (если ещё не заменены)
2. [ ] Quest QA jump/victory/boot/start (по желанию)

### Не трогать без запроса

- Бита / `ball-bat` (выключена).
- Canvas-текст поверх PNG-кнопок travel/end.
- Пересоздание travel PNG на каждый open/close (с.71).
- Метод comic/boot не называть `play()` (lifecycle A-Frame).
- 3D-сфера + clip/mask для boot-орба (с.74).
- Рост орба через scale entity с R>1 заранее (с.75 — только `setOrbRadius`).
- Пауза между улётом и влётом start-карточек (с.78).
