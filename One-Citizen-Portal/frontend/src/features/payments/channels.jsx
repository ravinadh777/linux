// ─────────────────────────────────────────────────────────────────────────────
// Payment channels for Minister's change #5: GPL, GWI, MMG and Transportation
// (ferry) ticketing, unified in one section.
//
// `to` routes to the agency in the live catalogue where one exists, so no tile is
// a dead link. `issuesQr` marks a channel that produces a scannable ticket rather
// than a bill payment — currently the ferry.
//
// These are payment CHANNELS (which provider), not citizen data — the equivalent of
// a fee schedule. Amounts and dues come from the real APIs; nothing here invents a
// balance.
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_CHANNELS = [
  {
    id: 'gpl',
    label: 'GPL Electricity',
    agency: 'Guyana Power & Light',
    glyph: 'bolt',
    to: '/agencies',
  },
  {
    id: 'gwi',
    label: 'GWI Water',
    agency: 'Guyana Water Inc.',
    glyph: 'drop',
    to: '/agencies',
  },
  {
    id: 'mmg',
    label: 'MMG Mobile Money',
    agency: 'Mobile Money Guyana',
    glyph: 'phone',
    to: '/wallet',
  },
  {
    id: 'ferry',
    label: 'Ferry Ticket',
    agency: 'Transport & Harbours',
    glyph: 'ferry',
    issuesQr: true,
  },
  {
    id: 'rates',
    label: 'Property Rates',
    agency: 'Local authority',
    glyph: 'house',
    to: '/properties',
  },
  {
    id: 'licence',
    label: 'Vehicle Licence',
    agency: 'Guyana Revenue Authority',
    glyph: 'car',
    to: '/services/mv-licence',
  },
];

const PATHS = {
  bolt: 'M10 2L5 10h3.5L8 16l5-8H9.5L10 2z',
  drop: 'M9 2.5c2.5 3 4.5 5.2 4.5 7.6A4.5 4.5 0 0 1 4.5 10.1C4.5 7.7 6.5 5.5 9 2.5z',
  phone: 'M6 2.5h6v13H6zM8 13.5h2',
  ferry: 'M3 11.5h12l-1.5 4H4.5zM9 3v4M5.5 7h7v4.5h-7zM9 7V3',
  house: 'M3 8.5L9 3.5l6 5V16H3zM7.5 16v-4h3v4',
  car: 'M3 11l1.2-3.4A1.5 1.5 0 0 1 5.6 6.5h6.8a1.5 1.5 0 0 1 1.4 1.1L15 11v3H3zM5.5 14v1M12.5 14v1M3 11h12',
};

export function ChannelGlyph({ name, size = 20 }) {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] || PATHS.bolt} />
    </svg>
  );
}
