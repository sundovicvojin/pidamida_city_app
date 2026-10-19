// Zajednička geometrija placeholdera: frameovi i SVG mape moraju da se poklapaju.
export const W = 1280;
export const H = 720;
export const SHOTS = ['Video2', 'Video3', 'Video4', 'Video5'];
export const FRAMES = 100;
export const FLOORS = 6;

// Kolona stana (0..3) -> kadrovi u kojima se vidi
const COL_SHOTS = [
  ['Video2', 'Video5'],
  ['Video2', 'Video3'],
  ['Video3', 'Video4'],
  ['Video4', 'Video5'],
];

export function aptShots(col) {
  return COL_SHOTS[col];
}

export function slotOf(shot, col) {
  return COL_SHOTS[col].indexOf(shot) === -1 ? -1 : visibleCols(shot).indexOf(col);
}

export function visibleCols(shot) {
  return [0, 1, 2, 3].filter((c) => COL_SHOTS[c].includes(shot));
}

/** Poligon (4 tačke) za sprat 1..FLOORS i slot 0..1 u datom kadru. shift = pomeraj tokom tranzicije. */
export function poly(shotIdx, floor, slot, shift = 0) {
  const x = 340 + shift + slot * 320;
  const y = 560 - floor * 78;
  const w = 300;
  const h = 72;
  const sk = shotIdx % 2 ? 30 : -30;
  return [
    [x, y + h],
    [x + w, y + h],
    [x + w + sk, y],
    [x + sk, y],
  ];
}

export const pts = (p) => p.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');

export function aptId(floor, col) {
  // Format ID-a: LA_xyy (LA = lamela A, x = sprat, yy = broj stana)
  return `LA_${floor}${String(col + 1).padStart(2, '0')}`;
}
