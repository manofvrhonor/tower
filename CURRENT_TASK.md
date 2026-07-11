---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: Quest QA маршрутов L1–L5

**Статус:** с.80 закрыта — Difficulty A–F + C1–C3 + routes + tip без коллизий ✅. Дальше: Quest QA.

### Working Context

- Ось A→F; ветки C1–C3 (дети C, диск XY, крутятся со спином C).
- Routes L1–L5; spawn ≠ quota. Tip `#*HandCollider` — только якорь; захват с HandBody.

### Чек-лист

1. [ ] Quest QA: Easy→Hardcore (без тупика; C* после C; F после E)
2. [ ] Захват кулаком + магнит/joint ок
3. [ ] Подкрутить radius/углы C1–C3 при необходимости

### Не трогать без запроса

- Бита / `ball-bat` (выключена).
- Canvas-текст поверх PNG-кнопок travel/end.
- Пересоздание travel PNG на каждый open/close (с.71).
- Метод comic/boot не называть `play()` (lifecycle A-Frame).
- 3D-сфера + clip/mask для boot-орба (с.74).
- Рост орба через scale entity с R>1 заранее (с.75 — только `setOrbRadius`).
- Пауза между улётом и влётом start-карточек (с.78).
- Ролл пулов / decoy под C* (replay v2).
