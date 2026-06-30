---

name: Current Task

alwaysApply: true

---

# CURRENT_TASK.md — Текущая задача

## Задача: Фаза 3 — слои мира (глубина VR)

**Мастер-план:** `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md` → Фаза 3.

**Цель:** три визуальных слоя за cyan-куполом — застройка, туман у пола, согласованный HDR-фон.

**Критерий завершения фазы:** в Quest видны дома за куполом, туман у пола снаружи,
HDR не конфликтует с `room-fog-dome`; без регрессий ядра 2.x и меню.

### Микро-шаги

- ⬜ **3.1 — outside-scenery.js** — дома-заглушки по кругу **за** `room.fogDome`.
- ⬜ **3.2 — туман у пола** — плоскость/объём снаружи купола (отдельный компонент или расширение fog).
- ⬜ **3.3 — HDR / небо** — довести `world-hdri-sky` под локации (CONFIG, тон с cyan-куполом).
- ⬜ **3.x QA** — ПК → Quest (визуал, FPS, нет красных в консоли).
- ⬜ **git commit** (по запросу, один микро-шаг = один коммит).

---

### 3.1 — outside-scenery.js (первый шаг следующей сессии)

**Сделать:**

1. Новый компонент `js/components/outside-scenery.js`.
2. Секция `CONFIG.room.outsideScenery` — count, radius, box sizes/colors, опционально `model` (null = бокс).
3. Расстановка по окружности **снаружи** `room.fogDome.radius + margin`.
4. Только визуал (без PhysX на первом шаге).
5. Подключить в `index.html` до `<a-scene>`.

**Критерий 3.1:** из центра комнаты видны силуэты домов за cyan-куполом; F5 без ошибок.

**Не трогаем:** `assembly-hub`, `orbit-ring`, `room-fog-dome` shader, victory-ui.

---

### 3.2 — туман у пола (после 3.1)

**Сделать:**

1. Компонент или блок в `room-fog-dome` / отдельный файл — туман **вне** верхней полусферы, у `#floor`.
2. Параметры в `CONFIG.room.floorFog` (цвет, opacity, радиус, высота).
3. `depthWrite: false`, renderOrder ниже ядра, выше HDR.

**Критерий 3.2:** у пола за куполом мягкая дымка, не перекрывает ядро и меню.

---

### 3.3 — HDR / world-hdri-sky (после 3.2)

**Сделать:**

1. Поля в `CONFIG.room.sky` / `CONFIG.locations[*].hdri` (пока одна локация — future).
2. Согласовать яркость/тон с `room.fogDome` (не «два разных мира»).
3. Документировать в config, какой файл класть в `assets/hdri/`.

**Критерий 3.3:** смена HDR через config без правки компонента; Quest без мерцания.

**Не делаем в Фазе 3:** `location-manager` (Фаза 4), таймер, intro-comic.

---

## Working Context

### ИЗВЕСТНО

- Фаза **2.x ✅** (с.40): сфера, cyan-кольца, float-inside, hardcore-слоты, ПК + Quest QA.
- Коммит **`9205f2c`** — ядро 2.x (после закрытия сессии).
- `world-hdri-sky.js` уже есть; random HDR из `assets/hdri/`.
- `room-fog-dome` — cyan полусфера + пол; radius 2.0 м.

### НЕИЗВЕСТНО

- Сколько домов без просадки FPS на Quest 3.
- Отдельный mesh тумана vs шейдер на полу.

### РЕШЕНО (дизайн)

- Фаза 3 — **только визуал слоёв**; геймплей локаций — Фаза 4.
- Дома v1 — **примитивы**; GLB через `CONFIG` позже.

## Файлы задачи

- **Трогаем:** новый `outside-scenery.js`, `config.js`, `index.html`; возможно `world-hdri-sky.js`, `room-fog-dome.js`.
- **Не трогаем без нужды:** ядро 2.x, `physx-grab`, `game-menu` layout, `victory-ui`.

## Следующее действие

Микро-шаг **3.1** — `outside-scenery.js` + CONFIG + index.html → F5 → чек «дома за куполом».
