import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardActionArea, CardContent, Typography, Box, Stack, Button } from '@mui/material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { api } from '../../lib/api.js';
import {
  ErrorState, PageHeader, StatusChip, EmptyState, GridSkeleton, SectionHeader,
} from '../../components/ui.jsx';
import { Chip } from '../../ui/index.js';
import TintApplicationsSection from '../tint/TintApplicationsSection.jsx';

const get = (url) => api.get(url).then((r) => r.data);
const prettyDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const savedAt = (iso) => (iso
  ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : null);

// The filter tabs. `all` is the default; `drafts` is what the dashboard's Drafts KPI
// deep-links to, which is why the value is part of the URL rather than local state —
// the filtered view has to be linkable and survive a refresh or a shared link.
const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'open', label: 'Awaiting a decision' },
  { key: 'closed', label: 'Completed' },
];
const OPEN = new Set(['submitted', 'in_progress', 'in_review', 'under_review', 'pending', 'awaiting_confirmation', 'docs']);

export default function TrackingPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some((f) => f.key === params.get('filter')) ? params.get('filter') : 'all';
  const setFilter = (key) => setParams(key === 'all' ? {} : { filter: key }, { replace: true });

  const apps = useQuery({ queryKey: ['applications'], queryFn: () => get('/applications') });
  const appts = useQuery({ queryKey: ['appointments'], queryFn: () => get('/appointments') });
  const drafts = useQuery({ queryKey: ['drafts'], queryFn: () => get('/applications/drafts') });

  const allItems = apps.data?.items || [];
  const draftItems = drafts.data?.items || [];
  const items = filter === 'drafts' ? []
    : filter === 'open' ? allItems.filter((a) => OPEN.has(String(a.status)))
    : filter === 'closed' ? allItems.filter((a) => !OPEN.has(String(a.status)))
    : allItems;
  // Appointments belong to the unfiltered view only — they are not applications, and
  // showing them under "Drafts" or "Completed" would be misleading.
  const appointments = filter === 'all' ? (appts.data?.items || []) : [];
  const showDrafts = filter === 'all' || filter === 'drafts';
  const loading = apps.isLoading || appts.isLoading || drafts.isLoading;
  const empty = !loading && items.length === 0 && appointments.length === 0
    && (!showDrafts || draftItems.length === 0);

  return (
    <>
      <PageHeader
        title="Track your applications"
        subtitle="Everything you have applied for or booked, and exactly where each one has reached."
      />

      {/* ── Filter tabs ───────────────────────────────────────────────────────
          A real tablist, so arrow keys work and a screen reader announces the
          selected view. Counts are shown inline: a tab that says "Drafts 2" tells
          the citizen there is something there before they click it. */}
      <div role="tablist" aria-label="Filter applications"
        className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === 'drafts' ? draftItems.length
            : f.key === 'open' ? allItems.filter((a) => OPEN.has(String(a.status))).length
            : f.key === 'closed' ? allItems.filter((a) => !OPEN.has(String(a.status))).length
            : allItems.length + draftItems.length;
          return (
            <button
              key={f.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`oc-btn oc-btn-sm ${active ? 'oc-btn-primary' : 'oc-btn-secondary'}`}
            >
              {f.label}
              {count > 0 && (
                <span className={`tabular-nums ${active ? 'opacity-80' : 'text-muted dark:text-d-muted'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && <GridSkeleton count={6} md={4} lg={4} />}

      {/* Both errors are surfaced. The appointments error was previously swallowed —
          only `apps.error` was rendered — so a failed appointments call left the
          section silently missing with no explanation. */}
      {apps.error && <ErrorState error={apps.error} title="We could not load your applications" onRetry={apps.refetch} />}
      {appts.error && <ErrorState error={appts.error} title="We could not load your appointments" onRetry={appts.refetch} />}

      {empty && (
        <Card>
          <CardContent>
            {/* The empty copy follows the active filter. "Nothing to track yet" under
                a Drafts filter would be wrong and confusing — the citizen may well
                have submitted applications, just no unfinished ones. */}
            <EmptyState
              icon={filter === 'drafts' ? <EditNoteRoundedIcon /> : <ReceiptLongRoundedIcon />}
              title={filter === 'drafts' ? 'No saved drafts'
                : filter === 'open' ? 'Nothing awaiting a decision'
                : filter === 'closed' ? 'Nothing completed yet'
                : 'Nothing to track yet'}
              hint={filter === 'drafts'
                ? 'If you start an application and cannot finish it, it is saved here automatically so you can come back to it.'
                : 'Once you apply for a service or book an appointment, it appears here with its live status and next step.'}
              action={<Button variant="contained" onClick={() => navigate('/agencies')}>Browse services</Button>}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Drafts ────────────────────────────────────────────────────────────
          Listed FIRST: an unfinished application is the only thing on this page the
          citizen can act on directly, and it is the one most at risk of being
          forgotten. Everything else is waiting on government. */}
      {showDrafts && draftItems.length > 0 && (
        <Box component="section" sx={{ mb: 4 }}>
          <SectionHeader title="Not yet submitted" />
          <Grid container spacing={2}>
            {draftItems.map((d) => (
              <Grid item xs={12} sm={6} md={4} key={d.id}>
                <Card sx={{
                  height: '100%',
                  transition: (t) => `border-color ${t.motion.base}ms ${t.motion.ease}, box-shadow ${t.motion.base}ms ${t.motion.ease}`,
                  '&:hover': { borderColor: 'primary.main', boxShadow: (t) => t.elevationTokens[3] },
                }}>
                  <CardActionArea onClick={() => navigate(`/services/${d.serviceId}/apply`)} sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box aria-hidden sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'warning.subtle', color: 'warning.text', flexShrink: 0 }}>
                          <EditNoteRoundedIcon />
                        </Box>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{d.serviceName || d.serviceId}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {d.lastSavedAt ? `Saved ${savedAt(d.lastSavedAt)}` : 'In progress'}
                          </Typography>
                        </Box>
                        <ChevronRightRoundedIcon aria-hidden sx={{ color: 'text.secondary', flexShrink: 0 }} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                        <Typography variant="caption" color="primary.dark" sx={{ fontWeight: 700 }}>
                          Continue where you left off
                        </Typography>
                        <Chip tone="warn" dot={false}>Draft</Chip>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ── Appointments ── */}
      {appointments.length > 0 && (
        <Box component="section" sx={{ mb: 4 }}>
          <SectionHeader title="Appointments" />
          <Grid container spacing={2}>
            {appointments.map((a) => (
              <Grid item xs={12} sm={6} md={4} key={a.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box aria-hidden sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'secondary.subtle', color: 'secondary.onSubtle', flexShrink: 0 }}>
                        <EventAvailableRoundedIcon />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{a.officeName}</Typography>
                        <Typography variant="body2" color="text.secondary">{prettyDate(a.date)} · {a.timeLabel}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{a.reference}</Typography>
                      <StatusChip status={a.status} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ── Tint waivers (MOHA-backed) ─────────────────────────────────────────
          Rendered from GET /v1/applications, because tint applications are stored by
          MOHA and the portal's own applications query cannot see them. Without this a
          submitted waiver would vanish from the citizen's view entirely. */}
      <TintApplicationsSection filter={filter} />

      {/* ── Applications ── */}
      {items.length > 0 && (
        <Box component="section">
          <SectionHeader title="Applications" />
          <Grid container spacing={2}>
            {items.map((a) => (
              <Grid item xs={12} sm={6} md={4} key={a.id}>
                <Card sx={{
                  height: '100%',
                  transition: (t) => `border-color ${t.motion.base}ms ${t.motion.ease}, box-shadow ${t.motion.base}ms ${t.motion.ease}`,
                  '&:hover': { borderColor: 'primary.main', boxShadow: (t) => t.elevationTokens[3] },
                  '&:hover .tr-chev': { transform: 'translateX(2px)' },
                }}>
                  <CardActionArea onClick={() => navigate(`/tracking/${a.id}`)} sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box aria-hidden sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.subtle', color: 'primary.onSubtle', flexShrink: 0 }}>
                          <ReceiptLongRoundedIcon />
                        </Box>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{a.serviceName}</Typography>
                          <Typography variant="body2" color="text.secondary">{a.ministryName}</Typography>
                        </Box>
                        <ChevronRightRoundedIcon aria-hidden className="tr-chev"
                          sx={{ color: 'text.secondary', flexShrink: 0, transition: (t) => `transform ${t.motion.fast}ms ${t.motion.ease}` }} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{a.reference}</Typography>
                        <StatusChip status={a.status} />
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </>
  );
}
