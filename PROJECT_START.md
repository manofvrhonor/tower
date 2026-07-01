---

name: Project Start

alwaysApply: true

---

# PROJECT START — Tower of Time

> Краткий контекст. **Не заменяет** `PROJECT_LOG.md` (ADR) и `PROJECT_LOG_ARCHIVE.md` (сессии).
> Полный лог и архив — grep/read по индексам ниже.

---

## Цель (кратко)

VR **Tower of Time** для Quest 3 (WebXR). Белая комната, orbit-rings, сборка механизма из деталей.
SUPERHOT slo-mo (`timeScale`). **MVP ✅.** Сейчас: **стильная игра** — Фазы 0–3 ✅, **Фаза 3.5A** (магнитные руки).

---

## Стек

| Компонент | Версия / путь |
|---|---|
| A-Frame | 1.7.1, jsDelivr |
| PhysX | `@c-frame/physx@v0.3.0`, явный `wasmUrl` |
| Захват | `js/components/physx-grab.js` |
| Руки | `hand-controls` + GLB, kinematic sphere r=0.05 |
| Код | HTML + `<script>`, `js/config.js`, без сборщиков/TS/npm |

**Отменено (не возвращать):** Cannon, super-hands, A-Frame 1.5, другие CDN, авто-деплой Netlify.

**Тест:** Quest Link + `http://localhost:<порт>`; ПК — serve + консоль.

---

## Где мы

- Этапы 0–8 (MVP) ✅. Стильная игра: Фазы **0–3 ✅** (outside-scenery, floor-fog, HDR sky).
- **Сейчас:** **Фаза 3.5A** — магнитный хват на tip рук (`CURRENT_TASK.md`).
- **Дальше:** 3.5B (GLB-детали, слоты) → Фаза 4–7 (локации, опасности, комикс).
- Мастер-план: `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md`
- **Не делаем:** VR-виньетка slo-mo. **Пропускаем:** захват «отлёт при тряске» (с.29).

---

## ADR-индекс (полные тексты → `PROJECT_LOG.md`)

| ADR | Тема | Когда читать |
|---|---|---|
| 01 | PhysX вместо Cannon | смена физики |
| 02 | PhysX-WASM API | physx-grab, kinematic, enum, vectors |
| 03 | Fixed/D6 joint, dynamic body | захват кубов |
| 04 | Float-кубики, дрейф | floating-cube, spawn |
| 05 | Купол 89 плиток | dome-builder |
| 06–07 | Collision layers | physx-material, physx-grab, маски |
| 08–09 | Float/gravity, release, пол | floating-cube, containment |
| 10 | CDN jsDelivr | index.html, зависимости |
| 12 | timeScale, slo-mo VFX | time-scale, trail |
| 13–14 | Gravity sleep, soft-grab, contact | стопки, physx-grab |
| 15 | Шары, волны WAVE_BALL | red-ball, ball-wave-manager |
| 16 | Бита, in-hand удары | ball-bat, physx-grab |
| 17 | a-box стены, не a-plane | room colliders |
| 18 | Удары в захвате slo-mo | floating-cube, red-ball |
| 19 | Меню, lifecycle, сложность | game-menu, game-lifecycle |
| 20 | room-fog-dome, hdri, collider | room-dome-collider, world-hdri-sky |
| 21 | floor-fog depth-prepass | room-floor-fog |

---

## ARCHIVE-индекс (полный текст → `PROJECT_LOG_ARCHIVE.md`)

| Сессии | Тема | grep-ключи |
|---|---|---|
| 1–4 | до PhysX | Cannon, super-hands |
| 5–7 | PhysX, float | physx-grab, enum, rigidBody |
| 8–12 | купол, layers | dome-builder, collisionLayers |
| 13–16 | slo-mo, trail, gravity fix | time-scale, float-motion-trail |
| 17–21 | победа, шары, бита | victory-ui, red-ball, ball-bat |
| 22 | a-box комната | a-plane, ADR-17 |
| 25–28 | BAT слой, in-hand удары | collider-debug, isWorldSlowMo |
| 29 | меню, сложность | game-menu, HTML overlay |
| 30–31 | купол R=2, HDR, меню VR | room-fog-dome, world-hdri-sky |
| 32–36 | стильная игра, snap | assembly-core, setKinematic |
| 37–41 | cyan-купол, меню, кольца | menu-ui-layout, orbit-ring |
| 42 | outside-scenery | outside-scenery, floorRadius |
| 43–44 | floor-fog, HDR manifest | room-floor-fog, depth-prepass, manifest |

