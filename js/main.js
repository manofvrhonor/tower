window.addEventListener('DOMContentLoaded', () => {
  const setup = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[setup] element #${id} not found`);
      return;
    }

    // События от sphere-collider
    el.addEventListener('hit', (e) => console.log(`[${id}] HIT:`, e.detail));
    el.addEventListener('hitstart', (e) => console.log(`[${id}] HITSTART:`, e.detail));
    el.addEventListener('hitend', (e) => console.log(`[${id}] HITEND:`, e.detail));

    // События кнопок контроллера
    el.addEventListener('gripdown', () => console.log(`[${id}] GRIPDOWN`));
    el.addEventListener('triggerdown', () => console.log(`[${id}] TRIGGERDOWN`));
    el.addEventListener('gripup', () => console.log(`[${id}] GRIPUP`));
    el.addEventListener('triggerup', () => console.log(`[${id}] TRIGGERUP`));

    // События super-hands
    el.addEventListener('grab-start', (e) => console.log(`[${id}] GRAB-START`, e.detail));
    el.addEventListener('grab-end', (e) => console.log(`[${id}] GRAB-END`, e.detail));
  };

  setTimeout(() => {
    setup('leftHand');
    setup('rightHand');
    console.log('=== Hand event listeners attached ===');
    console.log('sphere-collider registered:', !!AFRAME.components['sphere-collider']);
    console.log('super-hands registered:', !!AFRAME.components['super-hands']);
    console.log('grabbable elements found:', document.querySelectorAll('.grabbable').length);
  }, 1000);
});