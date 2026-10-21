const VS = `attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}`;
const FS = `precision highp float;varying vec2 v;uniform sampler2D t;uniform vec2 r;uniform float yaw,pitch,fov;
void main(){
  vec2 q=v*vec2(r.x/r.y,1.)*tan(fov*.5);
  vec3 d=normalize(vec3(q,-1.));
  float cp=cos(pitch),sp=sin(pitch),cy=cos(yaw),sy=sin(yaw);
  d=vec3(d.x,d.y*cp-d.z*sp,d.y*sp+d.z*cp);
  d=vec3(d.x*cy+d.z*sy,d.y,-d.x*sy+d.z*cy);
  gl_FragColor=texture2D(t,vec2(atan(d.x,-d.z)/6.2831853+.5,acos(clamp(d.y,-1.,1.))/3.1415927));
}`;

/** Celoekranski 360° prikazivač (equirectangular slika) bez zavisnosti. Prevlačenje = rotacija; zoom je isključen, ugao je fiksno širok. */
const FOV = 1.6; // vertikalni ugao u radijanima (~92°), širokougaono
export class PanoramaViewer {
  private root = document.createElement('div');
  private canvas = document.createElement('canvas');
  private msg = document.createElement('p');
  private gl: WebGLRenderingContext | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private yaw = 0;
  private pitch = 0;
    private raf = 0;
  private token = 0;
  private pointers = new Map<number, { x: number; y: number }>();

  constructor() {
    this.root.className = 'pano';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.msg.className = 'pano__msg';
    const close = document.createElement('button');
    close.className = 'modal__close pano__close';
    close.setAttribute('aria-label', 'Zatvori 360° pogled');
    close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    close.onclick = () => this.close();
    this.root.append(this.canvas, this.msg, close);
    document.body.append(this.root);

    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    c.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const k = FOV / c.clientHeight;
      this.yaw -= (e.clientX - prev.x) * k;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + (e.clientY - prev.y) * k));
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const up = (e: PointerEvent) => this.pointers.delete(e.pointerId);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    addEventListener('resize', () => this.isOpen && this.resize());
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(url: string, label: string) {
    this.root.setAttribute('aria-label', `${label} – 360° pogled`);
    this.root.hidden = false;
    this.msg.textContent = 'Učitavanje…';
    this.msg.hidden = false;
    this.yaw = 0;
    this.pitch = 0;
    const token = ++this.token;
    const img = new Image();
    img.onload = () => {
      if (token !== this.token || !this.isOpen) return;
      if (!this.init() || !this.upload(img)) return void (this.msg.textContent = '360° pogled nije podržan na ovom uređaju.');
      this.msg.hidden = true;
      this.resize();
      this.loop();
    };
    img.onerror = () => token === this.token && (this.msg.textContent = '360° slika uskoro.');
    img.src = url;
    this.root.querySelector<HTMLElement>('.pano__close')!.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.token++;
    this.root.hidden = true;
    cancelAnimationFrame(this.raf);
    this.pointers.clear();
    if (this.gl && this.tex) (this.gl.deleteTexture(this.tex), (this.tex = null));
  }

  private init() {
    if (this.gl) return true;
    const gl = this.canvas.getContext('webgl');
    if (!gl) return false;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['t', 'r', 'yaw', 'pitch', 'fov']) this.u[n] = gl.getUniformLocation(prog, n);
    this.gl = gl;
    return true;
  }

  private upload(img: HTMLImageElement) {
    const gl = this.gl!;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    let src: TexImageSource = img;
    if (img.naturalWidth > max) {
      const c = document.createElement('canvas');
      c.width = max;
      c.height = Math.round((img.naturalHeight * max) / img.naturalWidth);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      src = c;
    }
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    // NPOT tekstura: bez mipmapa, CLAMP po visini; horizontalni šav rešava atan() u šejderu
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  }

  private resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
  }

  private loop = () => {
    const gl = this.gl;
    if (!gl || !this.isOpen || !this.tex) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform1i(this.u.t, 0);
    gl.uniform2f(this.u.r, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.yaw, this.yaw);
    gl.uniform1f(this.u.pitch, this.pitch);
    gl.uniform1f(this.u.fov, FOV);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.raf = requestAnimationFrame(this.loop);
  };
}
