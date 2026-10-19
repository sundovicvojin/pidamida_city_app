// Generiše placeholder frameove, SVG mape i apartments.json.
// NIKAD ne prepisuje postojeće prave fajlove (preskače folder koji već ima frameove).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { W, H, SHOTS, FRAMES, FLOORS, poly, pts, aptId, aptShots, visibleCols } from './lib/layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...p) => path.join(root, 'public', ...p);
const pad = (n) => String(n).padStart(3, '0');

// ---------- apartments.json ----------
function makeApartments() {
  const structures = [
    [1.0, 'garsonjera', 28],
    [1.5, 'jednoiposoban', 41],
    [2.0, 'dvosoban', 55],
    [2.5, 'dvoiposoban', 68],
  ];
  const orient = ['jug', 'jug-istok', 'istok', 'sever-istok'];
  const list = [];
  for (let f = 1; f <= FLOORS; f++) {
    for (let c = 0; c < 4; c++) {
      const [rooms, structure, base] = structures[(c + f) % 4];
      const n = f * 4 + c;
      list.push({
        id: aptId(f, c),
        label: `Stan ${aptId(f, c)}`,
        building: 'LA',
        floor: f,
        area: Math.round((base + (n % 5) * 1.7) * 10) / 10,
        rooms,
        structure,
        orientation: orient[c],
        balconyArea: 4 + (n % 4),
        status: n % 7 === 0 ? 'sold' : n % 5 === 0 ? 'reserved' : 'free',
        price: n % 3 === 0 ? null : 1650 * (base + (n % 5) * 1.7) | 0,
        shots: aptShots(c),
        floorplan: `/floorplans/${aptId(f, c)}.svg`,
      });
    }
  }
  return list;
}

const aptPath = pub('data', 'apartments.json');
if (!fs.existsSync(aptPath)) {
  fs.writeFileSync(aptPath, JSON.stringify(makeApartments(), null, 2));
  console.log('[placeholders] apartments.json');
}
const apts = JSON.parse(fs.readFileSync(aptPath, 'utf8'));

// ---------- SVG mape ----------
SHOTS.forEach((shot, si) => {
  const file = pub('svg', `${shot}.svg`);
  if (fs.existsSync(file)) return;
  const items = [];
  for (const c of visibleCols(shot)) {
    const slot = visibleCols(shot).indexOf(c);
    for (let f = 1; f <= FLOORS; f++) {
      const id = aptId(f, c);
      if (apts.some((a) => a.id === id)) {
        items.push(`  <polygon id="apt-${id}" points="${pts(poly(si, f, slot))}" fill="#fff" fill-opacity=".1" stroke="#fff"/>`);
      }
    }
  }
  fs.writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">\n${items.join('\n')}\n</svg>\n`);
  console.log('[placeholders] svg/' + shot + '.svg');
});

// ---------- frameovi ----------
const hues = [215, 160, 28, 280];
async function frame(si, i) {
  const shot = SHOTS[si];
  const next = SHOTS[(si + 1) % SHOTS.length];
  const t = i / FRAMES;
  const hue = Math.round(hues[si] + (hues[(si + 1) % 4] - hues[si]) * t);
  const shift = i === 0 ? 0 : Math.sin(t * Math.PI) * 140;
  const cells = [];
  for (const c of visibleCols(shot)) {
    const slot = visibleCols(shot).indexOf(c);
    for (let f = 1; f <= FLOORS; f++) {
      const p = poly(si, f, slot, shift);
      cells.push(`<polygon points="${pts(p)}" fill="hsl(${hue} 22% ${30 + f * 3}%)" stroke="hsl(${hue} 20% 60%)" stroke-width="2"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 30% 22%)"/><stop offset="1" stop-color="hsl(${hue} 25% 8%)"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<rect y="570" width="${W}" height="150" fill="hsl(${hue} 15% 10%)"/>
${cells.join('')}
<text x="40" y="70" fill="#fff" font-family="sans-serif" font-size="44" font-weight="300">${shot}_${pad(i)}</text>
<text x="40" y="100" fill="#fff" fill-opacity=".6" font-family="sans-serif" font-size="20">${i === 0 ? 'STOP kadar' : 'tranzicija → ' + next + '_000'}</text>
<rect x="0" y="${H - 8}" width="${W * t}" height="8" fill="#c9a96e"/>
</svg>`;
  const out = pub('renders', shot, `${shot}_${pad(i)}.webp`);
  await sharp(Buffer.from(svg)).webp({ quality: 45 }).toFile(out);
}

for (let si = 0; si < SHOTS.length; si++) {
  const dir = pub('renders', SHOTS[si]);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).some((f) => f.endsWith('.webp'))) {
    console.log(`[placeholders] ${SHOTS[si]}: već ima frameove, preskačem`);
    continue;
  }
  await Promise.all(Array.from({ length: FRAMES }, (_, i) => frame(si, i)));
  console.log(`[placeholders] ${SHOTS[si]}: ${FRAMES} frameova`);
}