---

## DECISIONS LOCK — не предлагать без явного запроса

Сжатая выжимка. Детали и контекст отката — grep ARCHIVE / ADR.

**Стек и инфра:**
- ❌ Cannon, super-hands, A-Frame 1.5, CDN кроме jsDelivr, TypeScript, сборщики, npm deps
- ❌ HTML-оверлей меню; autospawn на load; авто-деплой Netlify

**PhysX / захват:**
- ❌ Угадывать WASM API по C++ доке; числа вместо enum-обёрток; `PxVec3` / `PxTransform`
- ❌ Жёсткий Fixed joint для захвата (→ D6 softFixed)
- ❌ Kinematic `grabbed` + `setKinematicTarget` на **бите** (с.26 откат — прошивает пьедestal)
- ❌ `_touchEl` / early-grab в `physx-grab` (с.20 — ломает захват кубов)
- ❌ `dynamic→kinematic` без сброса `bodyComp.setKinematic=false` (ADR-02)
- ❌ Переводить схваченный куб в kinematic без причины

**Коллайдеры / комната:**
- ❌ `a-plane` + `physx-body` (с.22)
- ❌ Один static collider на цилиндр/полусферу купола или комнаты (ADR-05, ADR-20)
- ❌ Фантомизация всего shape (`eSIMULATION_SHAPE`) ради пройти сквозь купол
- ❌ Битовые маски в строке `physx-material` (→ индексы слоёв)

**Шары / слои:**
- ❌ BALL × DOME; постоянный homing к центру; WAVE_BALL × купол

**Визуал / VFX:**
- ❌ VR-виньетка slo-mo (снято с бэклога, с.29)
- ❌ «Фикс» floor-fog только `depthTest:true` / opacity (с.43–44 → depth-prepass, ADR-21)
- ❌ Stencil xz-диск для тумана; перебор URL HDR в рантайме (→ manifest)
- ❌ `if (getScale() < 0.999)` для in-hand ударов (→ `isWorldSlowMo()`, ADR-18)

**Закрыто / пропущено:**
- ❌ Захват VR «отлёт при тряске» — пропущено пользователем (с.29)
- ❌ Gravity-кубики на столе только realtime (устарело с.27 — velocity-scale)

**Вместо этого (актуально):**
- ✅ D6 softFixed joint; depth-prepass + discard для floor-fog; a-box стены
- ✅ manifest.json для HDR; dynamic + BAT слой для биты в руке

*При новом отказе/повороте в сессии — добавить одну строку сюда при закрытии.*

---

## Когда ОБЯЗАТЕЛЬНО grep/read ARCHIVE или ADR

1. Меняешь **подход** (не параметр CONFIG): захват, слои, fog, hdri, assembly, menu.
2. Трогаешь файл из «не трогаем» в `CURRENT_TASK.md` или legacy в структуре.
3. Пользователь: «как раньше», «мы пробовали», «верни/убери», закрытая фаза.
4. Идея есть в **DECISIONS LOCK** — не кодить, сослаться на сессию/ADR.
5. Не уверен — **grep**, не додумывай.

---

## Активный бэклог

- **3.5A:** tip offset / joint на tip рук (не origin collider) — `physx-grab`, `#leftHand` / `#rightHand`
- **3.5B:** GLB-детали, позы слотов, призраки
- Слоты wireframe смещены от центра сферы — art-pass в 3.5B

---

## Структура (сжато)

```
Tower/
├── index.html, js/config.js, js/main.js, js/game-lifecycle.js
├── js/components/  physx-grab, floating-cube, ball-bat, assembly-hub, assembly-core,
│                   room-fog-dome, room-floor-fog, world-hdri-sky, outside-scenery,
│                   time-scale, game-menu, victory-ui, …
├── assets/models/  leftHandLow.glb, rightHandLow.glb
├── assets/hdri/    base.jpg, manifest.json
├── AGENTS.md, PROJECT_START.md, CURRENT_TASK.md
├── PROJECT_LOG.md (ADR), PROJECT_LOG_ARCHIVE.md (сессии)
```
