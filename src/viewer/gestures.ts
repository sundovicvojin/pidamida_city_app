/** Swipe (touch + mouse drag) levo/desno. Vraća se pozivom callback-a; potiskuje klik posle swipe-a. */
export function attachSwipe(el: HTMLElement, onSwipe: (dir: 1 | -1) => void) {
  let sx = 0;
  let sy = 0;
  let st = 0;
  let id = -1;
  let swiped = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    id = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    st = performance.now();
    swiped = false;
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    const v = Math.abs(dx) / Math.max(1, performance.now() - st);
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && (Math.abs(dx) > 90 || v > 0.3)) {
      swiped = true;
      onSwipe(dx < 0 ? 1 : -1); // swipe levo = napred
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => (id = -1));
  el.addEventListener('click', (e) => {
    if (swiped) {
      e.stopPropagation();
      e.preventDefault();
      swiped = false;
    }
  }, true);
}
