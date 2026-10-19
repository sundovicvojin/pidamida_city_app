import { CONFIG } from '../config';

interface NetInfo {
  saveData?: boolean;
  effectiveType?: string;
}
const nav = navigator as Navigator & { connection?: NetInfo; deviceMemory?: number };

export const isCoarse = matchMedia('(pointer: coarse)').matches;

/** Mobilni uređaj, saveData ili spora veza: učitavamo samo susedne kadrove. */
export function isConstrained(): boolean {
  const c = nav.connection;
  if (c?.saveData) return true;
  if (c?.effectiveType && c.effectiveType !== '4g') return true;
  return isCoarse && Math.min(screen.width, screen.height) < 900;
}

export function isLowEnd(): boolean {
  const mem = nav.deviceMemory ?? 8;
  return mem <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
}

export function resolveBlockUntil(): 'all' | 'neighbors' {
  const b = CONFIG.loader.blockUntil;
  return b === 'auto' ? (isConstrained() ? 'neighbors' : 'all') : b;
}

/** Bira set rendera (renders, renders-1280...) prema ekranu i uređaju. Bez dodatnih foldera = 'renders'. */
export function pickSet(sets: Record<string, { width: number }>): string {
  const names = Object.keys(sets);
  if (!CONFIG.adaptiveResolution || names.length < 2) return names.includes('renders') ? 'renders' : names[0];
  let need = innerWidth * Math.min(devicePixelRatio || 1, CONFIG.maxDpr);
  if (isConstrained() || isLowEnd()) need *= 0.75;
  const sorted = names.sort((a, b) => sets[a].width - sets[b].width);
  return sorted.find((n) => sets[n].width >= need) ?? sorted[sorted.length - 1];
}
