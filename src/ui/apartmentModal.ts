import { CONFIG, asset } from '../config';
import { STATUS_LABEL, type Apartment } from '../data/apartments';
import { cap, fmtArea, fmtPrice, inquiryUrl } from '../data/format';
import type { Store } from '../data/store';

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export class ApartmentModal {
  private root = document.createElement('div');
  private card = document.createElement('div');
  private lightbox = document.createElement('div');
  private current: Apartment | null = null;
  private returnFocus: HTMLElement | null = null;

  constructor(private store: Store) {
    this.root.className = 'modal';
    this.root.hidden = true;
    this.root.innerHTML = '<div class="modal__backdrop"></div>';
    this.card.className = 'modal__card';
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'true');
    this.root.append(this.card);
    this.lightbox.className = 'lightbox';
    this.lightbox.hidden = true;
    this.lightbox.onclick = () => (this.lightbox.hidden = true);
    document.body.append(this.root, this.lightbox);

    this.root.querySelector('.modal__backdrop')!.addEventListener('click', () => this.close());
    // capture: dok je kartica otvorena, tastatura ne rotira zgradu niti zatvara filtere
    addEventListener('keydown', (e) => this.onKey(e), true);
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(a: Apartment) {
    if (!this.isOpen) this.returnFocus = document.activeElement as HTMLElement;
    this.current = a;
    this.render(a);
    this.root.hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector(`.apt[data-apt="${a.id}"]`)?.classList.add('is-active');
    this.card.querySelector<HTMLElement>('.modal__close')?.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.lightbox.hidden = true;
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.apt.is-active').forEach((e) => e.classList.remove('is-active'));
    this.returnFocus?.focus();
  }

  private list() {
    return this.store.results().sort((x, y) => x.id.localeCompare(y.id));
  }

  private step(d: 1 | -1) {
    const list = this.list();
    const i = list.findIndex((a) => a.id === this.current?.id);
    if (!list.length) return;
    const next = list[(i + d + list.length) % list.length];
    document.querySelectorAll('.apt.is-active').forEach((e) => e.classList.remove('is-active'));
    this.current = next;
    this.render(next, true);
    document.querySelector(`.apt[data-apt="${next.id}"]`)?.classList.add('is-active');
  }

  private onKey(e: KeyboardEvent) {
    if (!this.isOpen) return;
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      if (!this.lightbox.hidden) this.lightbox.hidden = true;
      else this.close();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.stopImmediatePropagation();
      this.step(e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Tab') {
      const f = [...this.card.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    }
  }

  private render(a: Apartment, swap = false) {
    const list = this.list();
    const idx = list.findIndex((x) => x.id === a.id);
    const brochure = CONFIG.brochureUrl;
    const plan = asset(a.floorplan);
    this.card.setAttribute('aria-label', a.label);
    this.card.classList.toggle('is-swap', swap);
    this.card.innerHTML = `
      <button class="modal__close" aria-label="Zatvori">
        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <div class="modal__plan">
        <button class="plan__btn" aria-label="Uvećaj tlocrt">
          <img src="${plan}" alt="Tlocrt: ${a.label}" />
          <span class="plan__zoom">Uvećaj</span>
        </button>
        <p class="plan__missing">Tlocrt uskoro</p>
      </div>
      <div class="modal__info">
        <p class="eyebrow">Lamela ${a.building.slice(1)} &nbsp;·&nbsp; ${a.floor}. sprat</p>
        <h2 class="modal__title">${a.id}</h2>
        <span class="st st--${a.status}"><i></i>${STATUS_LABEL[a.status]}</span>
        <div class="hero"><b>${fmtArea(a.area)}</b><span>m²</span></div>
        <dl class="specs">
          <div><dt>Struktura</dt><dd>${cap(a.structure)}</dd></div>
          <div><dt>Orijentacija</dt><dd>${cap(a.orientation)}</dd></div>
          <div><dt>Terasa / balkon</dt><dd>${fmtArea(a.balconyArea)} m²</dd></div>
          <div><dt>Cena</dt><dd class="${a.price ? '' : 'is-muted'}">${fmtPrice(a.price)}</dd></div>
        </dl>
        <div class="actions">
          <a class="btn btn--primary" href="${inquiryUrl(a)}" target="_blank" rel="noopener">Pošalji upit</a>
          <a class="btn btn--ghost" href="${brochure}" download>Skini brošuru</a>
        </div>
        <div class="pager">
          <button class="pager__btn" data-d="-1" aria-label="Prethodni stan"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <span>${idx + 1} / ${list.length}</span>
          <button class="pager__btn" data-d="1" aria-label="Sledeći stan"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>`;
    this.card.querySelector('.modal__close')!.addEventListener('click', () => this.close());
    this.card.querySelectorAll<HTMLElement>('.pager__btn').forEach((b) => (b.onclick = () => this.step(Number(b.dataset.d) as 1 | -1)));
    const img = this.card.querySelector('img')!;
    img.onerror = () => this.card.querySelector('.modal__plan')!.classList.add('is-missing');
    this.card.querySelector('.plan__btn')!.addEventListener('click', () => {
      this.lightbox.innerHTML = `<img src="${plan}" alt="Tlocrt: ${a.label}" />`;
      this.lightbox.hidden = false;
    });
  }
}
