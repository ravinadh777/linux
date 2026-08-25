// ─────────────────────────────────────────────────────────────────────────────
// The dashboard's "Frequently used services" tiles — the prototype's 12-service
// list, mapped onto routes that exist in this app.
//
// MINISTER'S CHANGE #1: the prototype's tile reads "Housing Permits". It is
// "Housing" here, as instructed.
//
// MINISTER'S CHANGE #2: "Firearms & Licensing" becomes the consolidated
// "Permits" tile, pointing at /permits, which lists every permit across Housing,
// the Police Force, Firearms and Home Affairs.
//
// Every `to` resolves to a real route. A tile never points at a dead link — the
// prototype's tiles were inert, and a tile that does nothing is worse than no
// tile on a government portal.
// ─────────────────────────────────────────────────────────────────────────────

export const QUICK_SERVICES = [
  { id: 'passport', label: 'Passport Services', glyph: 'passport', to: '/services/passport-new' },
  { id: 'tin', label: 'TIN & Tax Services', glyph: 'tax', to: '/services/tin-register' },
  { id: 'civil', label: 'Civil Registration', glyph: 'certificate', to: '/civil-registration' },
  // Minister #1 — was "Housing Permits".
  { id: 'housing', label: 'Housing', glyph: 'house', to: '/services/construction-permit' },
  // Minister #2 — one Permits destination covering every permit-issuing agency.
  { id: 'permits', label: 'Permits', glyph: 'stamp', to: '/permits' },
  { id: 'grants', label: 'Grants & Cash Transfers', glyph: 'grant', to: '/services/cash-grant' },
  { id: 'pension', label: 'Old-Age Pension', glyph: 'elderly', to: '/services/old-age-pension' },
  { id: 'licence', label: "Driver's Licence", glyph: 'licence', to: '/services/driver-licence' },
  { id: 'vehicle', label: 'Vehicle Licence', glyph: 'car', to: '/services/mv-licence' },
  { id: 'payments', label: 'Pay a Bill', glyph: 'bolt', to: '/payments' },
  { id: 'appointments', label: 'Appointments', glyph: 'calendar', to: '/services/book-appointment/apply' },
  { id: 'all', label: 'More services', glyph: 'more', to: '/agencies' },
];

// 20px stroked glyphs on one grid, so the tile row reads evenly. Inline SVG rather
// than the prototype's Font Awesome CDN link: no external request (which the
// portal's CSP would block anyway) and they inherit `currentColor`.
const PATHS = {
  passport: 'M5 2.5h8v13H5zM8 6.5h2M7 9.5h4M7 12h4',
  tax: 'M5 2.5h8v13H5zM7.5 6h3M7.5 8.5h3M7.5 11h3',
  certificate: 'M4 3h10v8H4zM6.5 13.5l2.5-2 2.5 2v-3M6.5 6h5M6.5 8.5h3',
  house: 'M3 8.5L9 3.5l6 5V16H3zM7.5 16v-4h3v4',
  stamp: 'M6 3h6v4l2 2v2H4V9l2-2zM4 13h10v2H4z',
  grant: 'M9 5.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM9 7.5v3M7.8 9h2.4M2.5 15.5h13',
  elderly: 'M9 3a1.8 1.8 0 1 1 0 3.6A1.8 1.8 0 0 1 9 3zM7.5 7.5h3l1 4h-1.5L11 16H7l.5-4.5H6z',
  licence: 'M2.5 4.5h13v9h-13zM5.5 7.5h3v3h-3zM10.5 8h3M10.5 10.5h3',
  car: 'M3 11l1.2-3.4A1.5 1.5 0 0 1 5.6 6.5h6.8a1.5 1.5 0 0 1 1.4 1.1L15 11v3H3zM5.5 14v1M12.5 14v1M3 11h12',
  bolt: 'M10 2L5 10h3.5L8 16l5-8H9.5L10 2z',
  calendar: 'M3 5h12v10H3zM3 8h12M6.5 3v2.5M11.5 3v2.5',
  more: 'M4.5 9h.01M9 9h.01M13.5 9h.01',
};

/** Decorative tile glyph — the label carries the meaning. */
export function ServiceGlyph({ name, size = 20 }) {
  const d = PATHS[name] || PATHS.more;
  const dots = name === 'more';
  return (
    <svg aria-hidden viewBox="0 0 18 18" width={size} height={size}
      fill="none" stroke="currentColor"
      strokeWidth={dots ? 2.6 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
