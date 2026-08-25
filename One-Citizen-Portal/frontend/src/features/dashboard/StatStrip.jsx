import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// "At a glance" strip — the SECONDARY summary row, below the KPI strip.
//
// Every number here is an owner-scoped repository read:
//   appointments  → repos.appointments.find + ctxFor(auth)
//   family        → owner-scoped records collection
//
// HISTORY, because it explains the shape. This block used to carry a warning that
// the dashboard's `deadlines`, `notifications`, `suggestions` and `pension` feeds
// were hardcoded literals — the same values for every citizen — and that no
// money-due or unread-count tile could therefore be offered here, because
// "promoting a constant into a headline metric is the one place a placeholder does
// real damage". Those four feeds are now genuine database reads (see
// dashboard.service.js), so that constraint is lifted.
//
// The APPLICATIONS tile also moved out of this strip and into KpiStrip.jsx, which
// leads with Submitted and Drafts from GET /dashboard/kpis. Keeping a third
// applications count here would have said the same thing twice.
// ─────────────────────────────────────────────────────────────────────────────

function Glyph({ name }) {
  const paths = {
    doc: 'M6 2h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V7h3.5L13 3.5z',
    calendar: 'M7 2v2M17 2v2M3.5 8h17M5 4h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V5.5A1.5 1.5 0 0 1 5 4z',
    family: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20v-1.5C2 15.5 5 14 9 14s7 1.5 7 4.5V20zm16 0v-1.5c0-1.9-.8-3.2-2.1-4 3.4.2 6.1 1.6 6.1 4V20z',
  };
  const d = paths[name] || paths.doc;
  const stroked = name === 'calendar';
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden
      fill={stroked ? 'none' : 'currentColor'}
      stroke={stroked ? 'currentColor' : 'none'}
      strokeWidth={stroked ? 1.7 : undefined}
      strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}

/**
 * @param {object[]} stats  { key, glyph, count, label, hint, to, loading, tone }
 */
export default function StatStrip({ stats }) {
  const navigate = useNavigate();

  // Columns follow the actual number of stats rather than a fixed 3, so removing the
  // applications tile does not leave a hole in the row at `lg`.
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-2 lg:grid-cols-3' }[stats.length]
    || 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${cols} gap-3 xl:gap-3.5 mb-[18px] xl:mb-5`}>
      {stats.map((s) => {
        const attention = s.tone === 'attention' && s.count > 0;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => navigate(s.to)}
            className={`group text-left bg-card border rounded-card px-4 py-3.5 xl:px-5
                        flex items-center gap-3.5 transition-all duration-base
                        hover:border-primary hover:-translate-y-px
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-primary focus-visible:ring-offset-2
                        ${attention ? 'border-warn/45' : 'border-line'}`}
          >
            <span aria-hidden
              className={`w-10 h-10 rounded-tile grid place-items-center shrink-0
                          transition-colors duration-base
                          ${attention
                            ? 'bg-warn-tint text-warn-text'
                            : 'bg-tint text-primary group-hover:bg-tint2'}`}>
              <Glyph name={s.glyph} />
            </span>

            <span className="min-w-0 flex-1">
              {s.loading ? (
                <span className="block h-7 w-10 rounded bg-tint relative overflow-hidden oc-shimmer" />
              ) : (
                // tabular-nums so the figures hold a column as they change.
                <span className="block text-[27px] leading-none font-bold text-ink tabular-nums">
                  {s.count}
                </span>
              )}
              <span className="block text-sm text-ink font-semibold mt-1.5 truncate">{s.label}</span>
              {/* The hint is what makes the number mean something — a bare "2" is
                  a fact, "2 — next on Fri, Aug 8" is useful. */}
              {s.hint && !s.loading && (
                <span className="block text-micro text-muted mt-0.5 truncate">{s.hint}</span>
              )}
            </span>

            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden
              className="shrink-0 text-muted transition-transform duration-base
                         group-hover:translate-x-0.5 group-hover:text-primary"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
