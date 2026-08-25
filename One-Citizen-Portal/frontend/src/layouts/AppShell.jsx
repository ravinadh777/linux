import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Drawer, Menu, MenuItem, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAuthStore } from '../stores/authStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { api, setSessionLostHandler } from '../lib/api.js';
import { useSessionKeepAlive } from '../features/auth/useSessionKeepAlive.js';
import SessionExpiryDialog from '../features/auth/SessionExpiryDialog.jsx';
import AskGovPanel from '../assistant/AskGovPanel.jsx';
import NotificationCenter from '../components/NotificationCenter.jsx';
import { AgentProvider } from '../agent/index.js';
import GlobalSearch from '../components/GlobalSearch.jsx';
import { IconButton } from '../ui/index.js';
import Sidebar from './Sidebar.jsx';
import { LAYOUT } from '../theme/tokens.js';
import { Brand } from '../components/ui.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// App shell — prototype layout: 64px sticky white top bar, 232px sticky sidebar,
// content well, optional AskGov rail. Max width 1440 centred, per the prototype's
// `.app` container.
//
// TOP BAR IS UNCHANGED in function: search, AskGov toggle, notifications, theme
// toggle, avatar menu. No navigation items were added to it — every destination
// lives in the sidebar (see navItems.jsx).
//
// The prototype hides its sidebar entirely below 980px with no replacement, which
// combined with "all nav in the sidebar" would leave a phone with no navigation at
// all. The drawer is kept instead so the same 17 items stay reachable.
// ─────────────────────────────────────────────────────────────────────────────

const TOPBAR = LAYOUT.topbar;

