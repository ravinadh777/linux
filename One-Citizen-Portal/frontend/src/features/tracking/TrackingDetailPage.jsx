import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Typography, Stack, Divider, Grid, Box, Alert, AlertTitle, Button,
  Stepper, Step, StepLabel, List, ListItem, ListItemText, ListItemIcon, Skeleton, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FolderOffRoundedIcon from '@mui/icons-material/FolderOffRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { api } from '../../lib/api.js';
import {
  ErrorState, PageHeader, StatusChip, EmptyState, ListSkeleton, DataRow, SectionCard,
} from '../../components/ui.jsx';
import DocumentCard from '../../components/DocumentViewer.jsx';
import { getServiceForm } from '../apply/forms/index.js';

const DONE = new Set(['approved', 'completed']);
const fmt = (d) => (d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/**
 * Build a `fieldName → human label` map from the service's own form definition.
 *
 * "Submitted details" previously rendered the raw payload keys with only a
 * camelCase split applied, so citizens were shown machine names —
 * "date Of Birth", "national Id", "lot". The labels already exist in
 * features/apply/forms, which is where the citizen read them while filling the
 * form, so reusing them keeps the two views consistent by construction.
 */
function useFieldLabels(serviceId) {
  return useMemo(() => {
    const form = getServiceForm(serviceId);
    const map = {};
    for (const section of form.sections || []) {
      for (const f of section.fields || []) map[f.name] = f.label;
    }
    return map;
  }, [serviceId]);
}

// Fallback for any key the form definition does not cover (e.g. a legacy
// submission whose field was since renamed).
const humanise = (k) => k
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/^./, (c) => c.toUpperCase());

