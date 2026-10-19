import { BASE } from '../config';

export type Status = 'free' | 'reserved' | 'sold';

export interface Apartment {
  id: string;
  label: string;
  building: string;
  floor: number;
  area: number;
  rooms: number;
  structure: string;
  orientation: string;
  balconyArea: number;
  status: Status;
  price: number | null;
  shots: string[];
  floorplan: string;
}

export const STATUS_LABEL: Record<Status, string> = { free: 'Slobodan', reserved: 'Rezervisan', sold: 'Prodat' };

export async function loadApartments(): Promise<Apartment[]> {
  const res = await fetch(`${BASE}data/apartments.json`);
  return res.json();
}
