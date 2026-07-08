---
name: Фаза 4 локации
overview: "План микро-шагов Фазы 4: унификация сложности, три эпохи (Present→Past→Future, 2+2+1 детали), кинематографичный прыжок с комикс-панелью, разная высота домов, инвентарь на левом запястье (2 слота). Без боковых апгрейд-слотов."
todos:
  - id: step1-difficulty
    content: "Шаг 1: config difficulties — preAssembled [] везде, комментарии, hardcore ringInnerSpinMult"
    status: completed
  - id: step2-locations-config
    content: "Шаг 2: config locations — present start, stageIds 2+2+1, sceneryHeightMult, progression"
    status: completed
  - id: step3-location-manager
    content: "Шаг 3: js/location-manager.js — API, персистент комнат, index.html"
    status: completed
  - id: step4-freeze-spin
    content: "Шаг 4: travel-ready freeze + machine-rig spin boost"
    status: completed
  - id: step5-travel-ui
    content: "Шаг 5: travel-ui.js — комикс-панель, кнопки эпох"
    status: completed
  - id: step6-travel-vfx
    content: "Шаг 6: veil + menu-backdrop-vfx для перехода"
    status: completed
  - id: step7-scenery-hdri-fog
    content: "Шаг 7: outside-scenery height mult, hdri + fogTint по локации"
    status: completed
  - id: step8-spawn-quota
    content: "Шаг 8: spawn по эпохе, victory-check квота/travel-ready"
    status: completed
  - id: step9-wrist-inventory
    content: "Шаг 9: wrist-inventory.js — 2 слота на leftHand (HL:Alyx)"
    status: completed
  - id: step10-docs-qa
    content: "Шаг 10: CURRENT_TASK.md, чек-лист ПК/Quest"
    status: completed
---

# Фаза 4 — план реализации

> Зафиксировано на с.62 (2026-07-08). Следующая сессия — шаги 1–8 (минимальный срез), шаг 9 — по времени.

## Зафиксированные решения

| Тема | Решение |
|---|---|
| Сложность | Во всех 5 режимах `preAssembled: []`; разница только `ballCount`, `junkCount`; Hardcore сохраняет `ringInnerSpinMult: 2.2` |
| Старт | **Настоящее** (`present`, `start: true`) |
| Маршрут | Present (2 дет.) → Past (2 дет.) → Future (1 дет.) → победа |
| Прыжок | Заморозка мира + быстрые кольца + комикс-панель (кнопки влево/вправо) + veil + искры 2–3 с + fade-in 1–2 с |
| Груз | До 2 деталей в инвентаре **левого запястья** (HL:Alyx: поднёс → отпустил grip / навёл → grip) |
| Пейзаж | Past — дома ниже (~×0.4), Future — выше (~×2.5), Present — как сейчас |
| Позже | Боковые апгрейд-слоты — **не делаем** |
| Запрет | Convex `_COL` на кольцах (DECISIONS LOCK) |

## Связь эпох с цепочкой A→E

- **Present:** стадии `A`, `B`; порог прыжка = 2
- **Past:** стадии `C`, `D`; `A`,`B` остаются на машине; порог = 2
- **Future:** стадия `E`; порог = 1 → `victory`

Старые `CONFIG.parts` / `mechanisms` — не подключаем в рантайм v1. Источник истины: `assemblyChain` + `locations`.

## Микро-шаги (один шаг = один коммит)

1. **Сложность** — `js/config.js`: `preAssembled: []` везде
2. **Config эпох** — `present` start, `stageIds`, `partsToComplete`, `sceneryHeightMult`
3. **`location-manager.js`** — API, персистент, `index.html`
4. **Freeze + spin boost** — `travel-ready`, `victory-freeze`, `machine-rig`
5. **`travel-ui.js`** — комикс-панель, кнопки эпох
6. **VFX перехода** — `menu-world-veil`, `menu-backdrop-vfx`
7. **Пейзаж/HDR/fog** — `outside-scenery`, `world-hdri-sky`, `room-floor-fog`
8. **Спавн + квота** — `spawn-floating-cubes`, `victory-check`
9. **`wrist-inventory.js`** — 2 слота на `#leftHand`
10. **Документы + Quest QA**

## Минимальный срез следующей сессии

Шаги **1–8**. Инвентарь (9) — если останется время или отдельная сессия.

## Ассеты (пользователь)

- `assets/ui/travel/` — PNG комикс + кнопки эпох
- `assets/hdri/present.*`, `past.*`, `future.*` — опционально (fallback `base.*`)

## Чек-лист готовности Фазы 4

- [x] Все режимы: пустая машина, разное число шаров/мусора
- [x] Старт в Present
- [x] Снеп A+B → панель → Past → C+D → Future → E → победа
- [x] Дома: Past низкие, Future высокие
- [x] Прыжок: пауза, быстрые кольца, комикс, искры, fade-in
- [x] Wrist-inventory: store/retrieve, цилиндры, Quest QA (с.65)
- [x] F12 без красных; Quest QA

Полная версия с диаграммами — в ADR-25 (`PROJECT_LOG.md`).
