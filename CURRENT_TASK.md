---
name: Current Task
alwaysApply: true
---

# CURRENT_TASK.md — Текущая задача

## Задача 4c — Trail loft (сплошной хвост по форме объекта)

**Задача 4b** ✅ (сессия 14). **Этап 4** по геймплею ✅; VFX trail — осталось loft.
**Этап 5** (победа) — после закрытия 4c.

---

## Цель

Заменить дискретные `a-box` сегменты на **один loft/sweep mesh** вдоль trace — сплошной хвост, повторяющий **профиль сечения объекта** (куб сейчас; далее круг, треугольник, n-gon).

---

## Почему loft (решение сессии 14)

| Критерий | Набор кубиков (сейчас) | InstancedMesh | **Profile loft (выбрано)** |
|----------|------------------------|---------------|----------------------------|
| Сплошной sweep | ❌ | ❌ | ✅ |
| Форма = объект | ✅ | ✅ | ✅ |
| Draw calls (11 кубов) | ~220 | 11 | **11** |
| CPU | высокий | низкий | средний* |

\*С переиспользованием `BufferGeometry` (update vertices in-place, без `new` каждый кадр).

**Tube** — только для круга; для куба/многоугольника не подходит.

---

## Микро-шаги

- [ ] **1. Прототип loft на одном кубе**
  - Новый компонент `float-motion-trail-loft.js` **или** рефактор `float-motion-trail.js`.
  - Профиль: квадрат (4 вершины, сторона ≈ `CONFIG.floatingCubes.size * sizeScale`).
  - Path: существующий буфер `_path` + живая голова (`_samplePath` / `_driftDir` seed).
  - Кривая: `THREE.CatmullRomCurve3` по N точкам (12–16 сечений).
  - Loft: кастомный `BufferGeometry` — профиль на каждом сечении, треугольники между соседними.
  - Material: `MeshBasicMaterial`, `transparent`, `depthWrite: false`, цвет = цвет куба.
  - Opacity head→tail: vertex colors (alpha) или UV + gradient texture.
  - Яркость: сохранить `minVisibility 0.1` / `maxVisibility 0.15` от timeScale.
  - Проверка: Chrome + Quest — сплошной хвост, без «лестницы»; FPS не просел.

- [ ] **2. Переиспользование буфера**
  - Фиксированное число сечений; каждый tick — только обновление позиций вершин.
  - Не делать `dispose()` + `new Geometry()` каждый кадр (GC-фризы на Quest).

- [ ] **3. Раскатка на все 11 кубов**
  - Удалить 20× `a-box` на куб; один mesh на trail.
  - Сравнить draw calls / ощущение FPS в Quest.

- [ ] **4. Абстракция профиля (задел на будущие формы)**
  - В `config.js`: `trailProfile: 'square'` + массив вершин профиля **или** фабрика `getTrailProfile(el)`.
  - Документировать: `'square' | 'circle' | 'triangle' | 'custom'`.
  - Круг = частный случай (8–12 вершин или TubeGeometry).

- [ ] **5. Quest QA → закрыть 4c**
  - Slo-mo: хвост сплошной, яркость ~15%, seed направления OK.
  - Realtime: хвост едва заметен (~10%).
  - Обновить `PROJECT_LOG.md`, `PROJECT_LOG_ARCHIVE.md`.

---

## Working Context

### ИЗВЕСТНО

- Trace/path логика **готова** в `float-motion-trail.js`: змейка, seed через `floating-cube._driftDir`, буфер 0.5 м.
- Текущий trail (20 `a-box`) — **работает**, Quest OK, но **угловатый** (дискретные кубики).
- Виньетка 3D-quad в Quest **не видна** → отложена на **конец разработки** (этап 8 / polish), не блокирует 4c.
- CSS-виньетка удалена (`slowmo-vfx.js`); только `slowmo-vignette-3d.js` (заморожен).

### ПРЕДПОЛОЖЕНИЯ

- 12–16 сечений loft достаточно для плавности при длине хвоста ~0.4 м.
- Обновление вершин in-place уложится в бюджет Quest при 11 mesh.

### Файлы

**Тронем:** `js/components/float-motion-trail.js` (или новый loft-компонент), `js/config.js` (`slowmoFx.trail`), возможно `spawn-floating-cubes.js`.

**Не трогаем:** time-scale core, floating-cube physics (кроме чтения `_driftDir`), collision layers, dome, `slowmo-vignette-3d.js`.

---

## Следующее действие

**Шаг 1:** прототип loft на **одном** float-кубе — квадратный профиль, сплошной mesh, gradient opacity. Проверка в Chrome, затем Quest.
