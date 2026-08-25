import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard KPI strip.
//
// EVERY NUMBER HERE IS A REAL OWNER-SCOPED COUNT from GET /dashboard/kpis, which
// counts rows in `applications` and `application_drafts` for the signed-in citizen.
// That is a change of kind, not just of content: the previous strip carried a note
// explaining that it deliberately showed only three feeds because the rest of the
// dashboard's numbers were hardcoded literals, and that "promoting a constant into a
// headline metric is the one place a placeholder does real damage". Those feeds are
// now real, so the strip can lead with the two figures the citizen actually asks
// about — what have I submitted, and what have I not finished.
//
// DESIGN NOTES
//  • Each card is a glass pane that lifts on hover; the whole card is the hit target,
//    not a link inside it, so it is a comfortable tap on a phone.
//  • The number counts up on first paint. It is a 500ms ease-out, respects
//    `prefers-reduced-motion`, and animates only ONCE per value — a KPI that
//    re-animates on every background refetch is a distraction, not delight.
//  • `tabular-nums` so digits hold their column and the layout does not jitter as
//    figures change width.
//  • Zero is a first-class state with its own copy, not a bare "0". "No drafts —
//    nothing half-finished" tells the citizen the system is fine; "0" makes them
//    wonder if it failed to load.
// ─────────────────────────────────────────────────────────────────────────────

/** Count from 0 to `value` once, honouring reduced-motion. */
function useCountUp(value, { duration = 500, enabled = true } = {}) {
  const [shown, setShown] = useState(enabled ? 0 : value);
  const animatedFor = useRef(null);

  useEffect(() => {
    if (!enabled || typeof value !== 'number') { setShown(value); return undefined; }
    // Animate a given value only once. Without this guard react-query's periodic
    // refetch would restart the count-up every time it returned the same number.
    if (animatedFor.current === value) { setShown(value); return undefined; }
    animatedFor.current = value;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || value === 0) {
      setShown(value);
      return undefined;
    }

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — decelerating, so it settles rather than stopping dead.
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, enabled]);

  return shown;
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
const GLYPHS = {
  submitted: <path d="M5 2.5h5l3 3V15.5H5zM10 2.5v3h3M7 9h4M7 12h4" />,
  draft: <path d="M11.5 2.5l4 4-8 8H3.5v-4zM10 4l4 4" />,
  progress: <><circle cx="9" cy="9" r="6.5" /><path d="M9 5.5V9l2.5 1.5" /></>,
  approved: <><circle cx="9" cy="9" r="6.5" /><path d="M6 9.2l2.2 2.2L12.2 7" /></>,
};

/** Tone → the icon chip's colours. Tones carry meaning, never decoration. */
const TONE = {
  brand: 'bg-tint text-primary dark:bg-d-tint dark:text-d-primary',
  attention: 'bg-warn-tint text-warn-text',
  positive: 'bg-ok-tint text-ok-text',
};

