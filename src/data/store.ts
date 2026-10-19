import type { Apartment, Status } from './apartments';

export interface FilterState {
  floors: Set<number>;
  structures: Set<string>;
  statuses: Set<Status>;
  area: [number, number];
}

/** Prazan skup = bez ograničenja. */
export class Store {
  readonly bounds: [number, number];
  state: FilterState;
  private listeners = new Set<() => void>();
  private byId = new Map<string, Apartment>();

  constructor(readonly apts: Apartment[]) {
    apts.forEach((a) => this.byId.set(a.id, a));
    const areas = apts.map((a) => a.area);
    this.bounds = [Math.floor(Math.min(...areas)), Math.ceil(Math.max(...areas))];
    this.state = this.fresh();
    this.readUrl();
  }

  private fresh(): FilterState {
    return { floors: new Set(), structures: new Set(), statuses: new Set(), area: [...this.bounds] };
  }

  get(id: string) {
    return this.byId.get(id);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
  }

  update(fn: (s: FilterState) => void) {
    fn(this.state);
    this.writeUrl();
    this.listeners.forEach((l) => l());
  }

  reset() {
    this.state = this.fresh();
    this.writeUrl();
    this.listeners.forEach((l) => l());
  }

  matches(a: Apartment) {
    const s = this.state;
    return (
      (!s.floors.size || s.floors.has(a.floor)) &&
      (!s.structures.size || s.structures.has(a.structure)) &&
      (!s.statuses.size || s.statuses.has(a.status)) &&
      a.area >= s.area[0] &&
      a.area <= s.area[1]
    );
  }

  results() {
    return this.apts.filter((a) => this.matches(a));
  }

  activeCount() {
    const s = this.state;
    return (
      (s.floors.size ? 1 : 0) +
      (s.structures.size ? 1 : 0) +
      (s.statuses.size ? 1 : 0) +
      (s.area[0] !== this.bounds[0] || s.area[1] !== this.bounds[1] ? 1 : 0)
    );
  }

  private writeUrl() {
    const s = this.state;
    const p = new URLSearchParams(location.search);
    const set = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    set('floor', [...s.floors].join(','));
    set('struct', [...s.structures].join(','));
    set('status', [...s.statuses].join(','));
    set('area', s.area[0] !== this.bounds[0] || s.area[1] !== this.bounds[1] ? s.area.join('-') : '');
    const q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
  }

  private readUrl() {
    const p = new URLSearchParams(location.search);
    const list = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean);
    list('floor').forEach((v) => this.state.floors.add(Number(v)));
    list('struct').forEach((v) => this.state.structures.add(v));
    list('status').forEach((v) => this.state.statuses.add(v as Status));
    const [lo, hi] = (p.get('area') ?? '').split('-').map(Number);
    if (lo && hi) this.state.area = [Math.max(lo, this.bounds[0]), Math.min(hi, this.bounds[1])];
  }
}
