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
SUPERHOT slo-mo (`timeScale`). **MVP ✅.** Сейчас: **стильная игра** — Фазы 0–3 ✅, **3.5A ✅**, **Фаза 3.5B** (сборка и детали).

---

## Стек

| Компонент | Версия / путь |
|---|---|
| A-Frame | 1.7.1, `vendor/` |
| PhysX | `@c-frame/physx@v0.3.0`, `vendor/`, wasm локально |
| Захват | `js/components/physx-grab.js` |
| Руки | `hand-controls-local.js` + GLB в `assets/models/` |
| Код | HTML + `<script>`, `js/config.js`, без сборщиков/TS/npm |

**Отменено (не возвращать):** Cannon, super-hands, A-Frame 1.5, другие CDN, авто-деплой Netlify.

**Тест:** Quest Link + `http://localhost:<порт>`; ПК — serve + консоль.

---

## Где мы

- Этапы 0–8 (MVP) ✅. Стильная игра: Фазы **0–3 ✅** (outside-scenery, floor-fog, HDR sky).
- **Сейчас:** **Фаза 3.5B ✅** — commit `ba9ecdd`, push main.
- **Дальше:** git commit 3.5B → **Фаза 4** (локации).
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
| 10 | vendor офлайн | vendor/, hand-controls-local |
| 12 | timeScale, slo-mo VFX | time-scale, trail |
| 13–14 | Gravity sleep, soft-grab, contact | стопки, physx-grab |
| 15 | Шары, волны WAVE_BALL | red-ball, ball-wave-manager |
| 16 | Бита, in-hand удары | ball-bat, physx-grab |
| 17 | a-box стены, не a-plane | room colliders |
| 18 | Удары в захвате slo-mo | floating-cube, red-ball |
| 19 | Меню, lifecycle, сложность | game-menu, game-lifecycle |
| 20 | room-fog-dome, hdri, collider | room-dome-collider, world-hdri-sky |
| 21 | floor-fog depth-prepass | room-floor-fog |
| 22 | body collider рук, grab joint | hand-body-collider, physx-grab |
| 23 | GLB vis + _COL collider | part-entity, parts[].colliderModel |

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
| 46 | 3.5A magnet tip, офлайн vendor | hand-controls-local, hand-magnet-vfx, vendor |
| 47 | 3.5A body collider, grab anchor | hand-body-collider, physx-grab, bodyCollider |
| 48 | 3.5A.4 Fixed joint, snap грань red-tip | physx-grab, config; **не** faceStandoff |
| 49 | 3.5A закрыта: collider якорь, attachAxis −Y, VFX | physx-grab, hand-magnet-vfx, config |
| 50 | 3.5A.5 руки GLB, magnet off; cartoon купол откат | hand GLB, config, room-fog-dome |
| 51 | 3.5B.1 vis + _COL, part-entity, Quest QA | part-entity, glbPartIds, phase_*.glb |
| 52 | 3.5B.2 призраки слотов; restartGame fix | assembly-core, game-lifecycle, victory-ui |
| 53 | 3.5B.3 разряды, пол asphalt, QA ✅ | part-snap-energy, room-fog-dome, part-entity |

---

## DECISIONS LOCK — не предлагать без явного запроса

Сжатая выжимка. Детали и контекст отката — grep ARCHIVE / ADR.

**Стек и инфра:**
- ❌ Cannon, super-hands, A-Frame 1.5, runtime CDN (jsDelivr/aframe.io), TypeScript, сборщики, npm deps
- ❌ HTML-оверлей меню; autospawn на load; авто-деплой Netlify

**PhysX / захват:**
- ❌ Угадывать WASM API по C++ доке; числа вместо enum-обёрток; `PxVec3` / `PxTransform`
- ❌ D6 softFixed для magnet-grab куба (→ Fixed joint, с.48 — резинка в VR)
- ❌ Kinematic `grabbed` + `setKinematicTarget` на **бите** (с.26 откат — прошивает пьедestal)
- ❌ `_touchEl` / early-grab в `physx-grab` (с.20 — ломает захват кубов)
- ❌ `dynamic→kinematic` без сброса `bodyComp.setKinematic=false` (ADR-02)
- ❌ Переводить схваченный куб в kinematic без причины
- ❌ **physx-joint target на `#leftMagnet`** — нет physx-body, хват ломается (с.47)
- ❌ **`faceStandoff` / сдвиг `#*HandCollider` от red-tip** (с.48 откат)
- ❌ Rotation fist collider только через `a-box rotation` без `_bakePart` (с.47)

**Коллайдеры / комната:**
- ❌ `a-plane` + `physx-body` (с.22)
- ❌ Один static collider на цилиндр/полусферу купола или комнаты (ADR-05, ADR-20)
- ❌ Фантомизация всего shape (`eSIMULATION_SHAPE`) ради пройти сквозь купол
- ❌ Битовые маски в строке `physx-material` (→ индексы слоёв)

**Шары / слои:**
- ❌ BALL × DOME; постоянный homing к центру; WAVE_BALL × купол

**Визуал / VFX:**
- ❌ VR-виньетка slo-mo (снято с бэклога, с.29)
- ❌ **cartoon renderStyle на `room-fog-dome`** — откат с.50 (стена/контуры); energy-шейдер
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

- **3.5B.0:** слоты от центра сферы/колец
- **3.5B:** GLB-детали, призраки под форму, состояния snapped/active/broken
- Слоты wireframe смещены от центра сферы — art-pass в 3.5B

---

## Структура (сжато)

```
Tower/
├── index.html, js/config.js, js/main.js, js/game-lifecycle.js
├── js/components/  physx-grab, floating-cube, ball-bat, assembly-hub, assembly-core,
│                   room-fog-dome, room-floor-fog, world-hdri-sky, outside-scenery,
│                   time-scale, game-menu, victory-ui, hand-controls-local,
│                   hand-magnet-vfx, hand-body-collider, …
├── vendor/         aframe-1.7.1.min.js, physx-0.3.0.min.js, physx.release.wasm
├── assets/models/  *HandLow.glb, phase_*.glb + *_COL.glb
├── assets/hdri/    base.jpg, manifest.json
├── AGENTS.md, PROJECT_START.md, CURRENT_TASK.md
├── PROJECT_LOG.md (ADR), PROJECT_LOG_ARCHIVE.md (сессии)
```