function KpiCard({ glyph, value, label, hint, to, loading, error, tone = 'brand', onClick }) {
  const shown = useCountUp(value, { enabled: !loading && !error });
  const navigate = useNavigate();
  const interactive = !!(to || onClick);
  const act = () => { if (onClick) onClick(); else if (to) navigate(to); };
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      {...(interactive ? { type: 'button', onClick: act } : {})}
      // `aria-label` gives a screen reader the whole meaning in one string; the
      // visual split across three lines is a layout decision, not a semantic one.
      {...(interactive && !loading && !error
        ? { 'aria-label': `${label}: ${value}. ${hint || ''}`.trim() }
        : {})}
      className={`oc-card group text-left !p-0 overflow-hidden
                  ${interactive ? 'oc-card-interactive' : ''}`}
    >
      <span className="flex items-center gap-3.5 px-4 py-3.5 xl:px-5 w-full">
        <span aria-hidden
          className={`w-11 h-11 rounded-tile grid place-items-center shrink-0
                      transition-transform duration-base ease-standard
                      group-hover:scale-105 ${TONE[tone] || TONE.brand}`}>
          <svg viewBox="0 0 18 18" width="19" height="19" {...S}>{GLYPHS[glyph] || GLYPHS.submitted}</svg>
        </span>

        <span className="min-w-0 flex-1">
          {loading ? (
            <>
              <span className="block h-8 w-12 rounded bg-tint dark:bg-d-tint relative overflow-hidden oc-shimmer" />
              <span className="block h-3 w-24 rounded bg-tint dark:bg-d-tint mt-2" />
            </>
          ) : error ? (
            <>
              {/* An em dash, never a 0. A zero here would be read as fact. */}
              <span className="block text-[28px] leading-none font-bold text-muted dark:text-d-muted tabular-nums">—</span>
              <span className="block text-sm font-semibold text-ink dark:text-d-ink mt-1.5 truncate">{label}</span>
              <span className="block text-micro text-danger-text font-semibold mt-0.5">Could not load</span>
            </>
          ) : (
            <>
              <span className="block text-[28px] leading-none font-bold text-ink dark:text-d-ink tabular-nums">
                {shown}
              </span>
              <span className="block text-sm font-semibold text-ink dark:text-d-ink mt-1.5 truncate">{label}</span>
              {hint && <span className="block text-micro text-muted dark:text-d-muted mt-0.5 truncate">{hint}</span>}
            </>
          )}
        </span>

        {interactive && !loading && !error && (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden
            className="shrink-0 text-muted dark:text-d-muted transition-all duration-base ease-standard
                       group-hover:translate-x-0.5 group-hover:text-primary dark:group-hover:text-d-primary"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        )}
      </span>
    </Tag>
  );
}

/**
 * @param {{kpis: object, loading: boolean, error: any}} props
 */
export default function KpiStrip({ kpis, loading, error }) {
  const k = kpis || {};
  const lastSubmitted = k.lastSubmittedAt
    ? new Date(k.lastSubmittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const cards = [
    {
      key: 'submitted',
      glyph: 'submitted',
      value: k.submitted ?? 0,
      label: 'Applications submitted',
      hint: k.submitted ? (lastSubmitted ? `Most recent ${lastSubmitted}` : 'View all') : 'Nothing submitted yet',
      to: '/tracking',
    },
    {
      key: 'drafts',
      glyph: 'draft',
      value: k.drafts ?? 0,
      label: 'Drafts saved',
      // The hint is the call to action. A draft is work already done that just is
      // not filed, so this is the most valuable thing on the strip to act on.
      hint: k.drafts ? 'Pick up where you left off' : 'Nothing half-finished',
      // Deep-links to the drafts view on the tracking page.
      to: '/tracking?filter=drafts',
      tone: k.drafts ? 'attention' : 'brand',
    },
    {
      key: 'inProgress',
      glyph: 'progress',
      value: k.inProgress ?? 0,
      label: 'Awaiting a decision',
      hint: k.inProgress ? 'With a government officer' : 'Nothing pending',
      to: '/tracking',
    },
    {
      key: 'approved',
      glyph: 'approved',
      value: k.approved ?? 0,
      label: 'Approved',
      hint: k.approved ? 'Ready to collect' : 'None yet',
      to: '/tracking',
      tone: k.approved ? 'positive' : 'brand',
    },
  ];

  return (
    <section aria-label="Your applications at a glance"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-3.5 mb-[18px] xl:mb-5">
      {/* `key` is pulled OUT of the spread rather than left in it. Spreading an object
          that contains `key` is deprecated in React 18 and warns loudly, because the
          key would be consumed as a prop rather than as a reconciliation hint. */}
      {cards.map(({ key, ...card }) => (
        <KpiCard key={key} {...card} loading={loading} error={error} />
      ))}
    </section>
  );
}
