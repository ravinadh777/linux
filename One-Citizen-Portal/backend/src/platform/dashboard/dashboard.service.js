// ─────────────────────────────────────────────────────────────────────────────
// Citizen dashboard (FR-P11): KPIs, reminders/obligations, explainable
// suggestions, active cases.
//
// ── EVERY FIGURE ON THIS SCREEN IS NOW A REAL, OWNER-SCOPED READ ──────────────
// Four of the six feeds here used to be hardcoded literals, identical for every
// citizen in the country:
//
//   deadlines()     → a fixed Property Tax $1,000 / Driver License $50 /
//                     Electricity $60 list, plus an "Urgent: $1,250.00 due in
//                     3 days" banner. A brand-new account with no vehicle, no
//                     property and no applications was told it owed $1,250.
//   notifications() → two invented alerts, one claiming a pension application
//                     had been APPROVED.
//   suggestions()   → an old-age-pension nudge shown to everyone regardless of age.
//   pension()       → a fixed $800/month, 32 years of service, status Active.
//
// On a government portal that is worse than an empty state: a citizen cannot tell
// an invented obligation from a real one, and "your application was approved" is
// a statement they will act on. All four are now derived from the database, and an
// account with no data correctly returns an empty list.
//
// The remaining honest gap is stated rather than papered over: the portal has no
// billing/assessment tables, so `deadlines` reports RENEWAL obligations it can
// actually see (vehicle licence, insurance and fitness expiry from the citizen's
// own vehicle records) and does NOT invent monetary amounts. Where no fee schedule
// exists, `amount` is null and the UI shows the obligation without a figure.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;

/** Whole days from today until an ISO/`YYYY-MM-DD` date; null when unparseable. */
function daysUntil(dateish) {
  if (!dateish) return null;
  const t = new Date(String(dateish).length <= 10 ? `${dateish}T00:00:00` : dateish).getTime();
  if (Number.isNaN(t)) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return Math.round((t - startOfToday.getTime()) / DAY_MS);
}

