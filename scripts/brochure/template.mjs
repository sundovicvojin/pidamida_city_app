import { BROCHURE } from './config.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const nf = new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pf = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
const STATUS_COLOR = { free: 'var(--free)', reserved: 'var(--reserved)', sold: 'var(--sold)' };

const m2 = (n) => `${nf.format(n)}<small> m²</small>`;
const fmtPrice = (p) => (p ? `${pf.format(p)}<small> €</small>` : 'Na upit');
const fmtRooms = (r) => String(r).replace('.', ',');
const fmtOrientation = (o) => cap(o.replace(/-/g, ' / '));
const status = (a) =>
  `<i class="dot" style="background:${STATUS_COLOR[a.status] ?? 'var(--muted)'}"></i>${esc(BROCHURE.statusLabel[a.status] ?? a.status)}`;

function figure(cls, src, label, emptyText) {
  if (!src) return `<div class="figure figure--empty ${cls}">${esc(emptyText)}</div>`;
  return `<div class="figure ${cls}"><img src="${src}" alt="${esc(label)}"><span class="figure__tag">${esc(label)}</span></div>`;
}

/** Vertikalni prikaz sprata: svih spratova zgrade, istaknut sprat stana. */
function floorStack(a, floors) {
  const rows = Array.from({ length: floors }, (_, i) => floors - i)
    .map((f) => `<i class="${f === a.floor ? 'on' : ''}"><b>${f}</b></i>`)
    .join('');
  return `<div class="stack" aria-label="${a.floor}. sprat">${rows}</div>`;
}

function footer(a, page, total) {
  return `
  <footer class="foot">
    <p>${esc(BROCHURE.disclaimer)}</p>
    <div class="foot__r"><b>${esc(BROCHURE.developer)}</b><br>${esc(a.label)} · ${page}/${total}</div>
  </footer>`;
}

/** a = stan iz JSON-a, img = { isometric, floorplan } (file:// URL ili null), floors = broj spratova zgrade. */
export function renderBrochure(a, img, floors) {
  const lamela = BROCHURE.buildings[a.building] ?? `Lamela ${a.building.replace(/^L/, '')}`;
  const total = a.area + (a.balconyArea || 0);
  const num = a.id.split('-').slice(1).join('-');

  const facts = [
    ['Struktura', esc(cap(a.structure))],
    ['Broj soba', esc(fmtRooms(a.rooms))],
    ['Sprat', `${a.floor}.`],
    ['Orijentacija', esc(fmtOrientation(a.orientation))],
  ];
  const rows = [
    ['Površina stana', m2(a.area)],
    ['Terasa / balkon', m2(a.balconyArea)],
    ['Ukupno sa terasom', m2(total)],
    ['Struktura', esc(cap(a.structure))],
    ['Broj soba', esc(fmtRooms(a.rooms))],
    ['Sprat', `${a.floor}.`],
    ['Orijentacija', esc(fmtOrientation(a.orientation))],
    ['Status', status(a)],
    ['Cena', fmtPrice(a.price)],
  ];

  return `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><title>${esc(BROCHURE.project)} – ${esc(a.label)}</title>
<style>{{CSS}}</style></head><body>

<!-- STRANA 1: naslovna -->
<section class="page p1">
  <div class="p1__bar">
    <img class="logo" src="{{LOGO}}" alt="${esc(BROCHURE.project)}">
    <span class="kicker">${esc(lamela)} &nbsp;·&nbsp; ${a.floor}. sprat</span>
  </div>

  <div class="p1__head">
    <div>
      <div class="kicker">${esc(cap(a.structure))} stan</div>
      <h1 class="title">${esc(a.label.replace(/\s\S+$/, ''))} <b>${esc(a.id)}</b></h1>
    </div>
    <div class="area"><strong>${m2(a.area)}</strong><span>+ ${m2(a.balconyArea)} terasa</span></div>
  </div>

  <div class="p1__iso">
    ${figure('figure--iso', img.isometric, 'Izometrija', 'Izometrijski prikaz uskoro')}
  </div>

  <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>

  <div class="p1__foot">
    <span>${esc(BROCHURE.tagline)}</span>
    <span>${status(a)}</span>
  </div>
</section>

<!-- STRANA 2: tlocrt i podaci -->
<section class="page p2">
  <header class="p2__top">
    <img class="logo logo--dk" src="{{LOGO_DK}}" alt="${esc(BROCHURE.project)}">
    <span class="kicker kicker--dk">${esc(a.label)}</span>
  </header>

  <div class="p2__main">
    <div class="h2">Tlocrt stana</div>
    ${figure('figure--plan', img.floorplan, 'Tlocrt', 'Tlocrt uskoro')}

    <div class="p2__grid">
      <div>
        <div class="h2">Podaci o stanu</div>
        <dl class="rows">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </div>
      <div class="loc">
        <div class="h2">Položaj</div>
        <div class="loc__in">
          ${floorStack(a, floors)}
          <div class="loc__t"><b>${esc(lamela)}</b>${a.floor}. sprat<br><span>Stan br. ${esc(num)}</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="cta">
    <div class="cta__t">
      <h3>Zainteresovani ste za <b>${esc(a.id)}</b>?</h3>
      <p>Pošaljite upit preko kontakt forme na sajtu za razgledanje, detalje o ceni i uslovima kupovine.</p>
    </div>
    <div class="cta__c"><b>${esc(BROCHURE.developer)}</b><span>Kontakt forma na zvaničnom sajtu</span></div>
  </div>
  ${footer(a, 2, 2)}
</section>
</body></html>`;
}
