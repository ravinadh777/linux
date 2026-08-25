// ─────────────────────────────────────────────────────────────────────────────
// Digital document facsimiles — the prototype's national ID card and driver's
// licence, rendered from the citizen's REAL profile (`/me`).
//
// These are the one place the prototype's tiny 7–10px type is reproduced
// faithfully: they depict physical cards, where small print is authentic and is
// looked at rather than read to operate the portal. Operational UI everywhere else
// sits on the 14px floor.
//
// Every value comes from the profile. A field the citizen has not provided renders
// as "—" rather than a placeholder that looks like real data — the old dashboard
// showed a literal "000-0000-000-0" as an ID, which undermines trust in everything
// else on the page.
//
// The flag band and coat-of-arms are STYLISED, not the official artwork: this is a
// digital representation inside the citizen's own portal, not a reproduction of a
// government-issued document.
// ─────────────────────────────────────────────────────────────────────────────

const FLAG_BAND =
  'linear-gradient(100deg, #CE1126 0%, #CE1126 33%, #1A1A1A 33%, #1A1A1A 38%, #FCD116 38%, #FCD116 54%, #009739 54%, #009739 100%)';

const val = (v) => (v === '' || v === undefined || v === null ? '—' : v);

/** Stylised shield, evoking the coat of arms without reproducing it. */
function Shield({ w = 15, h = 19 }) {
  return (
    <svg width={w} height={h} viewBox="0 -20 100 128" aria-hidden className="shrink-0 drop-shadow-sm">
      <path d="M20,6 L80,6 L80,50 Q80,88 50,105 Q20,88 20,50 Z" fill="#F8F5EC" stroke="#C9A44C" strokeWidth="3" />
      <rect x="41" y="2" width="18" height="5" rx="2.5" fill="#C9A44C" />
      <path d="M50,15 L57,22 L50,29 L43,22 Z" fill="#C9A44C" />
      <path d="M26,42 Q34,36 42,42 T58,42 T74,42" stroke="#2D6CB5" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The compact driver's-licence thumbnail shown on the dashboard profile card.
 * Only rendered when the citizen actually holds licence details — an empty card
 * would imply they have a licence on file when they do not.
 */
export function LicenceThumb({ user }) {
  const p = user?.profile || {};
  const hasLicence = !!(p.licenceNumber || p.licenceClass || p.licenceExpiry);
  if (!user) return null;

  if (!hasLicence) {
    return (
      <div className="flex-1 min-w-[200px] max-w-[260px] rounded-tile border border-dashed border-line dark:border-d-line p-3 text-center">
        <p className="text-micro text-muted dark:text-d-muted">
          No driver&apos;s licence on file
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-w-[200px] max-w-[260px] rounded-tile overflow-hidden border border-line dark:border-d-line shadow-licence-sm"
      title="Driver's licence"
    >
      <div className="h-[30px] flex items-center gap-1.5 px-2.5" style={{ background: FLAG_BAND }}>
        <Shield />
        <span className="text-card-xs font-extrabold text-white tracking-wide leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.3)]">
          REPUBLIC OF GUYANA — DRIVER LICENCE
        </span>
      </div>
      <div
        className="px-3 py-2.5 flex gap-2.5 items-start"
        style={{ background: 'linear-gradient(115deg,#FBEFEC 0%,#FBEFEC 45%,#E9F3EC 55%,#E9F3EC 100%)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-card-lg font-extrabold text-[#1E1E1E] leading-tight truncate">
            {val(user.name)}
          </p>
          <div className="flex gap-3.5 mt-2">
            <div>
              <p className="text-card-xs font-bold uppercase text-[#737373]">Class</p>
              <p className="text-card-md font-bold text-[#1E1E1E]">{val(p.licenceClass)}</p>
            </div>
            <div>
              <p className="text-card-xs font-bold uppercase text-[#737373]">Expiry</p>
              <p className="text-card-md font-bold text-[#1E1E1E]">{val(p.licenceExpiry)}</p>
            </div>
          </div>
          <p className="text-card-xs text-[#5a5a5a] mt-2 pt-1.5 border-t border-dashed border-line">
            {val(p.licenceNumber)}
          </p>
        </div>
        <div className="w-10 h-12 rounded-[5px] bg-[#E1EEE7] border border-line grid place-items-center text-[#93AB9F] shrink-0">
          <svg viewBox="0 0 18 18" width="20" height="20" fill="currentColor" aria-hidden>
            <path d="M9 4a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 0 1 9 4zM3.5 15.5c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** The national-identity strip beneath the profile fields. */
export function NationalIdCard({ user }) {
  const p = user?.profile || {};
  return (
    <div
      className="mt-3 rounded-card border border-line dark:border-d-line p-3.5 flex gap-3 items-center"
      style={{ background: 'linear-gradient(135deg,#E4F1EA 0%,#D8EDE3 100%)' }}
    >
      <span aria-hidden className="w-[46px] h-[46px] rounded-btn bg-primary-deep text-gold grid place-items-center shrink-0">
        <svg viewBox="0 0 18 18" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2.5 4.5h13v9h-13zM5.5 7.5h3v3h-3zM10.5 8h3M10.5 10.5h3" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-card-sm font-bold text-gold-text tracking-wide">GUYANA NATIONAL IDENTITY</p>
        <p className="text-sm font-bold text-ink truncate mt-0.5">{val(user?.name)}</p>
        <p className="text-micro text-muted">{val(p.nationalId)}</p>
      </div>
    </div>
  );
}

/**
 * Full-size digital document card, used on the Documents screen. `doc` is a real
 * reference-data document type plus whatever the citizen holds.
 */
export function DigitalDocumentCard({ title, issuer, number, expiry, status, accent = 'primary' }) {
  const tone = accent === 'gold' ? 'bg-gold text-primary-deep' : 'bg-primary-deep text-gold';
  return (
    <div className="rounded-card overflow-hidden border border-line dark:border-d-line shadow-licence-sm bg-card dark:bg-d-card">
      <div className="h-[26px]" style={{ background: FLAG_BAND }} />
      <div className="p-3.5 flex gap-3 items-start">
        <span aria-hidden className={`w-11 h-11 rounded-btn grid place-items-center shrink-0 ${tone}`}>
          <svg viewBox="0 0 18 18" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 4.5h13v9h-13zM5.5 7.5h3v3h-3zM10.5 8h3M10.5 10.5h3" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">{title}</p>
          {issuer && <p className="text-micro text-muted dark:text-d-muted mt-0.5 truncate">{issuer}</p>}
          <div className="flex gap-4 mt-2">
            <div className="min-w-0">
              <p className="text-card-sm font-bold uppercase text-muted dark:text-d-muted">Number</p>
              <p className="text-micro font-bold truncate">{val(number)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-card-sm font-bold uppercase text-muted dark:text-d-muted">Valid to</p>
              <p className="text-micro font-bold truncate">{val(expiry)}</p>
            </div>
          </div>
        </div>
        {status}
      </div>
    </div>
  );
}
