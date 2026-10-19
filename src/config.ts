export interface Shot {
  prefix: string;
  frames: number;
}

// Baza aplikacije ('/' na domenu/subdomenu, '/piramida/' u podfolderu): zadaje se pri buildu sa --base.
export const BASE = import.meta.env.BASE_URL;

export const CONFIG = {
  // Redosled kadrova = redosled rotacije. Svaki kadar ima SVOJ folder:
  // /renders/Video2/Video2_000.webp ... /renders/Video2/Video2_099.webp
  shots: [
    { prefix: 'Video2', frames: 100 },
    { prefix: 'Video3', frames: 100 },
    { prefix: 'Video4', frames: 100 },
    { prefix: 'Video5', frames: 100 },
  ] as Shot[],
  renderPath: `${BASE}renders/`, // URL kadra: `${renderPath}${prefix}/${prefix}_${NNN}.webp`
  svgPath: `${BASE}svg/`,
  frameExt: 'webp',
  pad: 3,
  fps: 30,
  maxDpr: 2,
  easing: 0, // 0 = linearno (ravnomerno, bez zastajkivanja); 1 = pun ease-in-out
  decode: { ahead: 16, aheadLow: 8 }, // koliko frameova unapred držimo dekodirano
  adaptiveResolution: true, // koristi /renders-1280/ itd. ako postoje
  // Tačka rendera koja ostaje u kadru kad se ekran suzi (0..1). 0.5/0.5 = centar.
  focus: { x: 0.5, y: 0.5 },
  loader: { blockUntil: 'auto' as 'all' | 'neighbors' | 'auto' },
  // aspect se NE upisuje ručno: čita se iz renders-manifest.json
  languages: ['sr', 'en'],
  defaultLang: 'sr',
  gtmId: 'GTM-XXXXXXX',
  contactEndpoint: '/api/send.php',
  // PLACEHOLDER: kad zvanični sajt dobije kontakt stranu, upiši njen URL. Podaci o stanu se šalju kao query parametri.
  inquiryUrl: 'https://example.com/kontakt/',
  brochureUrl: `${BASE}docs/brosura.pdf`,
  // Delovi SVG-a koji nisu stanovi, ali se prikazuju sivo sa porukom (npr. lamele u izgradnji).
  zones: { LB: 'Lamela B', LC: 'Lamela C' } as Record<string, string>,
  zoneNote: 'U izgradnji',
  soldClickable: false, // klik na prodat stan otvara karticu?
  footerCredit: '© 2026 SB Company d.o.o. Sva prava zadržana.',
};

/** Putanje iz JSON-a mogu biti '/floorplans/x.webp' ili 'floorplans/x.webp'; oba rade u podfolderu. */
export const asset = (p: string) => (/^(https?:)?\/\//.test(p) ? p : BASE + p.replace(/^\//, ''));

export const frameUrl = (prefix: string, i: number, base = CONFIG.renderPath) =>
  `${base}${prefix}/${prefix}_${String(i).padStart(CONFIG.pad, '0')}.${CONFIG.frameExt}`;
