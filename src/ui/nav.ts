import { BASE, CONFIG } from '../config';

export interface NavHandlers {
  prev(): void;
  next(): void;
  goTo(i: number): void;
  home(): void;
}

const arrow = (dir: 'left' | 'right') =>
  `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="spinner"></span>`;

export class Nav {
  readonly top = document.createElement('header');
  private prevBtn = document.createElement('button');
  private nextBtn = document.createElement('button');
  private dots: HTMLButtonElement[] = [];

  constructor(host: HTMLElement, h: NavHandlers) {
    const top = this.top;
    top.className = 'topbar glass';
    top.innerHTML = `<img class="topbar__logo" src="${BASE}sb-company.png" alt="SB Company d.o.o." />`;
    const home = document.createElement('button');
    home.className = 'text-btn';
    home.textContent = 'Početna';
    home.onclick = h.home;
    top.append(home);
    if (document.fullscreenEnabled) {
      const fs = document.createElement('button');
      fs.className = 'text-btn fs-btn';
      fs.setAttribute('aria-label', 'Pun ekran');
      fs.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      fs.onclick = async () => {
        if (document.fullscreenElement) return void document.exitFullscreen();
        await document.documentElement.requestFullscreen().catch(() => {});
        // Android: zaključaj landscape u punom ekranu (iOS Safari to ne podržava)
        (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
      };
      top.append(fs);
    }

    this.prevBtn.className = 'arrow arrow--left glass';
    this.nextBtn.className = 'arrow arrow--right glass';
    this.prevBtn.innerHTML = arrow('left');
    this.nextBtn.innerHTML = arrow('right');
    this.prevBtn.setAttribute('aria-label', 'Prethodni pogled');
    this.nextBtn.setAttribute('aria-label', 'Sledeći pogled');
    this.prevBtn.onclick = h.prev;
    this.nextBtn.onclick = h.next;

    const dots = document.createElement('nav');
    dots.className = 'dots glass';
    dots.setAttribute('aria-label', 'Pogledi');
    CONFIG.shots.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'dot';
      b.setAttribute('aria-label', `Pogled ${i + 1}`);
      b.title = s.prefix;
      b.onclick = () => h.goTo(i);
      this.dots.push(b);
      dots.append(b);
    });

    const scrimTop = document.createElement('div');
    scrimTop.className = 'scrim scrim--top';
    const scrimBottom = document.createElement('div');
    scrimBottom.className = 'scrim scrim--bottom';
    const footer = document.createElement('footer');
    footer.className = 'footer';
    footer.innerHTML = `<span>${CONFIG.footerCredit}</span><span class="footer__sep">·</span><span>Created by <a href="https://www.instagram.com/devbyvojin/" target="_blank" rel="noopener">devbyvojin</a> &amp; <a href="https://www.instagram.com/lazares_media/" target="_blank" rel="noopener">lazares_media</a></span>`;

    host.append(scrimTop, scrimBottom, top, this.prevBtn, this.nextBtn, dots, footer);
  }

  setActive(i: number) {
    this.dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  }
  setLoading(v: boolean) {
    this.prevBtn.classList.toggle('is-loading', v);
    this.nextBtn.classList.toggle('is-loading', v);
  }
}
