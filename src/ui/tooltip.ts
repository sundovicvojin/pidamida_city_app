import { CONFIG } from '../config';
import { STATUS_LABEL, type Apartment } from '../data/apartments';
import { fmtArea } from '../data/format';
import type { Store } from '../data/store';

export interface TipHooks {
  open(a: Apartment): void;
}

const clickable = (a: Apartment, soldOk: boolean) => soldOk || a.status !== 'sold';

/**
 * Desktop: tooltip uz kursor, klik otvara karticu.
 * Touch: prvi tap istakne stan + mini kartica, drugi tap (ili „Detalji") otvara karticu.
 */
export class Tooltip {
  private tip = document.createElement('div');
  private mini = document.createElement('div');
  private activeEl: Element | null = null;
  private lastType = 'mouse';

  constructor(
    host: HTMLElement,
    private store: Store,
    private hooks: TipHooks,
    private soldOk: boolean,
  ) {
    this.tip.className = 'tip';
    this.tip.hidden = true;
    this.mini.className = 'minicard';
    this.mini.hidden = true;
    document.body.append(this.tip, this.mini);

    host.addEventListener('pointerdown', (e) => (this.lastType = e.pointerType));
    host.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const z = this.zoneAt(e.target);
      if (z) return this.showZoneTip(z, e.clientX, e.clientY);
      const a = this.aptAt(e.target);
      if (!a) return this.hideTip();
      this.showTip(a, e.clientX, e.clientY);
    });
    host.addEventListener('pointerleave', () => this.hideTip());
    host.addEventListener('click', (e) => {
      const z = this.zoneAt(e.target);
      if (z) {
        // zona u izgradnji: nikad ne otvara karticu; na touch samo poruka
        if (this.lastType === 'touch') this.selectZone(z);
        return;
      }
      const a = this.aptAt(e.target);
      if (!a) return this.clear();
      if (!clickable(a, this.soldOk)) return;
      if (this.lastType === 'touch') {
        const el = (e.target as Element).closest('.apt')!;
        if (this.activeEl === el) return this.hooks.open(a);
        this.select(el, a);
      } else {
        this.hooks.open(a);
      }
    });
    store.subscribe(() => this.clear());
  }

  private aptAt(t: EventTarget | null) {
    const el = (t as Element | null)?.closest?.('.apt');
    if (!el || el.classList.contains('is-dimmed')) return null;
    return this.store.get((el as SVGElement).dataset.apt!) ?? null;
  }

  private zoneAt(t: EventTarget | null) {
    const el = (t as Element | null)?.closest?.('.zone') as SVGElement | null;
    return el ? el.dataset.zone! : null;
  }

  private showZoneTip(id: string, x: number, y: number) {
    this.tip.innerHTML = `<b>${CONFIG.zones[id]}</b><span>${CONFIG.zoneNote}</span>`;
    this.tip.hidden = false;
    const w = this.tip.offsetWidth;
    const h = this.tip.offsetHeight;
    this.tip.style.transform = `translate(${Math.min(x + 18, innerWidth - w - 12)}px, ${Math.min(y + 18, innerHeight - h - 12)}px)`;
  }

  private selectZone(id: string) {
    this.clear();
    this.mini.innerHTML = `<div><b>${CONFIG.zones[id]}</b><span>${CONFIG.zoneNote}</span></div>`;
    this.mini.hidden = false;
    document.body.classList.add('has-mini');
  }

  private status(a: Apartment) {
    return `<span class="st st--${a.status}"><i></i>${STATUS_LABEL[a.status]}</span>`;
  }

  private showTip(a: Apartment, x: number, y: number) {
    this.tip.innerHTML = `<b>${a.id}</b><span>${a.floor}. sprat · ${fmtArea(a.area)} m²</span>${this.status(a)}`;
    this.tip.hidden = false;
    const w = this.tip.offsetWidth;
    const h = this.tip.offsetHeight;
    this.tip.style.transform = `translate(${Math.min(x + 18, innerWidth - w - 12)}px, ${Math.min(y + 18, innerHeight - h - 12)}px)`;
  }
  private hideTip() {
    this.tip.hidden = true;
  }

  private select(el: Element, a: Apartment) {
    this.clear();
    this.activeEl = el;
    el.classList.add('is-active');
    this.mini.innerHTML = `<div><b>${a.label}</b><span>${a.floor}. sprat · ${fmtArea(a.area)} m²</span>${this.status(a)}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary';
    btn.textContent = 'Detalji';
    btn.onclick = () => this.hooks.open(a);
    this.mini.append(btn);
    this.mini.hidden = false;
    document.body.classList.add('has-mini');
  }

  clear() {
    this.activeEl?.classList.remove('is-active');
    this.activeEl = null;
    this.mini.hidden = true;
    document.body.classList.remove('has-mini');
    this.hideTip();
  }
}
