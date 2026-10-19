import { CONFIG } from '../config';

/**
 * Stage = element fiksnog odnosa strana rendera. Canvas i SVG overlay su deca istog
 * elementa, pa im je transform (object-fit: cover + focus) identičan i poligoni se
 * uvek poklapaju sa renderom.
 */
export class Stage {
  readonly el = document.createElement('div');
  readonly canvas = document.createElement('canvas');
  readonly overlay = document.createElement('div');
  private ctx = this.canvas.getContext('2d', { alpha: false })!;
  private last: CanvasImageSource | null = null;

  constructor(
    host: HTMLElement,
    readonly width: number,
    readonly height: number,
  ) {
    this.el.className = 'stage';
    this.canvas.className = 'stage__canvas';
    this.overlay.className = 'stage__overlay';
    this.el.append(this.canvas, this.overlay);
    host.prepend(this.el);
    addEventListener('resize', this.resize);
    addEventListener('orientationchange', this.resize);
    this.resize();
  }

  private resize = () => {
    const vw = innerWidth;
    const vh = innerHeight;
    const scale = Math.max(vw / this.width, vh / this.height);
    const w = this.width * scale;
    const h = this.height * scale;
    const x = (vw - w) * CONFIG.focus.x;
    const y = (vh - h) * CONFIG.focus.y;
    this.el.style.cssText = `width:${w}px;height:${h}px;transform:translate(${x}px,${y}px)`;

    const dpr = Math.min(devicePixelRatio || 1, CONFIG.maxDpr);
    // Nema smisla crtati više piksela nego što render ima.
    const k = Math.min(dpr, this.width / w);
    this.canvas.width = Math.round(w * k);
    this.canvas.height = Math.round(h * k);
    if (this.last) this.draw(this.last);
  };

  draw(src: CanvasImageSource) {
    this.last = src;
    try {
      this.ctx.drawImage(src, 0, 0, this.canvas.width, this.canvas.height);
    } catch {
      /* bitmapa je već zatvorena (resize usred rotacije); sledeći frame to ispravlja */
    }
  }
}
