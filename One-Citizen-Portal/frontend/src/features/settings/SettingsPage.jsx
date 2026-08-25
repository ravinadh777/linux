import { useNavigate } from 'react-router-dom';
import { PageHeader, SectionCard, Button, DataRow, Chip, cx } from '../../ui/index.js';
import { useUiStore } from '../../stores/uiStore.js';
import { useAuthStore } from '../../stores/authStore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Settings — the prototype's Preferences / Accessibility / Security / Privacy view.
//
// Only controls that DO something are rendered. The prototype shows consent toggles
// and an active-sessions list; there is no API behind either, so rather than shipping
// switches that silently do nothing (the exact defect we removed from the auth pages),
// each is stated as not yet available with a real route to the help desk.
//
// What IS real and persisted: theme and text size, via uiStore → localStorage.
//
// MINISTER'S CHANGE #7 — NDMA-only IP/access monitoring. The correct implementation
// for a CITIZEN portal is that it does not appear here at all: no IP log, no access
// history, no device list. See the note at the bottom of this file.
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_SIZES = [
  { value: 1, label: 'Normal', sample: 'A' },
  { value: 1.15, label: 'Large', sample: 'A+' },
  { value: 1.3, label: 'Largest', sample: 'A++' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const mode = useUiStore((s) => s.mode);
  const toggleMode = useUiStore((s) => s.toggleMode);
  const textScale = useUiStore((s) => s.textScale);
  const setTextScale = useUiStore((s) => s.setTextScale);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="w-full">
      <PageHeader
        title="Settings"
        subtitle="How the portal looks and behaves for you. Changes save immediately on this device."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-[18px] xl:gap-5">
        {/* ── Appearance — real, persisted ─────────────────────────────────────── */}
        <SectionCard title="Appearance">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="text-base font-bold">Dark mode</p>
              <p className="text-sm text-muted dark:text-d-muted mt-0.5">
                Easier on the eyes in low light. Saved on this device.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mode === 'dark'}
              onClick={toggleMode}
              className={cx(
                'shrink-0 w-12 h-7 rounded-pill relative transition-colors duration-fast ease-standard',
                mode === 'dark' ? 'bg-primary' : 'bg-line dark:bg-d-line',
              )}
            >
              <span className="absolute w-px h-px overflow-hidden [clip:rect(0,0,0,0)]">Dark mode</span>
              <span
                aria-hidden
                className={cx(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-fast ease-standard',
                  mode === 'dark' ? 'left-6' : 'left-1',
                )}
              />
            </button>
          </div>

          <div className="h-px bg-line dark:bg-d-line my-3" />

          <div className="py-1">
            <p className="text-base font-bold">Text size</p>
            <p className="text-sm text-muted dark:text-d-muted mt-0.5 mb-3">
              Makes every screen larger, not just this one.
            </p>
            <div role="group" aria-label="Text size" className="flex gap-2">
              {TEXT_SIZES.map((t) => {
                const active = textScale === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTextScale(t.value)}
                    className={cx(
                      'flex-1 min-h-tap rounded-btn border font-bold transition-colors duration-fast ease-standard',
                      active
                        ? 'bg-tint border-primary text-primary dark:bg-d-tint dark:border-d-primary dark:text-d-primary'
                        : 'border-line dark:border-d-line text-muted dark:text-d-muted hover:border-primary',
                    )}
                  >
                    <span aria-hidden className="block text-lg">{t.sample}</span>
                    <span className="block text-micro">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* ── Account ──────────────────────────────────────────────────────────── */}
        <SectionCard title="Account" actionLabel="Edit details" onAction={() => navigate('/profile')}>
          <dl className="m-0">
            <DataRow label="Name" value={user?.name} />
            <DataRow label="Email" value={user?.email} />
            <DataRow label="Role" value={<span className="capitalize">{user?.role || 'citizen'}</span>} />
          </dl>
          <div className="h-px bg-line dark:bg-d-line my-3" />
          <p className="text-sm text-muted dark:text-d-muted">
            Your email is how you sign in and cannot be changed here.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/help/contact')}>
              Change my email
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/help/contact')}>
              Reset my password
            </Button>
          </div>
        </SectionCard>

        {/* ── Security & privacy — honest about what is not built ──────────────── */}
        <SectionCard title="Security and privacy">
          <div className="rounded-tile bg-tint dark:bg-d-tint p-3.5">
            <div className="flex items-start gap-2.5">
              <Chip tone="muted" dot={false}>Coming</Chip>
              <p className="text-sm flex-1">
                Two-step sign-in, a list of the devices you are signed in on, and controls for
                which agencies may see which records are not available yet. Until they are, the
                help desk can review your account activity with you.
              </p>
            </div>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => navigate('/help/contact')}>
                Contact the help desk
              </Button>
            </div>
          </div>

          <div className="h-px bg-line dark:bg-d-line my-3" />

          <p className="text-sm text-muted dark:text-d-muted">
            Every decision on your applications is made by an accountable government officer, and
            each status change is recorded on the application itself — see{' '}
            <button type="button" className="oc-link" onClick={() => navigate('/tracking')}>
              your applications
            </button>.
          </p>
        </SectionCard>

        {/* ── Data ─────────────────────────────────────────────────────────────── */}
        <SectionCard title="Your data">
          <p className="text-base">
            The portal holds the details on your profile, the applications you have submitted, the
            documents you have uploaded, and the records you have added yourself.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/profile')}>My profile</Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/documents')}>My documents</Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/tracking')}>My applications</Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MINISTER'S CHANGE #7 — NDMA-only IP / access monitoring, hidden from citizens.
//
// Implemented by ABSENCE, deliberately. This citizen app renders no IP address, no
// access log, no device or session list, and no monitoring surface of any kind —
// there is nothing here to hide from a citizen because nothing is exposed.
//
// The platform DOES record access: backend/src/platform/audit writes an append-only
// audit trail, and its routes are guarded by requireAuth plus the role checks in
// middleware/rbac.js. An NDMA monitoring view belongs in the back-office application
// behind an `ndma`/`oversight` role — not in this bundle, because anything shipped in
// the citizen bundle is reachable by a citizen who reads the JavaScript.
// ─────────────────────────────────────────────────────────────────────────────
