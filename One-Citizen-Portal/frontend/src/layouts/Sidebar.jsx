import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/authStore.js';
import { NAV_GROUPS, isNavActive, NavIcon } from './navItems.jsx';
import { Brand } from '../components/ui.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// The sidebar — the ONLY place navigation lives.
//
// Per the strict rule, the top bar gains no nav items; every destination is here.
// Styling follows the prototype exactly: 232px, white, 1px right border, 8px
// radius items at 13.5px/600 with a `--tint` active state, red count badges and
// hairline group separators.
//
// The prototype's own 6-item top nav row is deliberately not replicated — it would
// duplicate these entries into the bar we were told to leave alone.
// ─────────────────────────────────────────────────────────────────────────────

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);

  // Counts for the badges. One request for all seven collections; failures are
  // non-fatal because a missing badge must never break navigation.
  const { data: summary } = useQuery({
    queryKey: ['records-summary'],
    queryFn: () => api.get('/records/summary').then((r) => r.data),
    enabled: !!token,
    staleTime: 60_000,
    retry: false,
  });

  const badgeFor = (key) => {
    if (key === 'messages') return summary?.messages?.unread || 0;
    return 0;
  };

  const go = (to) => { navigate(to); onNavigate?.(); };

  const displayName = user?.name || user?.email || 'User';
  const roleLabel = user?.role || roles?.[0] || 'citizen';
  const initials = (displayName.includes('@')
    ? displayName[0]
    : displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('')
  ).toUpperCase() || 'U';

  return (
    // `w-full`, not a fixed width: the CONTAINER owns the rail width (the desktop
    // aside widens to 268px at 3xl, the mobile Drawer sets its own). Hardcoding
    // 232px here left a 36px dead strip inside the wider rail on large screens.
    <div className="w-full h-full flex flex-col bg-card dark:bg-d-card">
      {/* No brand block here: it lives in the top bar, sized to this rail's width so the
          two share a left edge. Rendering it in both places duplicated the logo. On
          mobile the drawer has no top bar above it, so it gets one of its own. */}
      <div className="lg:hidden shrink-0 px-4 py-4 border-b border-line dark:border-d-line">
        <Brand />
      </div>

      {/* `overflow-y-auto` already means "a bar only if the 17 items actually overflow",
          so no redundant bar on a tall viewport. `overscroll-contain` stops scroll
          CHAINING: without it, reaching the end of the rail silently hands the wheel to
          the page behind, which is what makes two independent scrollers feel like one
          broken one. */}
      <nav aria-label="Main" className="oc-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.id}>
            {gi > 0 && <div className="oc-side-sep" role="separator" />}
            <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isNavActive(item, location.pathname);
                const badge = badgeFor(item.badgeKey);
                return (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => go(item.to)}
                      aria-current={active ? 'page' : undefined}
                      className="oc-side-item"
                    >
                      <NavIcon name={item.icon} />
                      <span className="truncate">{item.label}</span>
                      {badge > 0 && (
                        <span className="oc-side-badge">
                          {badge > 99 ? '99+' : badge}
                          <span className="absolute w-px h-px overflow-hidden [clip:rect(0,0,0,0)]"> unread</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* The prototype's mobile-app promo. Rendered only when real store links are
            configured — two buttons that do nothing is exactly the class of thing we
            removed from the auth pages. */}
        {(import.meta.env.VITE_APP_STORE_URL || import.meta.env.VITE_PLAY_STORE_URL) && (
          <div className="mt-4 rounded-card bg-primary-deep text-white p-4">
            <h4 className="text-base font-bold">Guyana Gov App</h4>
            <p className="text-sm text-[#BFE3D2] mt-1.5 mb-3">
              Access every government service from your phone.
            </p>
            {import.meta.env.VITE_APP_STORE_URL && (
              <a href={import.meta.env.VITE_APP_STORE_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 w-full bg-black/90 border border-white/15 rounded-pay px-3 py-2 mb-2 hover:bg-black">
                <span className="text-micro uppercase tracking-wide text-white/70">Download on the</span>
                <span className="text-sm font-bold">App Store</span>
              </a>
            )}
            {import.meta.env.VITE_PLAY_STORE_URL && (
              <a href={import.meta.env.VITE_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 w-full bg-black/90 border border-white/15 rounded-pay px-3 py-2 hover:bg-black">
                <span className="text-micro uppercase tracking-wide text-white/70">Get it on</span>
                <span className="text-sm font-bold">Google Play</span>
              </a>
            )}
          </div>
        )}
      </nav>

      <div className="h-px bg-line dark:bg-d-line" />

      <div className="p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-tile bg-tint dark:bg-d-tint">
          <span aria-hidden className="w-9 h-9 rounded-full bg-primary text-white grid place-items-center text-sm font-bold shrink-0">
            {initials}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{displayName}</p>
            <p className="text-micro text-muted dark:text-d-muted capitalize truncate">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => { clear(); navigate('/login', { replace: true }); }}
            aria-label="Sign out"
            title="Sign out"
            className="shrink-0 w-9 h-9 grid place-items-center rounded-btn text-muted hover:bg-card hover:text-danger-text dark:hover:bg-d-card transition-colors duration-fast ease-standard"
          >
            <svg aria-hidden viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 15.5H4A1.5 1.5 0 0 1 2.5 14V4A1.5 1.5 0 0 1 4 2.5h3M11.5 12.5L15 9l-3.5-3.5M15 9H6.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
