/* global CONFIG */

/**
 * spawn-floating-cubes.js — наполняет #floating-cubes-root 11 entity
 * по данным CONFIG.floatingCubes (см. CURRENT_TASK.md, задача 2, Шаг 6).
 *
 * Размещение: 5 цветных по targetColors + 6 серых на trashColor.
 * Позиции — из spawnPositions (первые 5 цветным, остальные серым).
 *
 * Каждый entity получает:
 *   - geometry/material (размер из CONFIG.size, цвет — из палитры);
 *   - physx-body="type: dynamic; mass: ...";
 *   - physx-material с restitution 0.9 + явные collisionLayers/collidesWithLayers
 *     (слой FLOAT_CUBE; маска — все «физические» слои, см. CONFIG.collisionLayers
 *     и Шаг 3.5/3.5.C);
 *   - компонент floating-cube (отключение гравитации, damping, импульсы);
 *   - data-is-target="true|false" — пригодится в задачах 5 и 6
 *     (победа по «полезным», подсветка/различие). Сейчас не читается.
 *
 * Слой GRABBED_CUBE на кубик ставится временно компонентом physx-grab
 * на время захвата. После release кубик возвращается в FLOAT_CUBE
 * (см. js/components/physx-grab.js, Шаг 3.5).
 *
 * --- ВАЖНО про числа в physx-material ---
 *
 * Биндинг physx-material из @c-frame/physx ждёт ИНДЕКСЫ слоёв через
 * запятую (CSV), а под капотом сам делает (1 << index). Поэтому в строку
 * атрибута мы складываем ИНДЕКСЫ (0, 1, 2, ...), а НЕ битовые маски.
 *
 * Если передать сюда готовую маску (например, 63), биндинг распарсит её
 * как одно число-индекс и сделает (1 << 63), что в JS-int32 переполняется
 * в -2147483648 и роняет PhysX с TypeError "outside the valid range
 * [0, 4294967295]". История бага — Сессия 9, рефакторинг 3.5.C.
 */
(function () {
  function spawn() {
    var cfg = (typeof CONFIG !== 'undefined') && CONFIG.floatingCubes;
    if (!cfg) {
      console.error('[spawn-floating-cubes] CONFIG.floatingCubes not found');
      return;
    }

    var root = document.getElementById('floating-cubes-root');
    if (!root) {
      console.error('[spawn-floating-cubes] #floating-cubes-root not found in DOM');
      return;
    }

    // === Слои коллизий (Шаг 3.5) ===
    // CONFIG.collisionLayers — ИНДЕКСЫ (0..6). Биндинг physx-material сам
    // делает (1 << index). Никогда не передавай сюда битовые маски —
    // см. JSDoc файла, секция "ВАЖНО про числа в physx-material".
    var layers = (CONFIG && CONFIG.collisionLayers) || {
      WORLD: 0, DOME: 1, FLOAT_CUBE: 2, GRAVITY_CUBE: 3,
      GRABBED_CUBE: 4, BALL: 5, HAND: 6,
    };
    // Свободный кубик живёт на слое FLOAT_CUBE.
    var ownLayer = layers.FLOAT_CUBE;
    // С какими слоями сталкивается свободный кубик: всё «физическое»,
    // включая DOME (отскок от купола) и GRABBED_CUBE (другая рука с кубом).
    // HAND намеренно не включён — рука не должна отталкивать кубики
    // (захват реализован через joint в physx-grab, не через коллизию).
    var collidesWithList = [
      layers.WORLD,
      layers.DOME,
      layers.FLOAT_CUBE,
      layers.GRAVITY_CUBE,
      layers.GRABBED_CUBE,
      layers.BALL,
    ].join(', ');

    var targets = cfg.targetColors || [];
    var trashColor = cfg.trashColor || '#888888';
    var positions = cfg.spawnPositions || [];
    var size = cfg.size || 0.1;
    var mass = (cfg.mass !== undefined) ? cfg.mass : 1;

    var nTargets = targets.length;             // ожидаем 5
    var nTotal = positions.length;             // ожидаем 11
    if (nTotal < nTargets) {
      console.error('[spawn-floating-cubes] позиций меньше, чем цветных кубиков');
      return;
    }

    var created = 0;
    for (var i = 0; i < nTotal; i++) {
      var p = positions[i];
      var isTarget = i < nTargets;
      var color = isTarget ? targets[i] : trashColor;
      var idSuffix = isTarget ? ('color-' + (i + 1)) : ('trash-' + (i - nTargets + 1));

      var el = document.createElement('a-entity');
      el.setAttribute('id', 'floating-cube-' + idSuffix);
      el.setAttribute('geometry',
        'primitive: box; width: ' + size + '; height: ' + size + '; depth: ' + size);
      el.setAttribute('material', 'color: ' + color);
      el.setAttribute('position', p.x + ' ' + p.y + ' ' + p.z);
      el.setAttribute('physx-body', 'type: dynamic; mass: ' + mass);
      el.setAttribute('physx-material',
        'restitution: 0.9; staticFriction: 0.05; dynamicFriction: 0.05; ' +
        'collisionLayers: ' + ownLayer + '; ' +
        'collidesWithLayers: ' + collidesWithList);
      el.setAttribute('floating-cube', '');
      el.dataset.isTarget = isTarget ? 'true' : 'false';

      root.appendChild(el);
      created++;
    }

    console.log('[spawn-floating-cubes] spawned', created, 'cubes (',
      nTargets, 'colored +', (nTotal - nTargets), 'gray ) on layer FLOAT_CUBE');
  }

  // DOMContentLoaded гарантирует, что #floating-cubes-root уже распарсен.
  // CONFIG к этому моменту тоже глобален (config.js загружен раньше синхронно).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', spawn);
  } else {
    spawn();
  }
})();