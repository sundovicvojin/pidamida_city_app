// Podaci koji su isti na svim brošurama. Menjaš ovde, ne u šablonu.
export const BROCHURE = {
  project: 'Piramida City',
  tagline: 'Savremeno stanovanje u srcu grada',
  buildings: { LA: 'Lamela A' },
  developer: 'SB Company d.o.o.',
  disclaimer:
    'Prikazi su informativnog karaktera. Površine, raspored i oprema mogu se neznatno razlikovati od izvedenog stanja. Nameštaj i dekor na izometriji nisu uključeni u cenu.',
  // Gornji deo tlocrta u public/floorplans sadrži ugrađeni naslov ("Stan 01 / A / I sprat") — odseca se.
  floorplanCropTop: 100,
  floorplanNoTitleFrom: 61, // tlocrti od A-61 (6. sprat) nemaju naslov, ne seku se
  statusLabel: { free: 'Slobodan', reserved: 'Rezervisan', sold: 'Prodat' },
};
