---



name: Current Task



alwaysApply: true



---



# CURRENT_TASK.md — Текущая задача



## Задача: 3.5B — GLB детали vis + _COL, сборка



**Мастер-план:** `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md` → 3.5B.



**Цель 3.5B:** GLB vis + `_COL` collider, призраки под форму, слоты; состояния snapped/active/broken.



### Микро-шаги (3.5B)



- ✅ **3.5B.1a** — `colliderModel` + пути `fa_core` / `fa_coil` в `config.js`.

- ✅ **3.5B.1b** — `part-entity.js`: vis + `_COL`, `physx-hidden-collision`, wireframe.

- ✅ **3.5B.1c** — `spawn-floating-cubes.js`: GLB parts на первых позициях (`glbPartIds`).

- ✅ **3.5B.1d** — Quest QA ✅: grab → snap, wireframe `_COL`, FPS.

- ⬜ **3.5B.0** — слоты от центра сферы/колец (пробовали с.50 — откат; опционально).

- ✅ **3.5B.2** — `assembly-core`: призрак по `parts[].model` (vis GLB), box fallback.

- ✅ **3.5B.2 QA** ✅ — призраки trident/ring; restart после победы ok.

- ⬜ **3.5B.3** — визуальные состояния: floating, ghost, snapped, snapped_active, broken.

- ⬜ **git commit** — `e1abf20` ✅ push main.



**Не делаем в 3.5B:** `location-manager` (Фаза 4), перенос между комнатами.



**Закрыто (3.5B.2 ✅):** призраки слотов по vis-GLB; fix `restartGame()` после победы.

**Закрыто (3.5B.1 ✅):** vis + `_COL`, `part-entity.js`, spawn `glbPartIds`.



**Закрыто (3.5A ✅):** magnet grab — collider якорь, Fixed joint, snap фронтом, VFX, Quest QA (с.49).



---



## Working Context



### ИЗВЕСТНО (наследие 3.5A)



- **Grab якорь:** `#*HandCollider` — `hands.grab.colliderLocal`; snap + joint target = центр сферы.

- **Фронт snap:** `hands.grab.attachAxis` `{0, -1, 0}` (Quest −Y = к пальцам).

- **VFX:** `hand-magnet-vfx` на `#*Magnet`, sync к collider; `sparkSeparation: 0.04`.

- **Кулак:** `#*HandBody` + `bodyCollider.parts` (отдельная калибровка).

- **GLB детали (3.5B.1):** `part-entity.js` — vis + `_COL`; `glbPartIds: ['fa_core','fa_coil']`.

- **Файлы:** `phase_splitter_trident.glb` + `_COL`, `phase_modulator_ring.glb` + `_COL`.

- **Купол:** energy-шейдер `room-fog-dome` (cartoon с.50 — откат).



### Следующее действие



**3.5B.3** — визуальные состояния детали (следующая сессия).

**Сессия 52 закрыта** — commit `e1abf20`, push main ✅.