export default function AppShell() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const clear = useAuthStore((s) => s.clear);
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const roles = useAuthStore((s) => s.roles);
  const mode = useUiStore((s) => s.mode);
  const toggleMode = useUiStore((s) => s.toggleMode);
  const assistantOpen = useUiStore((s) => s.assistantOpen);
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [navOpen, setNavOpen] = useState(false);
  const [menuEl, setMenuEl] = useState(null);
  // Hydrate the profile once after a hard refresh when we hold a token but the
  // persisted store has no user yet. Unchanged behaviour.
  useEffect(() => {
    if (token && !user) api.get('/me').then((r) => setUser(r.data)).catch(() => { });
  }, [token, user, setUser]);

  const displayName = user?.name || user?.profile?.fullName || user?.email || 'User';
  const roleLabel = user?.role || roles?.[0] || 'citizen';
  const initials = (displayName.includes('@')
    ? displayName[0]
    : displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('')
  ).toUpperCase() || 'U';

  // ── Session continuity ───────────────────────────────────────────────────────
  // Keeps the 15-minute access token refreshed ahead of expiry so a citizen filling
  // a long form is never interrupted. `warnSecondsLeft` is non-null only after a
  // silent refresh has already failed — see useSessionKeepAlive.
  const { warnSecondsLeft, extend } = useSessionKeepAlive();

  // Let lib/api.js end a lapsed session through the ROUTER rather than by assigning
  // window.location.href. The old hard navigation reloaded the document and threw
  // away all React state; this keeps the SPA alive and lets /login read `returnTo`.
  useEffect(() => {
    setSessionLostHandler(() => {
      navigate('/login', { replace: true, state: { from: location } });
    });
    return () => setSessionLostHandler(null);
  }, [navigate, location]);

  const logout = () => { clear(); navigate('/login', { replace: true }); };
  const showPanel = assistantOpen && isDesktop;
  // Navigate and close the mobile drawer. `onNavigate` is a Sidebar prop and does not
  // exist in this scope — calling it here threw a ReferenceError the moment the logo
  // was clicked.
  const go = (to) => { navigate(to); setNavOpen(false); };

  return (
    <AgentProvider>
      {/* ── FULL-BLEED shell — ONE viewport-height frame, not a growing document ──
          This is `h-[100dvh] overflow-hidden`, NOT `min-h-[100dvh]`, and that change
          is the whole fix for the "entire layout scrolls" bug.

          BEFORE: the shell was `min-h-[100dvh]` and the DOCUMENT was the scroller.
          The two rails compensated with `position: sticky` plus a hardcoded
          `height: calc(100dvh - 64px)`. Measured across every route, the whole-layout
          overflow came out as exactly `max(0, mainHeight - (100dvh - 64px))`:

              /tracking          main  465  → 0px
              /profile           main  948  → 0px
              /marriage-cert/apply    1004  → 37px
              /dashboard              1448  → 481px

          So the moment content exceeded the viewport the ENTIRE layout scrolled —
          page header, AskGov banner, and the rails' bottom edges with it. The final
          step of an application form is the worst case in the app, because the Review
          summary renders every section × every field (passport-new: 6 sections, ~40
          rows), so `mainHeight` explodes and the whole frame drags.

          AFTER: the shell is exactly one viewport tall and clips. The single vertical
          scroller is `<main>` (below). The top bar, sidebar and assistant rail are
          ordinary flex children of a fixed-height column, so they are pinned by
          LAYOUT rather than by sticky offsets — which is why all the
          `calc(100dvh - TOPBAR)` arithmetic and every `position: sticky` on the rails
          is now gone. Nothing can drag them out of view.

          NOTE this deliberately does not touch document-level overflow. The AUTH
          pages (AuthLayout → login/register) are outside this shell and still rely on
          the document scrolling for the long registration form; clamping <body> would
          break them. On app routes the shell is exactly 100dvh, so the document has
          nothing to scroll anyway. */}
      <div className="w-full h-[100dvh] overflow-hidden flex flex-col">

        {/* ── Top bar — function unchanged (search, AskGov, notifications, theme,
             avatar menu), now frosted glass. `sticky` was dropped: as a `shrink-0`
             child of a fixed-height column it can no longer be scrolled past, so the
             offset served no purpose. `z-sticky` stays — it keeps the bar above the
             content region's own shadows and any lifted card scrolling beneath it. */}
        <header
          className="oc-glass-chrome relative z-sticky shrink-0 border-b border-glass-hairline dark:border-d-glass-hairline
                     flex items-center gap-2 sm:gap-3 pr-3 sm:pr-4 xl:pr-6"
          style={{ height: TOPBAR }}
        >
          {/* Brand doubles as the home link. Its width matches the sidebar rail exactly
              so the logo and the nav items below it share one left edge — the single
              biggest alignment cue in the whole shell. */}
          <button
            type="button"
            onClick={() => go('/dashboard')}
            aria-label="oneCitizen — go to the dashboard"
            className="shrink-0 h-full flex items-center px-4 xl:px-5 text-left
                       lg:w-[232px] 3xl:w-[268px] lg:border-r lg:border-line lg:dark:border-d-line
                       hover:bg-tint/40 dark:hover:bg-d-tint/40 transition-colors duration-fast ease-standard lg:block hidden"
          >
            <Brand />
          </button>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden shrink-0 w-tap h-tap grid place-items-center rounded-full hover:bg-tint dark:hover:bg-d-tint"
          >
            <svg aria-hidden viewBox="0 0 18 18" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />
            </svg>
          </button>

          {/* Search stays capped and centred. A full-width search field on a 2560px
              monitor is a 2000px input for a 20-character query. */}
          <div className="flex-1 min-w-0 flex justify-center">
            <div className="w-full max-w-[560px] xl:max-w-[740px]"><GlobalSearch /></div>
          </div>

          <div className="shrink-0 flex items-center gap-1">
            <IconButton
              label={assistantOpen ? 'Hide AskGov assistant' : 'Ask AskGov'}
              onClick={() => setAssistantOpen(!assistantOpen)}
              className={assistantOpen ? 'text-primary dark:text-d-primary bg-tint dark:bg-d-tint' : undefined}
            >
              <svg aria-hidden viewBox="0 0 18 18" width="19" height="19" fill="currentColor">
                <path d="M9 1.5l1.6 4.2 4.4 1.5-4.4 1.5L9 13l-1.6-4.3L3 7.2l4.4-1.5L9 1.5zM14 12l.7 1.8L16.5 14.5l-1.8.7L14 17l-.7-1.8-1.8-.7 1.8-.7L14 12z" />
              </svg>
            </IconButton>

            <NotificationCenter />

            <IconButton label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleMode}>
              {mode === 'dark' ? (
                <svg aria-hidden viewBox="0 0 18 18" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="9" cy="9" r="3.4" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M14.2 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4" />
                </svg>
              ) : (
                <svg aria-hidden viewBox="0 0 18 18" width="19" height="19" fill="currentColor">
                  <path d="M11.7 12.6A5.6 5.6 0 0 1 6.2 5.4c0-.7.1-1.3.3-1.9A6.2 6.2 0 1 0 14 12.2c-.7.3-1.5.4-2.3.4z" />
                </svg>
              )}
            </IconButton>

            <button
              type="button"
              onClick={(e) => setMenuEl(e.currentTarget)}
              aria-label="Account menu"
              aria-haspopup="menu"
              className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-tile hover:bg-tint dark:hover:bg-d-tint transition-colors duration-fast ease-standard min-h-tap"
            >
              <span aria-hidden className="w-9 h-9 rounded-full bg-gold text-primary-deep grid place-items-center text-sm font-bold shrink-0">
                {initials}
              </span>
              <span className="hidden sm:block text-left min-w-0">
                <span className="block text-sm font-bold truncate max-w-[140px]">{displayName}</span>
                <span className="block text-micro text-muted dark:text-d-muted capitalize truncate">{roleLabel}</span>
              </span>
            </button>

            <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
              <div className="px-3.5 py-3 border-b border-line dark:border-d-line min-w-[240px]">
                <p className="text-sm font-bold">{displayName}</p>
                {user?.email && <p className="text-micro text-muted dark:text-d-muted mt-0.5">{user.email}</p>}
              </div>
              <MenuItem onClick={() => { setMenuEl(null); navigate('/profile'); }}>My profile</MenuItem>
              <MenuItem onClick={() => { setMenuEl(null); navigate('/settings'); }}>Settings</MenuItem>
              <MenuItem onClick={() => { setMenuEl(null); navigate('/help/faqs'); }}>Help &amp; support</MenuItem>
              <MenuItem onClick={logout}>Sign out</MenuItem>
            </Menu>
          </div>
        </header>

        {/* ── Body: sidebar · content · assistant ───────────────────────────────
             `items-start` was REMOVED so the children stretch (the flex default). That
             is what lets the rails fill the row's height without being told a pixel
             value — previously they were `items-start` + an explicit
             `calc(100dvh - 64px)`, two independent sources for one measurement that
             could disagree. `min-h-0` is load-bearing: without it this flex child
             refuses to shrink below its content and would push the shell past 100dvh,
             reintroducing the exact bug above. */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop rail — a plain flex child now, no sticky and no height maths; it
              fills the row because the row is exactly as tall as the shell allows. It
              widens one step on very large screens so the 17 labels stop truncating and
              the whole rail stays in proportion to a full-bleed content well beside it.
              Sidebar itself owns the internal `overflow-y-auto` for its 17 items. */}
          <aside
            className="oc-glass-chrome hidden lg:block shrink-0 overflow-hidden
                       border-r border-glass-hairline dark:border-d-glass-hairline
                       w-[232px] 3xl:w-[268px]"
          >
            <Sidebar />
          </aside>

          {/* Mobile drawer — MUI retained for the focus trap and scroll lock. */}
          <Drawer
            open={navOpen}
            onClose={() => setNavOpen(false)}
            sx={{ display: { lg: 'none' }, '& .MuiDrawer-paper': { width: LAYOUT.sidebar, overflow: 'hidden' } }}
          >
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </Drawer>

          {/* Content well. Gutters step up with the viewport so the layout never looks
              like it is clinging to the screen edges on a large monitor, while a phone
              keeps its 16px. Bottom padding is deep on mobile so the floating assistant
              button never covers the last control. */}
          {/* ── THE app's single vertical scroller ──────────────────────────────
              `overflow-y-auto` here is the other half of the scroll fix. Only this
              region scrolls; the top bar, sidebar and assistant rail are outside it
              and therefore fixed by construction. A 40-row Review summary now scrolls
              INSIDE the content well instead of dragging the whole layout with it.

              `min-h-0` lets it shrink to the row height so `overflow-y-auto` has a
              definite height to scroll against — without it the element would size to
              its content and never scroll. `min-w-0` is the horizontal equivalent:
              without it this flex child refuses to shrink below its content's
              intrinsic width and a wide table pushes the whole shell sideways instead
              of scrolling inside its own container.

              `overscroll-contain` stops a wheel gesture that reaches the end of the
              content from chaining out to the document.

              Gutters step up with the viewport so the layout never looks like it is
              clinging to the screen edges on a large monitor, while a phone keeps its
              16px. Bottom padding is deep on mobile because the floating assistant
              launcher is fixed at bottom-6 and 56px tall — at a flat p-4 it sat on top
              of the last control on the page. It shrinks back at `lg`, where the
              launcher is replaced by the docked rail. */}
          <main
            id="main-content"
            tabIndex={-1}
            className="oc-scroll flex-1 min-w-0 min-h-0 w-full outline-none
                       overflow-y-auto overscroll-contain
                       p-1 sm:p-2 lg:p-3 xl:p-4 3xl:p-5 4xl:p-6
                       pb-24 lg:pb-3"
          >
            <Outlet />
          </main>

          {/* Assistant rail. Also widens one step on very large screens — a 372px chat
              column beside a 2000px content well looks like an afterthought. Same
              change as the sidebar: no sticky, no height arithmetic, it just fills the
              row. */}
          {showPanel && (
            <div
              // Narrowed per request: 372 → 332, 420 → 372 at 3xl. A chat column reads
              // better slightly tight, and it hands ~40px back to the content well.
              className="oc-glass-chrome shrink-0 overflow-hidden
                         border-l border-glass-hairline dark:border-d-glass-hairline
                         w-[332px] 3xl:w-[372px]"
            >
              <AskGovPanel onClose={() => setAssistantOpen(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Assistant drawer on smaller screens. maxWidth 100% (not 100vw — that
          includes the scrollbar and forces a horizontal bar). */}
      {!isDesktop && (
        <Drawer anchor="right" open={assistantOpen} onClose={() => setAssistantOpen(false)}>
          <div style={{ width: Math.min(LAYOUT.panel, 400) }} className="max-w-full h-full overflow-hidden">
            <AskGovPanel onClose={() => setAssistantOpen(false)} />
          </div>
        </Drawer>
      )}

      {/* Timeout warning. Only reachable once a silent refresh has failed; it exists
          to tell the citizen their form data is safe, not to hurry them. */}
      <SessionExpiryDialog
        secondsLeft={warnSecondsLeft}
        onExtend={extend}
        onSignOut={logout}
      />

      {/* Floating launcher when the panel is closed. */}
      {!assistantOpen && (
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          aria-label="Ask AskGov"
          className="fixed bottom-6 right-6 z-fab w-14 h-14 rounded-full bg-primary text-white grid place-items-center shadow-dropdown hover:bg-primary-dark transition-colors duration-fast ease-standard"
        >
          <svg aria-hidden viewBox="0 0 18 18" width="22" height="22" fill="currentColor">
            <path d="M9 1.5l1.6 4.2 4.4 1.5-4.4 1.5L9 13l-1.6-4.3L3 7.2l4.4-1.5L9 1.5z" />
          </svg>
        </button>
      )}
    </AgentProvider>
  );
}
