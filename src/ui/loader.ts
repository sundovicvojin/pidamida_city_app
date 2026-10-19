export class Loader {
  private el = document.createElement('div');
  private pct = document.createElement('div');
  private bar = document.createElement('i');

  constructor(host: HTMLElement) {
    this.el.className = 'loader';
    this.el.innerHTML = `<img class="loader__logo" src="${import.meta.env.BASE_URL}logo.svg" alt="PIRAMIDA CITY" />`;
    this.pct.className = 'loader__pct';
    const line = document.createElement('div');
    line.className = 'loader__line';
    line.append(this.bar);
    this.el.append(this.pct, line);
    host.append(this.el);
    this.set(0);
  }

  set(p: number) {
    const v = Math.round(Math.min(1, p) * 100);
    this.pct.textContent = `${v}%`;
    this.bar.style.transform = `scaleX(${v / 100})`;
  }

  hide() {
    this.el.classList.add('is-hidden');
    return new Promise<void>((r) => setTimeout(() => (this.el.remove(), r()), 700));
  }
}
