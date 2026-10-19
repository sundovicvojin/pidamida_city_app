import { CONFIG } from '../config';
import { STATUS_LABEL, type Status } from '../data/apartments';
import type { Store } from '../data/store';

export interface FiltersHooks {
  currentShot(): number;
  goToShot(i: number): void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class Filters {
  readonly button = document.createElement('button');
  private panel = document.createElement('aside');
  private badge = document.createElement('span');
  private count = document.createElement('div');
  private hint = document.createElement('button');
  private chipGroups: (() => void)[] = [];
  private areaSync!: () => void;
  private open = false;

  constructor(
    host: HTMLElement,
    private store: Store,
    private hooks: FiltersHooks,
  ) {
    this.button.className = 'filters-btn glass';
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.append('Filteri', this.badge);
    this.badge.className = 'badge';
    this.button.onclick = () => this.toggle();

    this.panel.className = 'filters glass-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Filteri stanova');
    this.panel.hidden = true;

    const head = document.createElement('div');
    head.className = 'filters__head';
    head.innerHTML = '<h2>Filteri</h2>';
    const close = document.createElement('button');
    close.className = 'icon-btn';
    close.setAttribute('aria-label', 'Zatvori filtere');
    close.innerHTML = '&times;';
    close.onclick = () => this.toggle(false);
    head.append(close);

    const floors = [...new Set(store.apts.map((a) => a.floor))].sort((a, b) => a - b);
    const structs = [...new Set(store.apts.map((a) => a.structure))];
    const body = document.createElement('div');
    body.className = 'filters__body';
    body.append(
      this.chips('Sprat', floors.map((f) => [f, `${f}`]), 'floors'),
      this.areaSlider(),
      this.chips('Struktura', structs.map((s) => [s, cap(s)]), 'structures'),
      this.chips('Status', (Object.keys(STATUS_LABEL) as Status[]).map((s) => [s, STATUS_LABEL[s]]), 'statuses'),
    );
    this.panel.append(head, body);

    const foot = document.createElement('div');
    foot.className = 'filters__foot';
    const reset = document.createElement('button');
    reset.className = 'text-btn';
    reset.textContent = 'Resetuj filtere';
    reset.onclick = () => store.reset();
    this.count.className = 'filters__count';
    this.hint.className = 'filters__hint';
    this.hint.hidden = true;
    foot.append(this.count, this.hint, reset);
    this.panel.append(foot);

    host.append(this.panel);
    addEventListener('keydown', (e) => e.key === 'Escape' && this.open && this.toggle(false));
    store.subscribe(() => this.sync());
    this.sync();
  }

  toggle(v = !this.open) {
    this.open = v;
    this.panel.hidden = !v;
    document.body.classList.toggle('filters-open', v);
    this.button.setAttribute('aria-expanded', String(v));
  }

  private chips<T extends string | number>(title: string, items: [T, string][], key: 'floors' | 'structures' | 'statuses') {
    const wrap = document.createElement('section');
    wrap.className = 'filters__group';
    wrap.innerHTML = `<h3>${title}</h3>`;
    const row = document.createElement('div');
    row.className = 'chips';
    const btns = items.map(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = label;
      b.onclick = () =>
        this.store.update((s) => {
          const set = s[key] as Set<T>; // store.state se menja pri reset-u, pa uvek čitamo živi skup
          set.has(val) ? set.delete(val) : set.add(val);
        });
      row.append(b);
      return [b, val] as const;
    });
    wrap.append(row);
    this.chipGroups.push(() => {
      const live = this.store.state[key] as Set<T>;
      for (const [b, val] of btns) {
        b.classList.toggle('is-on', live.has(val));
        b.setAttribute('aria-pressed', String(live.has(val)));
      }
    });
    return wrap;
  }

  private areaSlider() {
    const [min, max] = this.store.bounds;
    const wrap = document.createElement('section');
    wrap.className = 'filters__group';
    const label = document.createElement('h3');
    wrap.append(label);
    const box = document.createElement('div');
    box.className = 'range';
    const mk = () => {
      const i = document.createElement('input');
      i.type = 'range';
      i.min = String(min);
      i.max = String(max);
      i.step = '1';
      return i;
    };
    const lo = mk();
    const hi = mk();
    const fill = document.createElement('i');
    box.append(fill, lo, hi);
    wrap.append(box);
    const apply = () => {
      let a = Number(lo.value);
      let b = Number(hi.value);
      if (a > b) [a, b] = [b, a];
      this.store.update((s) => (s.area = [a, b]));
    };
    lo.oninput = hi.oninput = apply;
    this.areaSync = () => {
      const [a, b] = this.store.state.area;
      lo.value = String(a);
      hi.value = String(b);
      label.textContent = `Odabrana kvadratura: ${a} – ${b} m²`;
      fill.style.left = `${((a - min) / (max - min)) * 100}%`;
      fill.style.right = `${100 - ((b - min) / (max - min)) * 100}%`;
    };
    return wrap;
  }

  /** Osveži prikaz posle promene filtera ili kadra. */
  sync() {
    this.chipGroups.forEach((f) => f());
    this.areaSync();
    const n = this.store.activeCount();
    this.badge.textContent = n ? String(n) : '';
    this.badge.hidden = !n;
    this.updateHint();
  }

  updateHint() {
    const res = this.store.results();
    this.count.textContent = `Pronađeno: ${res.length} ${res.length === 1 ? 'stan' : 'stanova'}`;
    const cur = CONFIG.shots[this.hooks.currentShot()].prefix;
    const here = res.some((a) => a.shots.includes(cur));
    const target = CONFIG.shots.findIndex((s) => res.some((a) => a.shots.includes(s.prefix)));
    this.hint.hidden = here || target < 0;
    if (!this.hint.hidden) {
      this.hint.textContent = `Prikaži u pogledu ${target + 1}`;
      this.hint.onclick = () => this.hooks.goToShot(target);
    }
  }
}
