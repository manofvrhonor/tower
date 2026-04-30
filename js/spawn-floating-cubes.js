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
 *   - physx-material с restitution 0.9 (как у синего на Шаге 5);
 *   - компонент floating-cube (отключение гравитации, damping, импульсы);
 *   - data-is-target="true|false" — пригодится в задачах 5 и 6
 *     (победа по «полезным», подсветка/различие). Сейчас не читается.
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
        'restitution: 0.9; staticFriction: 0.05; dynamicFriction: 0.05');
      el.setAttribute('floating-cube', '');
      el.dataset.isTarget = isTarget ? 'true' : 'false';

      root.appendChild(el);
      created++;
    }

    console.log('[spawn-floating-cubes] spawned', created, 'cubes (',
      nTargets, 'colored +', (nTotal - nTargets), 'gray )');
  }

  // DOMContentLoaded гарантирует, что #floating-cubes-root уже распарсен.
  // CONFIG к этому моменту тоже глобален (config.js загружен раньше синхронно).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', spawn);
  } else {
    spawn();
  }
})();