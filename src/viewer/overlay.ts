import { CONFIG } from '../config';
import type { Store } from '../data/store';

/** SVG mapa stanova preko rendera: skida Figmine boje i nameće CSS klase po statusu/filteru. */
export class Overlay {
  private svgs = new Map<string, string>();
  private shot = '';

  constructor(
    private host: HTMLElement,
    private store: Store,
  ) {
    store.subscribe(() => this.refresh());
  }

  setSvg(prefix: string, text: string) {
    this.svgs.set(prefix, text);
  }

  show(prefix: string) {
    this.shot = prefix;
    this.host.innerHTML = this.svgs.get(prefix) ?? '';
    const svg = this.host.querySelector('svg');
    svg?.removeAttribute('width');
    svg?.removeAttribute('height');
    svg?.setAttribute('preserveAspectRatio', 'none');
    // Stan = svaki element čiji se id poklapa sa stanom iz apartments.json (LB, LC, Frame... se ignorišu).
    this.host.querySelectorAll<SVGElement>('[id]').forEach((el) => {
      if (CONFIG.zones[el.id]) {
        el.classList.add('zone');
        el.dataset.zone = el.id;
        for (const n of [el, ...el.querySelectorAll<SVGElement>('*')]) {
          for (const a of ['fill', 'stroke', 'style', 'opacity', 'fill-opacity', 'stroke-width']) n.removeAttribute(a);
        }
        return;
      }
      if (!this.store.get(el.id)) return;
      el.classList.add('apt');
      el.dataset.apt = el.id;
      for (const n of [el, ...el.querySelectorAll<SVGElement>('*')]) {
        for (const a of ['fill', 'stroke', 'style', 'opacity', 'fill-opacity', 'stroke-width']) n.removeAttribute(a);
      }
    });
    this.refresh();
  }

  /** ID-jevi stanova vidljivi u trenutnom kadru. */
  ids() {
    return [...this.host.querySelectorAll<SVGElement>('.apt')].map((e) => e.dataset.apt!);
  }

  refresh() {
    this.host.querySelectorAll<SVGElement>('.apt').forEach((el) => {
      const a = this.store.get(el.dataset.apt!);
      if (!a) return;
      el.classList.remove('is-free', 'is-reserved', 'is-sold');
      el.classList.add(`is-${a.status}`);
      el.classList.toggle('is-dimmed', !this.store.matches(a));
    });
  }

  get current() {
    return this.shot;
  }
}
