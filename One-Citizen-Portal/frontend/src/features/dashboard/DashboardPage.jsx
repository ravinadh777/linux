import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  SectionCard, WelcomeBanner, ServiceTile, StatusChip, ListRow, DataRow,
  Button, LinkButton, EmptyState, ErrorState, ListSkeleton, Chip,
} from '../../ui/index.js';
import { useUiStore } from '../../stores/uiStore.js';
import { QUICK_SERVICES, ServiceGlyph } from './quickServices.jsx';
import { NationalIdCard, LicenceThumb } from './IdCards.jsx';
import StatStrip from './StatStrip.jsx';
import KpiStrip from './KpiStrip.jsx';
import { useTintApplications } from '../tint/tintSync.jsx';

const get = (url) => api.get(url).then((r) => r.data);
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Help links — the prototype's "Support" tiles, kept as a dashboard card.
const RESOURCES = [
  { title: 'How benefits work', sub: 'Eligibility and what to expect', to: '/help/how-benefits-work' },
  { title: 'Questions and answers', sub: 'The things people ask most', to: '/help/faqs' },
  { title: 'Contact support', sub: 'Talk to a government officer', to: '/help/contact' },
  { title: 'Service centres', sub: 'Walk in for in-person help', to: '/help/centers' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);

  // Every query and key is unchanged from before the redesign.
  const me = useQuery({ queryKey: ['me'], queryFn: () => get('/me') });
  const deadlines = useQuery({ queryKey: ['deadlines'], queryFn: () => get('/dashboard/deadlines') });
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => get('/dashboard/notifications') });
  const cases = useQuery({ queryKey: ['cases'], queryFn: () => get('/dashboard/cases') });
  const appointments = useQuery({ queryKey: ['appointments'], queryFn: () => get('/appointments') });
  const family = useQuery({ queryKey: ['family'], queryFn: () => get('/family'), retry: false });
  // Real counts from the DB (applications + application_drafts), owner-scoped.
  const kpis = useQuery({ queryKey: ['kpis'], queryFn: () => get('/dashboard/kpis') });
  // Tint waivers are stored by MOHA, not in the portal's own tables, so GET /dashboard/kpis
  // cannot see them. Without this the headline "Applications submitted" would under-report
  // every waiver the citizen has filed — a wrong number in the one place a placeholder does
  // real damage. `unavailable` is kept distinct from "zero": if MOHA cannot be reached we
  // leave the portal figures alone rather than quietly adding 0.
  const tint = useTintApplications();
  const mergedKpis = useMemo(() => {
    if (!kpis.data) return kpis.data;
    if (tint.unavailable || !tint.counts) return kpis.data;
    const c = tint.counts;
    return {
      ...kpis.data,
      submitted: (kpis.data.submitted || 0) + c.submitted,
      drafts: (kpis.data.drafts || 0) + c.drafts,
      inProgress: (kpis.data.inProgress || 0) + c.pending + c.needsRevision,
      approved: (kpis.data.approved || 0) + c.approved,
    };
  }, [kpis.data, tint.unavailable, tint.counts]);
  // In-progress drafts, so the citizen can resume without hunting for the service.
  const drafts = useQuery({ queryKey: ['drafts'], queryFn: () => get('/applications/drafts') });

  const urgent = deadlines.data?.urgent;
  const deadlineItems = deadlines.data?.items || [];
  const notificationItems = notifications.data?.items || [];
  const apps = (cases.data?.items || []).filter((c) => !['issued', 'completed'].includes(c.status));
  const upcomingAppts = (appointments.data?.items || []).slice(0, 3);
  const familyItems = family.data?.items || [];
  const draftItems = drafts.data?.items || [];

  const firstName = (me.data?.name || '').split(/\s+/)[0];

  return (
    <div className="w-full">
      {/* ── Welcome banner ─────────────────────────────────────────────────── */}
      <WelcomeBanner
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome'}
        subtitle={me.data?.identifier
          ? `National ID ${me.data.identifier}`
          : 'Your government services, all in one place'}
      />

      {/* ── Urgent ─────────────────────────────────────────────────────────── */}
      {urgent && (
        <div className="oc-card mb-[18px] border-l-4 border-l-danger bg-danger-tint" role="alert">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-start gap-3.5 min-w-0">
              <span aria-hidden className="w-10 h-10 rounded-full bg-danger text-white grid place-items-center shrink-0 text-lg font-bold">!</span>
              <div className="min-w-0">
                <p className="font-bold text-danger-text">{urgent.title}</p>
                <p className="text-sm text-danger-text/90 mt-0.5">{urgent.message}</p>
              </div>
            </div>
            <Button variant="gold" className="shrink-0" onClick={() => navigate(urgent.payDeepLink || '/payments')}>
              Pay now
            </Button>
          </div>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────────
          Submitted / Drafts / Awaiting / Approved, all counted from the citizen's
          own rows via GET /dashboard/kpis. Each card deep-links: Drafts goes to the
          resume list, the rest to tracking. */}
      <KpiStrip kpis={mergedKpis} loading={kpis.isLoading || tint.isLoading} error={kpis.error} />

      {/* ── Resume a draft ──────────────────────────────────────────────────
          Shown only when there is something to resume. This is the single highest-
          value thing on the dashboard for a returning citizen: work they have
          already done that is one click from being finished. */}
      {draftItems.length > 0 && (
        <SectionCard
          title={draftItems.length === 1 ? 'Continue your application' : 'Continue your applications'}
          className="mb-[18px] xl:mb-5"
          action={draftItems.length > 3
            ? <LinkButton onClick={() => navigate('/tracking?filter=drafts')}>View all</LinkButton>
            : undefined}
        >
          <div className="flex flex-col">
            {draftItems.slice(0, 3).map((d) => (
              <ListRow
                key={d.id}
                title={d.serviceName || d.serviceId}
                sub={d.lastSavedAt
                  ? `Saved ${new Date(d.lastSavedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : 'Not yet submitted'}
                right={<Chip tone="warn" dot={false}>Draft</Chip>}
                rightSub="Resume"
                onClick={() => navigate(`/services/${d.serviceId}/apply`)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── At a glance ─────────────────────────────────────────────────────
          The secondary strip: appointments and family, which are separate
          owner-scoped collections rather than application counts. Applications
          moved up into the KPI strip above, so this no longer repeats them. */}
      <StatStrip
        stats={[
          {
            key: 'appointments',
            glyph: 'calendar',
            count: upcomingAppts.length,
            label: 'Upcoming appointments',
            hint: upcomingAppts.length
              ? `Next on ${shortDate(upcomingAppts[0].date)}`
              : 'None booked',
            // There is no /appointments list route — the existing card below sends
            // "View all" to /tracking, so this matches it. With none booked, /tracking
            // would be a dead end, so the zero state offers the booking flow instead.
            to: upcomingAppts.length ? '/tracking' : '/services/book-appointment',
            loading: appointments.isLoading,
          },
          {
            key: 'family',
            glyph: 'family',
            count: familyItems.length,
            label: 'People on your record',
            hint: familyItems.length ? 'Dependants and next of kin' : 'No one added yet',
            to: '/family',
            loading: family.isLoading,
          },
        ]}
      />

      {/* ── Row 1: services (wide) + profile (narrow) ────────────────────────
          The split widens in two steps on large screens so the extra room goes to
          the services grid rather than inflating the profile card. */}
      <div className="grid grid-cols-1 lg:grid-cols-dash-2 3xl:grid-cols-dash-2-wide 4xl:grid-cols-dash-2-ultra
                      gap-[18px] xl:gap-5 3xl:gap-6 mb-[18px] xl:mb-5 items-stretch">
        <SectionCard title="Frequently used services" actionLabel="View all" onAction={() => navigate('/agencies')}>
          {/* Tiles gain columns rather than width: 2 on a phone up to 6 on a very
              wide monitor, so a tile is always a comfortable tap/click target
              instead of a stretched banner. */}
          <div className="grid gap-3 xl:gap-3.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
            {QUICK_SERVICES.map((s) => (
              <ServiceTile
                key={s.id}
                icon={<ServiceGlyph name={s.glyph} />}
                label={s.label}
                onClick={() => navigate(s.to)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Profile" actionLabel="View profile" onAction={() => navigate('/profile')}>
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3.5 items-start">
            <dl className="flex-1 min-w-0 m-0 flex flex-col gap-3">
              <DataRow stack label="Nationality" value={me.data?.profile?.countryOfBirth || 'Guyanese'} />
              <DataRow stack label="National ID" value={me.data?.profile?.nationalId} />
              <DataRow stack label="Date of birth" value={me.data?.profile?.dob} />
            </dl>
            <LicenceThumb user={me.data} />
          </div>
          <NationalIdCard user={me.data} />
        </SectionCard>
      </div>

      {/* ── Row 2: applications · payments · family ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[18px] xl:gap-5 3xl:gap-6 mb-[18px] xl:mb-5 items-stretch">
        <SectionCard title="Applications" actionLabel="View all" onAction={() => navigate('/tracking')}>
          {cases.isLoading ? <ListSkeleton rows={2} />
            : cases.error ? <ErrorState error={cases.error} title="Could not load applications" onRetry={cases.refetch} />
            : apps.length === 0 ? (
              <EmptyState
                icon={<GlyphDoc />}
                title="No applications in progress"
                hint="Anything you apply for will appear here so you can follow every step."
                action={<Button size="sm" onClick={() => navigate('/agencies')}>Browse services</Button>}
              />
            ) : (
              <div className="flex flex-col">
                {apps.slice(0, 4).map((a) => (
                  <ListRow
                    key={a.id}
                    title={a.service}
                    sub={`${a.appNumber}${a.category ? ` · ${a.category}` : ''}`}
                    right={<StatusChip status={a.status} />}
                    rightSub={a.submittedAt
                      ? new Date(a.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : undefined}
                    onClick={() => navigate(`/tracking/${a.id}`)}
                  />
                ))}
              </div>
            )}
        </SectionCard>

        <SectionCard title="Payments" actionLabel="View all" onAction={() => navigate('/payments')}>
          {deadlines.isLoading ? <ListSkeleton rows={2} avatar={false} />
            : deadlines.error ? <ErrorState error={deadlines.error} title="Could not load payments" onRetry={deadlines.refetch} />
            : deadlineItems.length === 0 ? (
              <EmptyState icon={<GlyphCheck />} title="Nothing due" hint="Upcoming payments and renewals appear here." />
            ) : (
              <div className="flex flex-col">
                {deadlineItems.slice(0, 4).map((d) => (
                  <ListRow
                    key={d.id}
                    title={d.title}
                    sub={`Due ${d.dueDate}`}
                    right={<span className="font-bold tabular-nums">{money(d.amount)}</span>}
                    rightSub={<Chip tone={d.daysLeft <= 7 ? 'danger' : 'ok'} dot={false}>{d.daysLeft} days left</Chip>}
                    onClick={() => navigate('/payments')}
                  />
                ))}
              </div>
            )}
        </SectionCard>

        <SectionCard
          title={familyItems.length ? `Family (${familyItems.length})` : 'Family'}
          actionLabel="View all"
          onAction={() => navigate('/family')}
        >
          {family.isLoading ? <ListSkeleton rows={3} />
            : familyItems.length === 0 ? (
              <EmptyState
                icon={<GlyphUsers />}
                title="No family members added"
                hint="Add the people in your household so their records link to yours."
                action={<Button size="sm" variant="secondary" onClick={() => navigate('/family')}>Add a member</Button>}
              />
            ) : (
              <div className="flex flex-col">
                {familyItems.slice(0, 4).map((f) => (
                  <ListRow
                    key={f.id}
                    title={f.fullName}
                    sub={f.relationship}
                    onClick={() => navigate('/family')}
                  />
                ))}
              </div>
            )}
        </SectionCard>
      </div>

      {/* ── Appointments (only when the citizen has one) ────────────────────── */}
      {upcomingAppts.length > 0 && (
        <div className="mb-[18px]">
          <SectionCard title="Upcoming appointments" actionLabel="View all" onAction={() => navigate('/tracking')}>
            <div className="flex flex-col">
              {upcomingAppts.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.officeName}
                  sub={`${a.purpose || 'Appointment'} · ${a.reference}`}
                  right={<Chip tone="ok" dot={false}>{shortDate(a.date)} · {a.timeLabel}</Chip>}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── AskGov + resources ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] xl:gap-5 3xl:gap-6 mb-[18px] xl:mb-5">
        <div className="oc-card bg-tint dark:bg-d-tint border-tint dark:border-d-line">
          <div className="flex items-center gap-3 flex-wrap">
            <span aria-hidden className="w-10 h-10 rounded-tile bg-primary text-white grid place-items-center shrink-0">
              <svg viewBox="0 0 18 18" width="19" height="19" fill="currentColor">
                <path d="M9 1.5l1.6 4.2 4.4 1.5-4.4 1.5L9 13l-1.6-4.3L3 7.2l4.4-1.5L9 1.5z" />
              </svg>
            </span>
            <h2 className="oc-card-title text-primary dark:text-d-primary">Ask AskGov</h2>
          </div>
          <p className="text-sm mt-3">
            Answers about payments, eligibility, documents and forms — in plain language.
            AskGov can also draft an application from details you have already given government.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="secondary" onClick={() => setAssistantOpen(true)}>Ask a question</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/eligibility')}>Am I eligible?</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/profile')}>Update my details</Button>
          </div>
        </div>

        <SectionCard title="Help and guidance">
          <div className="grid grid-cols-1 sm:grid-cols-2 3xl:grid-cols-4 gap-1">
            {RESOURCES.map((r) => (
              <button
                key={r.title}
                type="button"
                onClick={() => navigate(r.to)}
                className="text-left p-2.5 rounded-tile hover:bg-tint dark:hover:bg-d-tint transition-colors duration-fast ease-standard min-h-tap"
              >
                <span className="block text-sm font-bold">{r.title}</span>
                <span className="block text-micro text-muted dark:text-d-muted mt-0.5">{r.sub}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Latest notifications — the prototype's 3-across strip ───────────── */}
      <SectionCard
        title="Latest notifications"
        action={<LinkButton onClick={() => navigate('/messages')}>View all</LinkButton>}
      >
        {notifications.isLoading ? <ListSkeleton rows={3} />
          : notifications.error ? <ErrorState error={notifications.error} title="Could not load updates" onRetry={notifications.refetch} />
          : notificationItems.length === 0 ? (
            <EmptyState icon={<GlyphBell />} title="No updates yet"
              hint="We will tell you here each time one of your applications moves forward." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-3.5 xl:gap-5">
              {notificationItems.slice(0, 6).map((n) => (
                <div key={n.id} className="flex gap-2.5">
                  <span aria-hidden className="w-8 h-8 rounded-full bg-tint dark:bg-d-tint text-primary dark:text-d-primary grid place-items-center shrink-0">
                    <GlyphBell size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">{n.title}</p>
                    {n.message && <p className="text-sm text-muted dark:text-d-muted mt-0.5">{n.message}</p>}
                    <p className="text-micro text-muted dark:text-d-muted mt-1">{n.timeAgo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </SectionCard>
    </div>
  );
}

// ── Local glyphs for the empty states ────────────────────────────────────────
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
function GlyphDoc() { return <svg aria-hidden viewBox="0 0 18 18" width="22" height="22" {...S}><path d="M5 2.5h5l3 3V15.5H5zM10 2.5v3h3M7 9h4M7 12h4" /></svg>; }
function GlyphCheck() { return <svg aria-hidden viewBox="0 0 18 18" width="22" height="22" {...S}><path d="M4 9.5l3.2 3.2L14 6" /></svg>; }
function GlyphUsers() { return <svg aria-hidden viewBox="0 0 18 18" width="22" height="22" {...S}><path d="M7 4.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM2.5 15c0-2.5 2-3.9 4.5-3.9s4.5 1.4 4.5 3.9M12.5 6.2a2 2 0 1 1 0 4M13 11.8c1.7.3 2.9 1.5 2.9 3.4" /></svg>; }
function GlyphBell({ size = 22 }) { return <svg aria-hidden viewBox="0 0 18 18" width={size} height={size} {...S}><path d="M9 2.5a4 4 0 0 1 4 4v3l1.5 2.5h-11L5 9.5v-3a4 4 0 0 1 4-4zM7 12v.5a2 2 0 0 0 4 0V12" /></svg>; }
