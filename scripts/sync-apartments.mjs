// Čita SVG mape (public/svg/*.svg), pronalazi ID-jeve stanova i usklađuje public/data/apartments.json:
//  - novi stan dobija podrazumevane (placeholder) vrednosti koje ručno menjaš u JSON-u,
//  - postojeći stan zadržava sve što si upisao, a osvežava se samo "shots" (u kojim se kadrovima vidi),
//  - prijavljuje stanove iz JSON-a kojih nema ni u jednom SVG-u.
// Pokretanje: npm run apartments
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svgDir = path.join(root, 'public', 'svg');
const jsonPath = path.join(root, 'public', 'data', 'apartments.json');

// Stan = id oblika LA-01 ... LA-67 (ostalo u SVG-u: LB, LC, Frame..., Grupa1 se ignoriše)
const ID_RE = /^L[A-Z]-\d+$/;
const PER_FLOOR = 12; // LA-01..LA-12 = 1. sprat, LA-13..LA-24 = 2. sprat ... LA-61..LA-67 = 6. sprat

const shotsById = new Map();
for (const file of fs.readdirSync(svgDir).filter((f) => f.endsWith('.svg')).sort()) {
  const prefix = file.replace(/\.svg$/, '');
  const text = fs.readFileSync(path.join(svgDir, file), 'utf8');
  for (const m of text.matchAll(/\bid="([^"]+)"/g)) {
    if (!ID_RE.test(m[1])) continue;
    if (!shotsById.has(m[1])) shotsById.set(m[1], []);
    const list = shotsById.get(m[1]);
    if (!list.includes(prefix)) list.push(prefix);
  }
}

const types = [
  ['garsonjera', 1.0, 27],
  ['jednosoban', 1.0, 38],
  ['jednoiposoban', 1.5, 46],
  ['dvosoban', 2.0, 57],
  ['dvoiposoban', 2.5, 68],
];
const orient = ['jug', 'jug-istok', 'istok', 'sever-istok', 'sever', 'zapad'];

const defaults = (id) => {
  const n = Number(id.split('-')[1]);
  const [structure, rooms, base] = types[(n - 1) % types.length];
  return {
    id,
    label: `Stan ${id}`,
    building: id.slice(0, 2),
    floor: Math.ceil(n / PER_FLOOR),
    area: Math.round((base + (n % 4) * 1.3) * 10) / 10,
    rooms,
    structure,
    orientation: orient[n % orient.length],
    balconyArea: 3 + (n % 5),
    status: 'free',
    price: null,
    shots: [],
    floorplan: `floorplans/${id.replace(/^L/, "")}.webp`,
    isometric: '', // naziv fajla iz public/isometric/ (npr. 'iso-01.webp'), putanja ili pun link; prazno = bez izometrije
  };
};

const existing = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : [];
const byId = new Map(existing.map((a) => [a.id, a]));
const ids = [...shotsById.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

let added = 0;
const out = ids.map((id) => {
  const prev = byId.get(id);
  if (!prev) added++;
  const a = { ...defaults(id), ...(prev ?? {}) };
  a.shots = shotsById.get(id); // izvor istine su SVG-ovi
  return a;
});
const orphans = existing.filter((a) => !shotsById.has(a.id)).map((a) => a.id);

fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2) + '\n');
console.log(`[apartments] ${out.length} stanova (${added} novih) -> public/data/apartments.json`);
if (orphans.length) console.warn(`[apartments] UPOZORENJE: u JSON-u su, a nema ih ni u jednom SVG-u (izbačeni): ${orphans.join(', ')}`);
