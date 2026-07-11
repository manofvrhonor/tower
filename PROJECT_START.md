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
SUPERHOT slo-mo (`timeScale`). **MVP ✅.** Сейчас: **стильная игра** — Фазы 0–3 ✅, **3.5B ✅**, **Фаза 6** (VR-меню PNG, не QA).

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
- **Сейчас:** **Фаза 5** + boot/start comics ✅ + travel/victory по 1 слайду ✅ (с.79). **Дальше:** PNG эпох 300×90 / QA.
- **Дальше:** [мастер-план](.cursor/plans/tower_stylish_game_c39f4c3b.plan.md) → Фаза 5 / 6.
- Мастер-план: `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md`
- **План Фазы 4:** `.cursor/plans/phase4_locations.plan.md`
- **План таймера:** `.cursor/plans/phase5_loop_timer.plan.md` ✅
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
| 24 | GLB-машина, снеп-цепочка A→E, ring_inner spin | machine-rig, assembly-core, init-session |
| 25 | Фаза 4: эпохи, прыжок, запястье | location-manager, travel-ui, wrist-inventory |

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
| 54 | Фаза 6 меню PNG — veil, искры, карусель (старт) | game-menu, menu-world-veil, menu-backdrop-vfx, assets/ui/menu |
| 55 | Фаза 6 меню — rewrite карусели, hover, искры мир, рамка ⚠️ Quest | game-menu, victory-ui, menu-backdrop-vfx, config |
| 56 | Сложности 5 lvl + machine roll + меню polish ⚠️ core spin | init-session, spawn-floating-cubes, part-entity, game-menu, config, assets/models/machine |
| 57 | GLB-машина + снеп-цепочка A→E, ring_inner ⚠️ Quest QA | machine-rig, assembly-core, init-session, assemblyChain |
| 58 | Фикс снепа co-rotation (follow-slot, force eKINEMATIC), ring reverse | floating-cube, config; **не** DOM-реперент детали |
| 59 | position A–E, containment split, hand↔ball, machine _COL ⚠️ ring collider | init-session, room-containment, machine-rig, red-ball; commit cd7c328 |
| 60 | ring _COL откат, WAVE_BALL machine, convex-пробка | machine-rig; кольца без PhysX → сегменты |
| 61 | Сегменты колец + victory-freeze + Quest QA ✅ | machine-ring-collider, victory-freeze, config |
| 62 | Меню карточки + план Фазы 4 (дизайн, ADR-25) | game-menu, config, phase4_locations.plan |
| 63 | Фаза 4 шаги 1–6: travel-ready, travel-ui, veil | location-manager, travel-ui, victory-freeze, menu-backdrop-vfx |
| 64 | Фаза 4 шаги 7–9: пейзаж домов, spawn, wrist ⚠️ QA | outside-scenery, spawn-floating-cubes, wrist-inventory, machine-manifest |
| 65 | Фаза 4 шаг 10 + wrist QA ✅: цилиндры, store/retrieve, collider fix | wrist-inventory, assembly-sphere-visual, part-snap-energy, config |
| 66 | Пульт прыжка + живое меню эпох, cascade/time-lock, Quest QA ✅ | wrist-travel-remote, travel-ui, location-manager, floating-cube |
| 67 | Пер-локационные пулы, stash/restore, победа/квота от машины, bat off ✅ | spawn-floating-cubes, init-session, location-manager, victory-check |
| 68 | Фаза 5 старт: cyan-шары, пулы, призрак next-slot, deflect; план таймера | red-ball, init-session, assembly-core, floating-cube, phase5_loop_timer |
| 69 | Таймер петли + defeat + wrist hide в меню, Quest QA ✅ | loop-timer, victory-ui, victory-freeze, wrist-inventory, wrist-travel-remote |
| 70 | PNG end/travel: таймлайн, без text-overlay; comic не в меню | travel-ui, victory-ui, assets/ui/travel, assets/ui/end |
| 71 | Wrist home/gear, always-open, Quest crash fix, menu ×2 ✅ | travel-ui, wrist-travel-remote, config, aaf467c |
| 72 | hazardLevel → число/скорость шаров, Quest QA ✅ | ball-wave-manager, red-ball, config |
| 73 | comic-slides boot/start/travel/victory + hazardLevel + marker | comic-slides, game-menu, assets/ui/comic |
| 74 | boot-intro + UV-орб в рамке комикса (Phase Collapse) | boot-intro, boot-energy-sphere, config |
| 75 | boot polish: sway, орб UV-radius, без flash/darkOut | boot-intro, boot-energy-sphere, config |
| 76 | boot back-cards + polish (depth, delays, sway fade) | boot-intro, config, boot/logo assets |
| 77 | menu restart-boot button (слева от gear) | game-menu, boot-intro, config, icon_restart |
| 78 | start comic: waist fly + cross, 7 PNG ✅ | comic-slides, game-menu, config, start/01–07 |
| 79 | travel/victory comics → 1 слайд + финальный арт ✅ | config sequences, comic travel/victory PNG |

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

**Меню / UI (Фаза 6):**
- ❌ `inactiveOpacity < 1` для боковых карточек карусели — dim множителем цвета, opacity 1 (с.54–55)
- ❌ `victory-ui-clickable` на скрытой плашке победы — THREE-raycaster игнорирует `visible`, ломает hover меню (с.55)
- ❌ `scene.addEventListener('tick')` для анимации меню — Event, не `(time, delta)`; `tick()` компонента (с.55)
- ❌ Огонёк рамки отдельным mesh за PNG карточки — не виден; canvas рамки (с.55)
- ❌ Canvas/текст-оверлей поверх PNG-кнопок travel/end — двойной текст (с.70)
- ❌ Comic-кадры внутри travel-меню — только преамбула до меню (с.70)
- ❌ Называть API `comic-slides` методом `play()` — lifecycle A-Frame (с.73 → `playSequence`)
- ❌ Пауза между улётом и влётом следующей start-карточки — cross параллельно (с.78)
- ❌ Boot-орб как 3D ShaderMaterial-сфера + clippingPlanes/matrix-mask «в рамку комикса» — не режет; **→ плоскость = размер комикса + круг в UV** (`boot-energy-sphere`, с.74)
- ❌ Рост boot-орба через `scale` entity при R>1 заранее — круг сразу «срезан»; **→ `setOrbRadius` в UV** (полный круг пока R≤1, обрезка у края картинки, с.75)
- ❌ Пересоздавать travel PNG-плоскости / `texture.dispose()` на каждый open/close — Quest Link crash (с.71)

**Сборка / машина (Фаза 3.5B, с.57 ADR-24):**
- ❌ Возвращать cyan `orbit-ring` как зону сборки/коллизию — заменено GLB-машиной (`machine-rig`)
- ❌ Случайные слоты «на столе» / `sideCount` для сборки — снеп-цепочка A→E (`assemblyChain`)
- ❌ Крутить physx-body core напрямую — whole-assembly rotation; **схема** (`#assembly-core`, не physx-body) реперентится под `#machine-ring-inner`
- ❌ **DOM-реперент снепнутой ДЕТАЛИ под `#assembly-core`** — рушит physx-тело (`disconnectedCallback` → «table index out of bounds», деталь теряет kinematic и улетает). Co-rotation детали: kinematic + `_followSlot` (поза слота каждый кадр), с.58 ADR-24 v2
- ❌ **Convex `_COL.glb` на `#machine-ring` / `#machine-ring-inner`** — сплошая hull-пробка, блокирует центр; не static/kinematic sync (с.59–60). **→ сегменты** (`orbit-ring`), ADR-24 с.60

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
