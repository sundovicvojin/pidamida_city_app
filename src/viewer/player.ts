import { CONFIG } from '../config';
import { isLowEnd } from './device';
import type { FrameLoader } from './frameLoader';
import type { Stage } from './stage';

interface Ref {
  prefix: string;
  i: number;
}

export interface PlayerHooks {
  onStart(): void;
  onEnd(shot: number): void;
  onLoading(v: boolean): void;
}

const AHEAD = isLowEnd() ? CONFIG.decode.aheadLow : CONFIG.decode.ahead;
const BEHIND = 3;

export class Player {
  current = 0;
  playing = false;
  private pending: (() => void) | null = null;
  private stops = new Set<string>();

  constructor(
    private stage: Stage,
    private loader: FrameLoader,
    private hooks: PlayerHooks,
  ) {
    const n = CONFIG.shots.length;
    for (let s = 0; s < n; s++) this.stops.add(this.loader.key(this.prefix(s), this.loader.files(this.prefix(s))[0]));
  }

  private prefix = (s: number) => CONFIG.shots[s].prefix;
  private n = CONFIG.shots.length;
  private wrap = (s: number) => (s + this.n) % this.n;

  /** Nacrtaj mirnu sliku kadra (_000) bez animacije. */
  async showStill(shot: number) {
    const b = await this.loader.decode(this.prefix(shot), 0);
    if (b) this.stage.draw(b);
    this.current = shot;
  }

  // Komanda data tokom rotacije čeka (max 1) i računa se u odnosu na kadar na kom rotacija sleti.
  next = () => this.step(1);
  prev = () => this.step(-1);
  private step(dir: 1 | -1) {
    if (this.playing) this.pending = () => this.step(dir);
    else this.go(this.wrap(this.current + dir), dir);
  }

  /** Rotacija do kadra `target`; bez `dir` bira najkraći put. */
  go(target: number, dir?: 1 | -1) {
    if (this.playing) {
      this.pending = () => this.go(target, dir);
      return;
    }
    const diff = this.wrap(target - this.current);
    if (diff === 0) return;
    const forward = dir ? dir === 1 : diff <= this.n / 2;
    void this.play(target, forward ? 1 : -1, forward ? diff : this.n - diff);
  }

  /** Frameovi tranzicije: napred s_001..s_099 pa next_000; nazad prev_099..prev_000. */
  private buildRun(dir: 1 | -1, steps: number): Ref[] {
    const run: Ref[] = [];
    let s = this.current;
    for (let k = 0; k < steps; k++) {
      if (dir === 1) {
        const p = this.prefix(s);
        for (let i = 1; i < this.loader.files(p).length; i++) run.push({ prefix: p, i });
        s = this.wrap(s + 1);
        run.push({ prefix: this.prefix(s), i: 0 });
      } else {
        s = this.wrap(s - 1);
        const p = this.prefix(s);
        for (let i = this.loader.files(p).length - 1; i >= 0; i--) run.push({ prefix: p, i });
      }
    }
    return run.filter((r) => !this.loader.isFailed(r.prefix, r.i));
  }

  private ease(p: number) {
    const k = CONFIG.easing;
    const s = p * p * (3 - 2 * p);
    return p + (s - p) * k;
  }

  private async play(target: number, dir: 1 | -1, steps: number) {
    this.playing = true;
    this.loader.setPaused(true);
    const run = this.buildRun(dir, steps);

    // Cela rotacija mora biti u memoriji pre starta; inače se animacija seče.
    const missing = run.filter((r) => !this.loader.has(r.prefix, r.i));
    if (missing.length) {
      this.hooks.onLoading(true);
      await Promise.all(run.map((r) => this.loader.load(r.prefix, r.i, 0)));
      this.hooks.onLoading(false);
    }
    const warm = run.slice(0, AHEAD).map((r) => this.loader.decode(r.prefix, r.i));
    await Promise.all(warm);

    this.hooks.onStart();
    await this.animate(run);

    this.current = target;
    this.playing = false;
    this.loader.retain(this.stops);
    this.loader.setPaused(false);
    this.hooks.onEnd(target);
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      p();
    }
  }

  private animate(run: Ref[]) {
    const total = run.length;
    const durMs = (total / CONFIG.fps) * 1000;
    return new Promise<void>((resolve) => {
      let t = 0;
      let last = -1;
      let shown = -1;
      let stall = 0;
      const tick = (now: number) => {
        const dt = last < 0 ? 0 : Math.max(0, Math.min(now - last, 100));
        last = now;
        const idxFor = (time: number) => Math.min(total - 1, Math.floor(this.ease(Math.min(1, time / durMs)) * total));
        // +6 ms: granica frame-a ne pada tačno na granicu ekranskog ticka, pa nema 16/50 ms treperenja pri 30 fps na 60/120 Hz.
        const want = idxFor(t + dt + 6);

        // Dekodiranje unapred i klizni prozor bitmapa.
        const lo = Math.max(0, Math.max(shown, 0) - BEHIND);
        const keep = new Set(this.stops);
        for (let i = lo; i <= Math.min(total - 1, want + AHEAD); i++) {
          const r = run[i];
          keep.add(this.loader.key(r.prefix, this.loader.files(r.prefix)[r.i]));
          if (i > want && !this.loader.bitmap(r.prefix, r.i) && !this.loader.isDecoding(r.prefix, r.i)) {
            void this.loader.decode(r.prefix, r.i);
          }
        }
        this.loader.retain(keep);

        const r = run[want];
        const bmp = this.loader.bitmap(r.prefix, r.i);
        if (bmp) {
          t += dt;
          stall = 0;
          if (want !== shown) {
            this.stage.draw(bmp);
            shown = want;
          }
          if (want >= total - 1) return resolve();
        } else {
          // Frame još nije dekodiran: zadrži poslednji prikazan i čekaj (vreme stoji).
          void this.loader.decode(r.prefix, r.i);
          stall += dt;
          if (stall > 400) this.hooks.onLoading(true);
        }
        if (stall === 0) this.hooks.onLoading(false);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