export default function TrackingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  const appQ = useQuery({ queryKey: ['application', id], queryFn: () => api.get(`/applications/${id}`).then((r) => r.data) });
  // Real submitted documents for THIS application (full DTOs → preview + download).
  const docsQ = useQuery({
    queryKey: ['application-documents', id],
    queryFn: () => api.get('/documents', { params: { applicationId: id } }).then((r) => r.data.items || []),
    enabled: !!appQ.data,
  });

  const labels = useFieldLabels(appQ.data?.serviceId);

  if (appQ.isLoading) {
    return (
      <Stack spacing={2.5} role="status" aria-busy="true" aria-label="Loading application">
        <Skeleton variant="rounded" height={76} />
        <Skeleton variant="rounded" height={132} />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={7}><Skeleton variant="rounded" height={260} /></Grid>
          <Grid item xs={12} md={5}><Skeleton variant="rounded" height={260} /></Grid>
        </Grid>
      </Stack>
    );
  }
  if (appQ.error) return <ErrorState error={appQ.error} title="We could not load this application" onRetry={appQ.refetch} />;

  const app = appQ.data;
  const lanes = app.lanes || [];
  const activeStep = lanes.findIndex((l) => !DONE.has(l.status));
  const stepIndex = activeStep === -1 ? lanes.length : activeStep;

  // Documents: prefer the live vault list (rich DTOs); fall back to the app's embedded refs.
  const docs = (docsQ.data && docsQ.data.length)
    ? docsQ.data
    : (app.documents || []).map((d) => ({ documentId: d.documentId, fileName: d.filename, label: d.label || d.type, format: (d.filename || '').split('.').pop() }));

  const rejected = app.status === 'rejected';
  const pending = !DONE.has(app.status) && !rejected ? (lanes[stepIndex]?.name || 'In progress') : null;
  const formEntries = Object.entries(app.form || {});

  return (
    <>
      <PageHeader
        title={app.serviceName}
        subtitle={`${app.ministryName || app.agencyName || ''}${app.reference ? ' · ' + app.reference : ''}`}
        crumbs={[{ label: 'Tracking', to: '/tracking' }, { label: app.reference || 'Application' }]}
        actions={<StatusChip status={app.status} size="medium" />}
      />


      {rejected && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5 }}
          action={<Button color="inherit" size="small" startIcon={<ReplayRoundedIcon />} onClick={() => navigate(`/services/${app.serviceId}/apply`)}>Apply again</Button>}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>This application was not approved</AlertTitle>
          {app.rejectionReason
            ? app.rejectionReason
            : 'No reason was recorded. Contact the agency, or correct your details and apply again.'}
        </Alert>
      )}
      {pending && (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>Currently with: {pending}</AlertTitle>
          You do not need to do anything. We will tell you as soon as it moves on.
        </Alert>
      )}

      <Grid container spacing={2.5} alignItems="flex-start">
        {/* ── Progress ─────────────────────────────────────────────────────── */}
        {lanes.length > 0 && (
          <Grid item xs={12}>
            <SectionCard title="Progress">
              {/* Vertical below md. The horizontal `alternativeLabel` stepper squashed
                  and overflowed on a phone once an application had more than four
                  lanes — which most of them do. */}
              {/* Horizontal on desktop, and if an application has enough lanes with long
                  names to exceed the card, it scrolls WITHIN the card rather than pushing
                  the whole page sideways. Bar hidden — the stepper's own shape already
                  signals there is more to the right. */}
              <Stepper
                activeStep={stepIndex}
                orientation={isNarrow ? 'vertical' : 'horizontal'}
                alternativeLabel={!isNarrow}
                className={isNarrow ? undefined : 'oc-no-scrollbar'}
                sx={{
                  mt: 1,
                  ...(!isNarrow && {
                    overflowX: 'auto',
                    pb: 1,
                    // Each step needs a floor or the labels crush together instead of
                    // triggering the scroll.
                    '& .MuiStep-root': { minWidth: 132 },
                  }),
                }}
              >
                {lanes.map((lane) => (
                  <Step key={lane.name} completed={DONE.has(lane.status)}>
                    <StepLabel
                      optional={
                        <Typography variant="caption" color="text.secondary">
                          {(lane.status || '').replace(/_/g, ' ')}{lane.sla ? ` · ${lane.sla}` : ''}
                        </Typography>
                      }
                    >
                      {lane.name}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </SectionCard>
          </Grid>
        )}

        {/* ── History ──────────────────────────────────────────────────────── */}
        <Grid item xs={12} md={7}>
          <SectionCard title="History" fullHeight>
            {(app.timeline || []).length ? (
              <List disablePadding>
                {app.timeline.map((t, i) => (
                  <ListItem key={i} disableGutters alignItems="flex-start" sx={{ pb: 2 }}>
                    <ListItemIcon aria-hidden sx={{ minWidth: 28, mt: 0.75 }}>
                      <FiberManualRecordRoundedIcon sx={{ fontSize: 11, color: i === 0 ? 'primary.main' : 'text.disabled' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={t.event}
                      secondary={
                        <>
                          <Box component="span" sx={{ display: 'block' }}>{fmt(t.at)}</Box>
                          {t.note && <Box component="span" sx={{ display: 'block' }}>{t.note}</Box>}
                        </>
                      }
                      primaryTypographyProps={{ fontWeight: 700, variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState dense icon={<HistoryRoundedIcon />} title="No history yet"
                hint="Each step your application takes will be recorded here with its date." />
            )}
          </SectionCard>
        </Grid>

        {/* ── Documents + submitted details ────────────────────────────────── */}
        <Grid item xs={12} md={5}>
          <Stack spacing={2.5}>
            <SectionCard title={docs.length ? `Documents (${docs.length})` : 'Documents'}>
              {docsQ.isLoading ? (
                <ListSkeleton rows={2} avatar={false} />
              ) : docs.length ? (
                <Stack spacing={1}>
                  {docs.map((d) => <DocumentCard key={d.documentId} doc={d} dense />)}
                </Stack>
              ) : (
                <EmptyState dense icon={<FolderOffRoundedIcon />} title="No documents"
                  hint="This application did not require any uploads." />
              )}
            </SectionCard>

            <SectionCard title="What you submitted">
              {formEntries.length ? (
                <Stack component="dl" spacing={0} divider={<Divider flexItem />} sx={{ m: 0 }}>
                  {formEntries.map(([k, v]) => (
                    <DataRow
                      key={k}
                      // Real form label first; camelCase split only as a fallback.
                      label={labels[k] || humanise(k)}
                      value={Array.isArray(v) ? v.join(', ') : (v === '' || v == null ? null : String(v))}
                    />
                  ))}
                </Stack>
              ) : (
                <EmptyState dense icon={<DescriptionRoundedIcon />} title="No details recorded"
                  hint="This application was submitted without additional form details." />
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
