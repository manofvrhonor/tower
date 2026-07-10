---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: Start comic-карточки

**Статус:** с.77 закрыта — boot + кнопка restart в меню. Дальше: start.

### Working Context

- Boot ✅ (с.74–77): `boot-intro` + `boot-energy-sphere` + restart из меню.
- Меню: `icon_restart_on/off` слева от шестерёнки → `boot-intro.replayIntro()`.
- comic-slides: sequences `start` / travel / victory — нужна доработка **start**-карточек.

### Чек-лист

1. [ ] Start comic-карточки (арт / таймлайн / интеграция)
2. [ ] PNG эпох 300×90 (если ещё не заменены)
3. [ ] Quest QA jump+victory / boot (по желанию)

### Не трогать без запроса

- Бита / `ball-bat` (выключена).
- Canvas-текст поверх PNG-кнопок travel/end.
- Пересоздание travel PNG на каждый open/close (с.71).
- Метод comic/boot не называть `play()` (lifecycle A-Frame).
- 3D-сфера + clip/mask для boot-орба (с.74).
- Рост орба через scale entity с R>1 заранее (с.75 — только `setOrbRadius`).