const fmtDate = (dateish) => {
  if (!dateish) return null;
  const d = new Date(String(dateish).length <= 10 ? `${dateish}T00:00:00` : dateish);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Relative age of a timestamp, for the notification feed. */
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

// Statuses that mean "the citizen is waiting on government".
const OPEN_STATUSES = new Set(['submitted', 'in_progress', 'in_review', 'under_review', 'pending', 'awaiting_confirmation', 'docs']);
const CLOSED_STATUSES = new Set(['issued', 'completed', 'rejected']);
const APPROVED_STATUSES = new Set(['approved', 'issued', 'completed']);

export function createDashboardService({
  applicationsService, draftsService, notificationsService, recordsService, identityService,
}) {
  /** Vehicle records, or [] when the records service is unavailable/errors. */
  async function vehiclesOf(auth) {
    if (!recordsService) return [];
    try {
      const res = await recordsService.list({ auth, collection: 'vehicles' });
      return res?.items || [];
    } catch {
      return [];
    }
  }

  return {
    // ── KPI strip ──────────────────────────────────────────────────────────────
    /**
     * Headline counts for the dashboard. Every number is a COUNT OF ROWS the
     * citizen owns — nothing derived from a constant, so a zero is a truthful zero
     * and the UI can show a real empty state.
     */
    async kpis({ auth }) {
      const [cases, draftCount] = await Promise.all([
        applicationsService.listMine({ auth }),
        draftsService ? draftsService.countMine({ auth }) : Promise.resolve(0),
      ]);

      const byStatus = (pred) => cases.filter((c) => pred(String(c.status || ''))).length;

      return {
        // "Submitted" is every application the citizen has actually filed — it does
        // not decrease as those applications progress, because the question the card
        // answers is "how many have I put in?", not "how many are still open".
        submitted: cases.length,
        drafts: draftCount,
        inProgress: byStatus((s) => OPEN_STATUSES.has(s)),
        approved: byStatus((s) => APPROVED_STATUSES.has(s)),
        rejected: byStatus((s) => s === 'rejected'),
        // Lets the UI say "last submitted 3 days ago" instead of just a number.
        lastSubmittedAt: cases[0]?.submittedAt || cases[0]?.createdAt || null,
      };
    },

    async reminders({ auth }) {
      const cases = await applicationsService.listMine({ auth });
      const active = cases.filter((c) => !CLOSED_STATUSES.has(String(c.status)));

      // Applications the citizen is waiting on.
      const items = active.map((c) => ({
        id: `case-${c.id}`,
        title: `${c.serviceName} — ${c.status}`,
        detail: `Reference ${c.reference}`,
        deepLink: `/tracking/${c.id}`,
      }));

      // Unfinished drafts are a reminder in their own right, and the most actionable
      // one on the page: the citizen has already done the work, it just is not filed.
      if (draftsService) {
        const drafts = await draftsService.listMine({ auth });
        for (const d of drafts) {
          items.push({
            id: `draft-${d.serviceId}`,
            title: `${d.serviceName || d.serviceId} — not yet submitted`,
            detail: `Saved ${fmtDate(d.lastSavedAt) || 'recently'} · continue where you left off`,
            deepLink: `/services/${d.serviceId}/apply`,
          });
        }
      }

      // The hardcoded "Motor vehicle licence renewal due — Expires 30 Sep 2026"
      // entry is gone. Renewal reminders now come from the citizen's OWN vehicle
      // rows, so a citizen with no vehicle is not told to renew one.
      for (const v of await vehiclesOf(auth)) {
        const d = daysUntil(v.licenceExpiry);
        if (d !== null && d <= 90) {
          items.push({
            id: `veh-licence-${v.id}`,
            title: `Motor vehicle licence renewal due — ${v.registration || 'your vehicle'}`,
            detail: d < 0 ? `Expired ${fmtDate(v.licenceExpiry)}` : `Expires ${fmtDate(v.licenceExpiry)}`,
            payNowDeepLink: '/services/mv-licence',
          });
        }
      }

      return { items };
    },

    /**
     * Explainable, dismissible programme suggestions (FR-P11.3) — never auto-enrol.
     *
     * Previously a single literal that recommended the old-age pension to every
     * citizen, including a 20-year-old, with the explanation "residents aged 65+ are
     * universally eligible" printed underneath. Now each suggestion is gated on the
     * citizen's REAL stored profile, and the explanation states the actual reason it
     * was matched — which is what makes it explainable rather than decorative.
     */
    async suggestions({ auth }) {
      const items = [];
      let profile = {};
      if (identityService) {
        try {
          profile = (await identityService.getUser({ auth }))?.profile || {};
        } catch {
          profile = {};
        }
      }

      const age = (() => {
        const d = profile.dob ? new Date(`${String(profile.dob).slice(0, 10)}T00:00:00`) : null;
        if (!d || Number.isNaN(d.getTime())) return null;
        return Math.floor((Date.now() - d.getTime()) / (DAY_MS * 365.25));
      })();

      // Suppress anything the citizen has already applied for — suggesting a service
      // whose application is already in the queue is noise, not help.
      const cases = await applicationsService.listMine({ auth });
      const appliedFor = new Set(cases.map((c) => c.serviceId));

      if (age !== null && age >= 65 && !appliedFor.has('old-age-pension')) {
        items.push({
          id: 'sugg-pension',
          programme: 'Old-Age Pension',
          explanation: `Your date of birth on file makes you ${age}. Guyanese residents aged 65 and over are universally eligible for the old-age pension.`,
          deepLink: '/services/old-age-pension',
          dismissible: true,
        });
      }

      if (!profile.tin && !appliedFor.has('tin-register')) {
        items.push({
          id: 'sugg-tin',
          programme: 'Taxpayer Identification Number',
          explanation: 'Your profile has no TIN recorded. A TIN is required for most employment, banking and property services.',
          deepLink: '/services/tin-register',
          dismissible: true,
        });
      }

      return { items };
    },

    async cases({ auth }) {
      const cases = await applicationsService.listMine({ auth });
      const nextStepFor = (c) => {
        if (APPROVED_STATUSES.has(String(c.status))) return 'Ready for pickup';
        const lane = (c.lanes || []).find((l) => l.status === 'in_progress') || (c.lanes || []).find((l) => l.status === 'pending');
        return lane ? `${lane.name} in progress` : 'Awaiting review';
      };
      return {
        items: cases.map((c) => ({
          id: c.id,
          reference: c.reference,
          appNumber: c.reference,
          service: c.serviceName,
          category: c.agencyName || c.ministryName,
          ministry: c.ministryName,
          status: c.status,
          submittedAt: c.createdAt || c.timeline?.[0]?.at || null,
          nextStep: nextStepFor(c),
          updatedAt: c.updatedAt,
        })),
      };
    },

    /**
     * Upcoming obligations with days remaining (FR-P11.1), derived from the
     * citizen's own vehicle records.
     *
     * `amount` is deliberately NULL rather than invented. The portal has no fee
     * schedule or assessment table, and the previous version's confident
     * "$1,250.00 due in 3 days" was fabricated. An obligation with a real date and
     * no figure is useful; an obligation with a made-up figure is misinformation.
     * When a fee service exists, populate `amount` here and the UI renders it.
     */
    async deadlines({ auth }) {
      const items = [];
      for (const v of await vehiclesOf(auth)) {
        const plate = v.registration || 'Vehicle';
        for (const [field, title, icon, link] of [
          ['licenceExpiry', `Motor vehicle licence — ${plate}`, 'calendar', '/services/mv-licence'],
          ['insuranceExpiry', `Insurance renewal — ${plate}`, 'calendar', '/vehicles'],
          ['fitnessExpiry', `Fitness certificate — ${plate}`, 'calendar', '/vehicles'],
        ]) {
          const d = daysUntil(v[field]);
          if (d === null || d > 120) continue;
          items.push({
            id: `dl-${field}-${v.id}`,
            title,
            icon,
            dueDate: fmtDate(v[field]),
            daysLeft: d,
            amount: null, // no fee schedule in the platform — see the note above
            payDeepLink: link,
          });
        }
      }
      items.sort((a, b) => a.daysLeft - b.daysLeft);

      // The urgent banner is raised only by a real, imminent obligation. No records
      // → no banner, rather than a standing alarm every citizen learns to ignore.
      const soonest = items[0];
      const urgent = soonest && soonest.daysLeft <= 14
        ? {
          title: soonest.daysLeft < 0 ? 'Overdue renewal' : 'Renewal due soon',
          message: soonest.daysLeft < 0
            ? `${soonest.title} expired on ${soonest.dueDate}.`
            : `${soonest.title} is due in ${soonest.daysLeft} day${soonest.daysLeft === 1 ? '' : 's'} (${soonest.dueDate}).`,
          amount: soonest.amount,
          daysLeft: soonest.daysLeft,
          payDeepLink: soonest.payDeepLink,
        }
        : null;

      return { urgent, items };
    },

    /**
     * In-portal notification feed (FR-P4) — now the PERSISTED notifications table,
     * which notifications.service.js already writes on every real application
     * workflow event. Previously two invented alerts, one of which told every
     * citizen their pension application had been approved.
     */
    async notifications({ auth }) {
      if (!notificationsService) return { items: [], unread: 0 };
      const { items = [], unread = 0 } = await notificationsService.list({ auth });
      return {
        unread,
        items: items.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message || n.body || '',
          timeAgo: timeAgo(n.createdAt),
          createdAt: n.createdAt,
          unread: !n.isRead,
          deepLink: n.applicationId ? `/tracking/${n.applicationId}` : undefined,
        })),
      };
    },

    /**
     * Old-age pension summary (module E feed), derived from the citizen's actual
     * pension application rather than the previous fixed $800 / 32-years literal.
     * `enrolled: false` when there is no approved application, so the UI shows an
     * "apply" path instead of a fictional entitlement.
     */
    async pension({ auth }) {
      const cases = await applicationsService.listMine({ auth });
      const app = cases.find((c) => c.serviceId === 'old-age-pension');
      if (!app) return { enrolled: false, status: null, application: null };

      const approved = APPROVED_STATUSES.has(String(app.status));
      return {
        enrolled: approved,
        status: app.status,
        // Monetary amounts come from a benefits/disbursement system this platform
        // does not have. Reporting null keeps the card honest; it renders the real
        // application state and links to tracking instead of inventing a figure.
        monthlyAmount: null,
        nextPayment: null,
        application: {
          id: app.id,
          reference: app.reference,
          submittedAt: app.submittedAt || app.createdAt,
          approvedAt: app.approvedAt || null,
          deepLink: `/tracking/${app.id}`,
        },
      };
    },
  };
}
