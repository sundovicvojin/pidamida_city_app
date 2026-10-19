// Skenira public/renders* i generiše public/renders-manifest.json
// (fajlovi, bajtovi, dimenzije prvog framea, hash verzije keša).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const sets = fs.readdirSync(pub).filter((d) => /^renders(-\d+)?$/.test(d) && fs.statSync(path.join(pub, d)).isDirectory());

const manifest = { hash: '', sets: {} };
const h = crypto.createHash('sha1');

for (const set of sets.sort()) {
  const shots = {};
  let width = 0;
  let height = 0;
  for (const shot of fs.readdirSync(path.join(pub, set)).sort()) {
    const dir = path.join(pub, set, shot);
    if (!fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
    if (!files.length) continue;
    const sizes = files.map((f) => {
      const st = fs.statSync(path.join(dir, f));
      h.update(`${set}/${shot}/${f}:${st.size}:${st.mtimeMs | 0};`);
      return st.size;
    });
    if (!width) {
      const m = await sharp(path.join(dir, files[0])).metadata();
      width = m.width;
      height = m.height;
    }
    shots[shot] = { files, sizes };
  }
  manifest.sets[set] = { width, height, shots };
}
manifest.hash = h.digest('hex').slice(0, 10);

fs.writeFileSync(path.join(pub, 'renders-manifest.json'), JSON.stringify(manifest));
console.log(`[manifest] ${Object.keys(manifest.sets).join(', ') || '(prazno)'} · hash ${manifest.hash}`);
