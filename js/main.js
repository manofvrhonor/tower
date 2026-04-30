/**
 * main.js — диагностика событий рук и физики.
 *
 * Сейчас файл нужен только для логирования в консоль:
 * 1. События кнопок контроллера (триггер, грип) — приходят от hand-controls.
 * 2. События физических контактов — приходят от physx-body с emitCollisionEvents.
 *
 * После миграции с super-hands+cannon на @c-frame/physx
 * (см. PROJECT_LOG.md, задача 1.3).
 */

window.addEventListener('DOMContentLoaded', () => {
  const setup = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[setup] element #${id} not found`);
      return;
    }

    // События кнопок контроллера (от hand-controls)
    el.addEventListener('gripdown', () => console.log(`[${id}] GRIPDOWN`));
    el.addEventListener('triggerdown', () => console.log(`[${id}] TRIGGERDOWN`));
    el.addEventListener('gripup', () => console.log(`[${id}] GRIPUP`));
    el.addEventListener('triggerup', () => console.log(`[${id}] TRIGGERUP`));
  };

  const setupCollider = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[setupCollider] element #${id} not found`);
      return;
    }

    // События физических контактов (от PhysX, на entity с emitCollisionEvents: true)
    el.addEventListener('contactbegin', (e) => {
      const otherId = e.detail.otherComponent?.el?.id || '(no id)';
      console.log(`[${id}] CONTACT BEGIN with #${otherId}`);
    });
    el.addEventListener('contactend', (e) => {
      const otherId = e.detail.otherComponent?.el?.id || '(no id)';
      console.log(`[${id}] CONTACT END with #${otherId}`);
    });
  };

  // Даём A-Frame и PhysX время инициализироваться, затем подписываемся.
  setTimeout(() => {
    setup('leftHand');
    setup('rightHand');
    setupCollider('leftHandCollider');
    setupCollider('rightHandCollider');
    console.log('=== Hand event listeners attached ===');
    console.log('physx system registered:', !!AFRAME.systems.physx);
    console.log('physx-grab registered:', !!AFRAME.components['physx-grab']);
    console.log('physx-body registered:', !!AFRAME.components['physx-body']);
  }, 1500); // 1500мс, чтобы PhysX успел стартануть (delay у physx — 1000мс)
});