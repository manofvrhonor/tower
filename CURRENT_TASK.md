---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: Start comic-карточки

**Статус:** с.76 закрыта — boot polish + задние карточки. Дальше: start.

### Working Context

- Boot ✅ (с.74–76): `boot-intro` + `boot-energy-sphere`.
- Поток: dark → sparks 5с → bg + backL/R → орб UV-radius → logo+sway → hold → меню.
- Задние: `logo_bg_back` / `logo_bg_back2`, 84%, старт 90°, дрейф L↑/R↓, depthWrite у основного.
- comic-slides: sequences `start` / travel / victory уже есть; нужна доработка **start**-карточек.

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
