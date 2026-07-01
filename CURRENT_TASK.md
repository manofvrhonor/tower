---



name: Current Task



alwaysApply: true



---



# CURRENT_TASK.md — Текущая задача



## Задача: 3.5A.5 — GLB магнит на руке, затем Фаза 3.5B



**Мастер-план:** `.cursor/plans/tower_stylish_game_c39f4c3b.plan.md` → 3.5A.5, потом 3.5B.



**Цель 3.5A.5:** видимый магнит на кулаке (`magnet.glb`), grab/VFX без регрессий; Quest QA.



**Цель 3.5B:** GLB-детали вместо кубов, призраки под форму, слоты от центра сферы/колец; состояния snapped/active/broken.



### Микро-шаги (3.5A.5)



- ✅ **3.5A.5.0** — `hand-magnet-mesh.js` + `magnet.glb` на `#*Magnet`; scale 0.0075.

- ⏸ **3.5A.5.1** — калибровка в `config.js` (ручная, пауза): `magnetMesh.position.y: 0.03`, rotation left `z:90` / right `z:270`.

- ⬜ **3.5B.0** — пересчёт `CONFIG.mechanisms.slots` от центра сферы/колец.

- ⬜ **3.5B.1** — `CONFIG.parts[].model` → загрузка GLB вместо куба; PhysX box по bounds.

- ⬜ **3.5B.2** — призраки слотов под форму детали (не один `slotSize`).

- ⬜ **3.5B.3** — визуальные состояния: floating, ghost, snapped, snapped_active, broken.

- ⬜ **git commit** — по запросу.



**Не делаем в 3.5B:** `location-manager` (Фаза 4), перенос между комнатами.



**Закрыто (3.5A ✅):** magnet grab — collider якорь, Fixed joint, snap фронтом, VFX, Quest QA (с.49).



---



## Working Context



### ИЗВЕСТНО (наследие 3.5A)



- **Grab якорь:** `#*HandCollider` — `hands.grab.colliderLocal`; snap + joint target = центр сферы.

- **Фронт snap:** `hands.grab.attachAxis` `{0, -1, 0}` (Quest −Y = к пальцам).

- **VFX:** `hand-magnet-vfx` на `#*Magnet`, sync к collider; `sparkSeparation: 0.04`.

- **Кулак:** `#*HandBody` + `bodyCollider.parts` (отдельная калибровка).



### Следующее действие



**Пауза 3.5A.5** — визуал магнита OK на сейчас. Дальше: Quest QA collider/VFX или **3.5B.0**.

