import { CONFIG } from '../config';
import type { Apartment } from './apartments';

const nf = new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const pf = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtArea = (n: number) => nf.format(n);
export const fmtPrice = (p: number | null) => (p ? `${pf.format(p)} €` : 'Na upit');

/** Link ka kontakt strani sa podacima o stanu. */
export function inquiryUrl(a: Apartment) {
  const u = new URL(CONFIG.inquiryUrl, location.href);
  u.searchParams.set('stan', a.id);
  u.searchParams.set('lamela', a.building);
  u.searchParams.set('sprat', String(a.floor));
  u.searchParams.set('kvadratura', String(a.area));
  u.searchParams.set('struktura', a.structure);
  u.searchParams.set('izvor', 'piramida-city');
  return u.toString();
}
