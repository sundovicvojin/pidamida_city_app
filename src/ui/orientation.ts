/** Overlay „Rotirajte uređaj": prikazuje ga CSS samo na telefonu u portretu. */
export function initOrientation() {
  const el = document.createElement('div');
  el.className = 'rotate-hint';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
      <rect x="20" y="8" width="24" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 40c0 8 6 14 14 16M56 24c0-8-6-14-14-16" fill="none" stroke="#c9a96e" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M22 52l-4 4 6 1M42 12l4-4-6-1" fill="none" stroke="#c9a96e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p>Rotirajte uređaj</p>
    <span>Aplikacija se koristi u horizontalnom položaju.</span>`;
  document.body.append(el);
}
