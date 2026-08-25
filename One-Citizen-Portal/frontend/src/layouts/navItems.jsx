// ─────────────────────────────────────────────────────────────────────────────
// Sidebar navigation — the SINGLE list of destinations in the portal.
//
// Per the strict rule: the top bar gains NO nav items (it keeps search, AskGov,
// notifications, theme and the avatar menu exactly as it is), and every
// destination lives here. This merges the app's existing four items with the
// prototype's twelve, in the prototype's order and grouping.
//
// The prototype's own 6-item top nav row is deliberately NOT replicated — that
// would duplicate these entries in the bar we were told to leave alone.
//
// `icon` is a Font Awesome-style glyph name in the prototype; here each entry
// carries a small inline SVG path so the portal needs no icon font.
// ─────────────────────────────────────────────────────────────────────────────

/** Groups are rendered with a hairline separator between them. */
export const NAV_GROUPS = [
  {
    id: 'primary',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'home' },
      { label: 'Agencies', to: '/agencies', icon: 'grid', match: ['/services'] },
      // Tint Waiver adds NO nav entry: its applications are ordinary portal
      // applications, so they already appear under Applications / the dashboard KPIs
      // alongside every other service. A separate entry would split one list in two.
      { label: 'Applications', to: '/tracking', icon: 'clipboard' },
      { label: 'Documents', to: '/documents', icon: 'file' },
      { label: 'Permits', to: '/permits', icon: 'stamp' },
      { label: 'Payments', to: '/payments', icon: 'card' },
      { label: 'Digital Wallet', to: '/wallet', icon: 'wallet' },
      { label: 'Messages', to: '/messages', icon: 'mail', badgeKey: 'messages' },
    ],
  },
  {
    id: 'records',
    items: [
      { label: 'Profile', to: '/profile', icon: 'user' },
      { label: 'Family', to: '/family', icon: 'users' },
      { label: 'Vehicles', to: '/vehicles', icon: 'car' },
      { label: 'Properties', to: '/properties', icon: 'house' },
      { label: 'Employment', to: '/employment', icon: 'briefcase' },
    ],
  },
  {
    id: 'help',
    items: [
      { label: 'Check eligibility', to: '/eligibility', icon: 'check' },
      { label: 'Appointments', to: '/services/book-appointment/apply', icon: 'calendar' },
      { label: 'Settings', to: '/settings', icon: 'gear' },
      { label: 'Support', to: '/help/faqs', icon: 'help', match: ['/help'] },
    ],
  },
];

/** Flat list, for route-matching and tests. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Is this nav item the current page? An item owns its own path, any path beneath
 * it, and any extra prefixes it declares (Services owns /services/* too).
 *
 * `/services/book-appointment/apply` is excluded from the Services match because
 * Appointments is its own nav entry — otherwise both would highlight at once.
 */
export function isNavActive(item, pathname) {
  if (item.to === '/services/book-appointment/apply') return pathname.startsWith(item.to);
  const owns = (base) =>
    pathname === base ||
    (pathname.startsWith(`${base}/`) && !pathname.startsWith('/services/book-appointment'));
  return owns(item.to) || (item.match || []).some(owns);
}

// ── Icons ────────────────────────────────────────────────────────────────────
// 16px stroked glyphs, drawn to one grid so the sidebar reads evenly. Inline SVG
// rather than an icon font: no extra network request, and they inherit colour.
const P = {
  home: 'M3 9.5L9 4l6 5.5V15a1 1 0 0 1-1 1h-3v-4H7v4H4a1 1 0 0 1-1-1z',
  grid: 'M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z',
  clipboard: 'M6 3h6v2H6zM4.5 5h9v11h-9zM7 9h4M7 12h4',
  file: 'M5 2.5h5l3 3V15.5H5zM10 2.5v3h3',
  stamp: 'M6 3h6v4l2 2v2H4V9l2-2zM4 13h10v2H4z',
  card: 'M2.5 5h13v8h-13zM2.5 8h13',
  wallet: 'M3 5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3zM12 9h2',
  mail: 'M2.5 5h13v8h-13zM2.5 5.5l6.5 5 6.5-5',
  user: 'M9 4a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 0 1 9 4zM3.5 16c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6',
  users: 'M7 4.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM2.5 15.5c0-2.5 2-3.9 4.5-3.9s4.5 1.4 4.5 3.9M12.5 6.2a2 2 0 1 1 0 4M13 11.8c1.7.3 2.9 1.5 2.9 3.4',
  car: 'M3 11l1.2-3.4A1.5 1.5 0 0 1 5.6 6.5h6.8a1.5 1.5 0 0 1 1.4 1.1L15 11v3H3zM5.5 14v1M12.5 14v1M3 11h12',
  house: 'M3 8.5L9 3.5l6 5V16H3zM7.5 16v-4h3v4',
  briefcase: 'M2.5 6.5h13v8h-13zM6.5 6.5V4.5h5v2M2.5 10h13',
  check: 'M4 9.5l3.2 3.2L14 6',
  calendar: 'M3 5h12v10H3zM3 8h12M6.5 3v2.5M11.5 3v2.5',
  gear: 'M9 6.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zM9 2.5v1.6M9 13.9v1.6M2.5 9h1.6M13.9 9h1.6M4.4 4.4l1.1 1.1M12.5 12.5l1.1 1.1M13.6 4.4l-1.1 1.1M5.5 12.5l-1.1 1.1',
  help: 'M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM7.3 7.2A1.8 1.8 0 0 1 9 6c1 0 1.8.7 1.8 1.6 0 1.5-1.8 1.4-1.8 3M9 12.6v.1',
};

/** Renders a nav glyph. Decorative — the label carries the meaning. */
export function NavIcon({ name, className = 'oc-side-icon' }) {
  const d = P[name] || P.grid;
  const filled = ['grid'].includes(name);
  return (
    <svg aria-hidden viewBox="0 0 18 18" className={className} width="18" height="18">
      <path
        d={d}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
