import '@fontsource-variable/manrope';
import '@fontsource-variable/outfit';
import './styles/main.css';
import { BASE, CONFIG } from './config';
import { Stage } from './viewer/stage';
import { FrameLoader, type SetManifest } from './viewer/frameLoader';
import { Player } from './viewer/player';
import { attachSwipe } from './viewer/gestures';
import { isConstrained, isLowEnd, pickSet, resolveBlockUntil } from './viewer/device';
import { Loader } from './ui/loader';
import { initOrientation } from './ui/orientation';
import { Nav } from './ui/nav';
import { Filters } from './ui/filters';
import { Overlay } from './viewer/overlay';
import { ApartmentModal } from './ui/apartmentModal';
import { Tooltip } from './ui/tooltip';
import { Store } from './data/store';
import { loadApartments } from './data/apartments';

interface Manifest {
  hash: string;
  sets: Record<string, SetManifest>;
}

async function registerSW(hash: string) {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(`${BASE}sw.js?v=${hash}`);
    await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch (e) {
    console.warn('[sw] registracija nije uspela', e);
  }
}

async function boot() {
  const app = document.getElementById('app')!;
  if (isLowEnd() || isConstrained()) app.classList.add('lite');
  initOrientation();
  // iOS: spreči pinch-zoom stranice (viewport meta se ignoriše).
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  const loaderUi = new Loader(app);

  const manifest: Manifest = await (await fetch(`${BASE}renders-manifest.json`, { cache: 'no-cache' })).json();
  const setName = pickSet(manifest.sets);
  const set = manifest.sets[setName];
  await registerSW(manifest.hash);

  const stage = new Stage(app, set.width, set.height);
  const frames = new FrameLoader(set, setName, manifest.hash);
  const shots = CONFIG.shots.map((s) => s.prefix);
  const N = shots.length;

  // --- Faza A: stop frameovi + SVG + podaci (kritično), pa tranzicije prema blockUntil ---
  const required = new Map<string, number>();
  const reqPromises: Promise<void>[] = [];
  const need = (si: number, i: number) => {
    const key = frames.key(shots[si], frames.files(shots[si])[i]);
    if (required.has(key)) return;
    required.set(key, frames.size(shots[si], i));
  };
  shots.forEach((_, si) => need(si, 0));
  const mode = resolveBlockUntil();
  const blockShots = mode === 'all' ? shots.map((_, i) => i) : [0, N - 1];
  for (const si of blockShots) frames.files(shots[si]).forEach((_, i) => need(si, i));

  const totalBytes = [...required.values()].reduce((a, b) => a + b, 0) || 1;
  let doneBytes = 0;
  const bump = (n: number) => loaderUi.set((doneBytes += n) / totalBytes);

  // Redosled: stop frameovi prvi, pa tranzicije.
  const order = [...required.keys()];
  order.sort((a, b) => Number(!a.endsWith('_000.webp')) - Number(!b.endsWith('_000.webp')));
  for (const key of order) {
    const [prefix, file] = key.split('/');
    const i = frames.files(prefix).indexOf(file);
    reqPromises.push(frames.load(prefix, i, 0).then(() => bump(required.get(key)!)));
  }

  const store = new Store(await loadApartments());
  const overlay = new Overlay(stage.overlay, store);
  const aux = Promise.all(
    [...shots, CONFIG.roof.prefix].map(async (s) => {
      const r = await fetch(`${CONFIG.svgPath}${s}.svg`);
      overlay.setSvg(s, r.ok ? await r.text() : '');
    }),
  );
  await Promise.all([...reqPromises, aux]);

  // --- Player, navigacija, filteri ---
  let nav!: Nav;
  let filters!: Filters;
  const showOverlay = (si: number) => {
    overlay.show(player.roof ? CONFIG.roof.prefix : shots[si]);
    app.classList.remove('is-rotating');
    app.classList.toggle('on-roof', player.roof);
    app.classList.toggle('can-roof', !player.roof && si === 0);
    nav.setActive(si);
    filters.updateHint();
  };
  const player = new Player(stage, frames, {
    onStart: () => app.classList.add('is-rotating'),
    onLoading: (v) => nav.setLoading(v),
    onRoof: () => {},
    onEnd: (si) => {
      showOverlay(si);
      prefetch(si);
    },
  });

  nav = new Nav(app, {
    prev: player.prev,
    next: player.next,
    up: player.roofUp,
    down: player.roofDown,
    goTo: (i) => player.go(i),
    home: () => player.go(0),
  });
  const modal = new ApartmentModal(store);
  new Tooltip(stage.overlay, store, { open: (a) => modal.open(a) }, CONFIG.soldClickable);
  filters = new Filters(app, store, { currentShot: () => player.current,
    currentPrefix: () => (player.roof ? CONFIG.roof.prefix : CONFIG.shots[player.current].prefix), goToShot: (i) => {
      if (player.roof) player.roofDown();
      player.go(i);
    } });
  app.append(filters.button);

  // --- Faza B: pozadinsko učitavanje ---
  const prefetch = (cur: number) => {
    const near = [(cur + 1) % N, (cur + N - 1) % N];
    const rest = shots.map((_, i) => i).filter((i) => !near.includes(i) && i !== cur);
    const group = (list: number[], prio: number) =>
      list.forEach((si) => frames.files(shots[si]).forEach((_, i) => void frames.load(shots[si], i, prio)));
    group(near, 1);
    if (!isConstrained()) group(rest, 2);
  };

  await player.showStill(0);
  showOverlay(0);
  await loaderUi.hide();
  prefetch(0);

  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') player.next();
    if (e.key === 'ArrowLeft') player.prev();
    if (e.key === 'ArrowUp') player.roofUp();
    if (e.key === 'ArrowDown') player.roofDown();
  });
  attachSwipe(app, (dir) => (dir === 1 ? player.next() : player.prev()));
  if (!isConstrained()) frames.files(CONFIG.roof.prefix).forEach((_, i) => void frames.load(CONFIG.roof.prefix, i, 2));

  if (new URLSearchParams(location.search).has('debug')) devStatus(app, frames, manifest.hash, player);
}

function devStatus(app: HTMLElement, frames: FrameLoader, hash: string, player: Player) {
  const el = document.createElement('div');
  el.className = 'dev-badge';
  app.append(el);
  setInterval(async () => {
    let cached = 0;
    try {
      cached = (await (await caches.open(`piramida-renders-${hash}`)).keys()).length;
    } catch {
      /* ignore */
    }
    el.textContent = `kadar ${CONFIG.shots[player.current].prefix} · blob ${frames.blobs.size} · dekodirano ${frames.bitmaps.size} · keš ${cached}${frames.failed.size ? ` · greške ${frames.failed.size}` : ''}`;
  }, 500);
}

void boot();
