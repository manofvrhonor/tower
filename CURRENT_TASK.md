---
name: Current Task
alwaysApply: true
---

# CURRENT_TASK.md — Текущая задача

## Задача 4b — Полировка slo-mo VFX (остаток Этапа 4)

**Этап 4** по геймплею ✅. Этап 5 (победа) — после закрытия VFX.

---

## Цель

- VR-виньетка **видна в Quest** при slo-mo (сейчас OK на мониторе, в шлеме — нет).
- Trail float-кубиков: **стабильная** видимость и прозрачность (10–100% от timeScale).

---

## Микро-шаги

- [ ] **1.** VR-виньетка: диагностика (quad в кадре? material? near clip?) → рабочий вариант в Quest.
- [ ] **2.** Trail: подстроить opacity/visibility по результатам Quest (config + логика blend).

---

## Working Context

### ИЗВЕСТНО

- CSS `#slowmo-vignette` работает на десктопе/зеркале; в immersive WebXR не рендерится.
- `slowmo-vignette-3d.js` — CanvasTexture quad на `a-camera`, `planeDistance: 0.18`, `depthTest: false`.
- Trail: trace 0.4 м, `minVisibility: 0.1`, 10 сегментов — логика OK, нужна полировка.

### НЕИЗВЕСТНО

- Почему quad не виден в Quest (позиция, stereo, layer, material init?).

### Файлы

**Тронем:** `js/components/slowmo-vignette-3d.js`, `js/config.js` (slowmoFx), возможно `float-motion-trail.js`.

**Не трогаем:** time-scale core, floating-cube physics, collision layers, dome.

---

## Следующее действие

**Шаг 1:** Quest — замер → проверить, виден ли quad; править `slowmo-vignette-3d` (distance, size, gradientInnerPx, renderOrder).
