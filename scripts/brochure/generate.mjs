// Generator brošura: za svaki stan iz public/data/apartments.json pravi A4 PDF (2 strane) istog dizajna.
//   npm run brochure -- LA-01            jedan stan
//   npm run brochure -- LA-01 LA-14      više stanova
//   npm run brochure -- --floor 3        svi stanovi sa 3. sprata
//   npm run brochure -- --all            svi stanovi
//   dodaj --html da zadržiš i HTML (brochures/html/ (u korenu)) · --status free filtrira po statusu
// Štampa preko Chromium-based pregledača (Brave/Chrome); drugi put: CHROME_PATH=/putanja/do/browsera
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { BROCHURE } from './config.mjs';
import { renderBrochure } from './template.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pub = path.join(root, 'public');
const outDir = path.join(pub, 'brochures'); // servira se kao /brochures/LA-01.pdf (dugme "Skini brošuru")
const cacheDir = path.join(root, 'brochures', '.cache');
const htmlDir = path.join(root, 'brochures', 'html');

const BROWSERS = [
  process.env.CHROME_PATH,
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = BROWSERS.find((p) => fs.existsSync(p));
if (!browser) { console.error('Nije pronađen Chrome/Brave. Postavi CHROME_PATH.'); process.exit(1); }

// ---- argumenti
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const valueArgs = new Set([opt('floor'), opt('status')].filter(Boolean));
const ids = args.filter((a) => !a.startsWith('--') && !valueArgs.has(a));

const all = JSON.parse(fs.readFileSync(path.join(pub, 'data', 'apartments.json'), 'utf8'));
let list = all;
if (ids.length) list = all.filter((a) => ids.includes(a.id));
else if (opt('floor')) list = all.filter((a) => String(a.floor) === opt('floor'));
else if (!flag('all')) { console.error('Navedi stan (npr. LA-01), --floor N ili --all.'); process.exit(1); }
if (opt('status')) list = list.filter((a) => a.status === opt('status'));
for (const id of ids) if (!all.some((a) => a.id === id)) console.warn(`! ${id} ne postoji u JSON-u`);
if (!list.length) { console.error('Nema stanova za zadate kriterijume.'); process.exit(1); }

// ---- resursi
// Fontovi se ugrađuju kao base64 (pouzdanije od file:// u headless štampi).
const fontUrl = (pkg, file) =>
  'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'node_modules', '@fontsource-variable', pkg, 'files', file)).toString('base64');
const fontFace = (family, pkg) =>
  [['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
   ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF']]
    .map(([sub, range]) => `@font-face{font-family:'${family}';font-weight:100 900;src:url('${fontUrl(pkg, `${pkg}-${sub}-wght-normal.woff2`)}') format('woff2');unicode-range:${range}}`)
    .join('\n');
const css = fontFace('Manrope', 'manrope') + '\n' + fontFace('Outfit', 'outfit') + '\n' +
  fs.readFileSync(path.join(import.meta.dirname, 'brochure.css'), 'utf8').replace(/@font-face[^\n]*\n/g, '');
const logoSvg = fs.readFileSync(path.join(pub, 'logo.svg'), 'utf8');
const logoUrl = pathToFileURL(path.join(pub, 'logo.svg')).href;
// Tamna varijanta loga (za svetlu pozadinu): svetli tekst -> tamni.
const logoDkUrl = 'data:image/svg+xml;base64,' + Buffer.from(logoSvg.replace(/#f2efe9/gi, '#0b0c0f').replace(/#c9a96e/gi, '#a8873f')).toString('base64');

const resolveAsset = (p, dir) => {
  if (!p) return null;
  const rel = /\//.test(p) ? p.replace(/^\//, '') : `${dir}/${p}`;
  const abs = path.join(pub, rel);
  return fs.existsSync(abs) ? abs : null;
};

const cropped = new Map();
/** Tlocrti imaju ugrađen naslov na vrhu ("Stan 01 · A / I sprat") — seče se i kešira. */
async function floorplanUrl(p) {
  const abs = resolveAsset(p, 'floorplans');
  if (!abs) return null;
  if (!cropped.has(abs)) {
    const out = path.join(cacheDir, `${path.basename(abs, path.extname(abs))}.png`);
    const { width, height } = await sharp(abs).metadata();
    fs.mkdirSync(cacheDir, { recursive: true });
    // Samo tlocrti sa ugrađenim naslovom (1.–5. sprat); tlocrti 6. sprata ga nemaju.
    const n = Number(path.basename(abs).match(/(\d+)/)?.[1]);
    const top = n >= BROCHURE.floorplanNoTitleFrom ? 0 : BROCHURE.floorplanCropTop;
    const body = await sharp(abs).extract({ left: 0, top, width, height: height - top }).png().toBuffer();
    await sharp(body).trim({ threshold: 8 }).png().toFile(out);
    cropped.set(abs, pathToFileURL(out).href);
  }
  return cropped.get(abs);
}

fs.mkdirSync(htmlDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
let ok = 0;
for (const a of list) {
  const iso = resolveAsset(a.isometric, 'isometric');
  const img = { isometric: iso && pathToFileURL(iso).href, floorplan: await floorplanUrl(a.floorplan) };
  const floors = Math.max(...all.filter((x) => x.building === a.building).map((x) => x.floor));
  const html = renderBrochure(a, img, floors).replace('{{CSS}}', css).replaceAll('{{LOGO_DK}}', logoDkUrl).replaceAll('{{LOGO}}', logoUrl);
  const htmlPath = path.join(htmlDir, `${a.id}.html`);
  const pdfPath = path.join(outDir, `${a.id}.pdf`);
  fs.writeFileSync(htmlPath, html);
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files',
    '--virtual-time-budget=4000', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore' });
  const miss = [!img.isometric && 'izometrija', !img.floorplan && 'tlocrt'].filter(Boolean);
  console.log(`✓ ${a.id}${miss.length ? `  (nedostaje: ${miss.join(', ')})` : ''}`);
  ok++;
  if (!flag('html')) fs.rmSync(htmlPath);
}
if (!flag('html')) fs.rmSync(htmlDir, { recursive: true, force: true });
console.log(`\nGotovo: ${ok} brošura → ${path.relative(root, outDir)}/`);
