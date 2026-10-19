export interface ShotManifest {
  files: string[];
  sizes: number[];
}
export interface SetManifest {
  width: number;
  height: number;
  shots: Record<string, ShotManifest>;
}

interface Task {
  key: string;
  prio: number; // 0 = kritično, 1 = susedni kadar, 2 = ostalo
  started: boolean;
  start: () => void;
}

const dev = import.meta.env.DEV;

/**
 * Učitavanje (fetch uz retry, red sa prioritetima, pauza) i dekodiranje (klizni prozor
 * ImageBitmap-a). Enkodirani blobovi ostaju u memoriji (mali), dekodirane bitmape se zatvaraju.
 */
export class FrameLoader {
  readonly blobs = new Map<string, Blob>();
  readonly failed = new Set<string>();
  readonly bitmaps = new Map<string, ImageBitmap>();
  paused = false;
  private tasks = new Map<string, Task>();
  private promises = new Map<string, Promise<void>>();
  private decoding = new Map<string, Promise<ImageBitmap | null>>();
  private queue: Task[] = [];
  private active = 0;

  constructor(
    private set: SetManifest,
    private setName: string,
    private hash: string,
    private concurrency = 6,
  ) {}

  files(prefix: string) {
    return this.set.shots[prefix]?.files ?? [];
  }
  key(prefix: string, file: string) {
    return `${prefix}/${file}`;
  }
  size(prefix: string, i: number) {
    return this.set.shots[prefix].sizes[i];
  }
  url(prefix: string, file: string) {
    return `${import.meta.env.BASE_URL}${this.setName}/${prefix}/${file}?v=${this.hash}`;
  }

  /** Učitaj jedan frame (dedupe; ako je već u redu, podiže mu prioritet). */
  load(prefix: string, i: number, prio = 1): Promise<void> {
    const file = this.files(prefix)[i];
    const key = this.key(prefix, file);
    if (this.blobs.has(key) || this.failed.has(key)) return Promise.resolve();
    const task = this.tasks.get(key);
    if (task) {
      if (!task.started && prio < task.prio) task.prio = prio;
      this.pump();
      return this.promises.get(key)!;
    }
    const p = new Promise<void>((resolve) => {
      const t: Task = {
        key,
        prio,
        started: false,
        start: () => {
          t.started = true;
          this.active++;
          void this.fetchWithRetry(prefix, file, key, t.prio).finally(() => {
            this.active--;
            this.tasks.delete(key);
            resolve();
            this.pump();
          });
        },
      };
      this.tasks.set(key, t);
      this.queue.push(t);
    });
    this.promises.set(key, p);
    this.pump();
    return p;
  }

  private pump() {
    while (this.active < this.concurrency) {
      let best = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const t = this.queue[i];
        if (this.paused && t.prio > 0) continue;
        if (best < 0 || t.prio < this.queue[best].prio) best = i;
      }
      if (best < 0) return;
      this.queue.splice(best, 1)[0].start();
    }
  }

  setPaused(v: boolean) {
    this.paused = v;
    if (!v) this.pump();
  }

  private async fetchWithRetry(prefix: string, file: string, key: string, prio: number) {
    const url = this.url(prefix, file);
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 20000);
      try {
        const res = await fetch(url, { signal: ctl.signal, priority: prio === 0 ? 'high' : 'low' } as RequestInit);
        if (res.status === 404) break;
        if (!res.ok) throw new Error(String(res.status));
        this.blobs.set(key, await res.blob());
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 300 * 3 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    this.failed.add(key);
    (dev ? console.error : console.warn)(`[frames] frame se ne može učitati, preskačem: ${url}`);
  }

  has(prefix: string, i: number) {
    const key = this.key(prefix, this.files(prefix)[i]);
    return this.blobs.has(key) || this.failed.has(key);
  }
  isFailed(prefix: string, i: number) {
    return this.failed.has(this.key(prefix, this.files(prefix)[i]));
  }

  bitmap(prefix: string, i: number) {
    return this.bitmaps.get(this.key(prefix, this.files(prefix)[i]));
  }

  /** Dekodira frame (ako je blob stigao). */
  decode(prefix: string, i: number): Promise<ImageBitmap | null> {
    const key = this.key(prefix, this.files(prefix)[i]);
    const have = this.bitmaps.get(key);
    if (have) return Promise.resolve(have);
    const blob = this.blobs.get(key);
    if (!blob) return Promise.resolve(null);
    let p = this.decoding.get(key);
    if (!p) {
      p = createImageBitmap(blob)
        .then((b) => {
          this.bitmaps.set(key, b);
          return b;
        })
        .catch(() => {
          this.failed.add(key);
          return null;
        })
        .finally(() => this.decoding.delete(key));
      this.decoding.set(key, p);
    }
    return p;
  }

  isDecoding(prefix: string, i: number) {
    return this.decoding.has(this.key(prefix, this.files(prefix)[i]));
  }

  /** Zatvara sve bitmape koje nisu u skupu `keep`. */
  retain(keep: Set<string>) {
    for (const [k, b] of this.bitmaps) {
      if (!keep.has(k)) {
        b.close();
        this.bitmaps.delete(k);
      }
    }
  }
}
