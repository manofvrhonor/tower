/**
 * main.js — точка входа JS.
 *
 * Здесь:
 *  - регистрируем кастомные компоненты A-Frame (по мере появления);
 *  - подписываемся на события сцены (loaded, enter-vr, exit-vr).
 */

// Ждём пока A-Frame полностью построит сцену
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');

  if (!scene) {
    console.error('[Tower] <a-scene> не найдена в DOM!');
    return;
  }

  scene.addEventListener('loaded', () => {
    console.log('[Tower] Сцена загружена. CONFIG:', window.CONFIG);
  });

  scene.addEventListener('enter-vr', () => {
    console.log('[Tower] Вход в VR-режим');
  });

  scene.addEventListener('exit-vr', () => {
    console.log('[Tower] Выход из VR-режима');
  });
});