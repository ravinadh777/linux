import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Grid, Typography, Button, List, ListItem, ListItemIcon, ListItemText,
  Chip, Stack, Box, Alert, Skeleton,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { api } from '../../lib/api.js';
import { ErrorState, PageHeader, SectionCard } from '../../components/ui.jsx';
import { useUiStore } from '../../stores/uiStore.js';
import { assuranceNote } from './assurance.js';

export default function ServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);
  const { data: svc, isLoading, error, refetch } = useQuery({
    queryKey: ['service', id],
    queryFn: () => api.get(`/catalogue/services/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <Stack spacing={2.5} role="status" aria-busy="true" aria-label="Loading service">
        <Skeleton variant="rounded" height={84} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}><Skeleton variant="rounded" height={420} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={210} /></Grid>
        </Grid>
      </Stack>
    );
  }
  if (error) return <ErrorState error={error} title="We could not load this service" onRetry={refetch} />;

  const isAppointment = svc.id === 'book-appointment';
  const steps = isAppointment
    ? ['Fill in your appointment details', 'Send your request', 'The office confirms your slot', 'Attend your appointment']
    : ['Fill in the application form', 'Checks run in the background', 'An officer makes the decision', 'Collect your result'];

  const extraId = assuranceNote(svc.requiredAssurance);

  return (
    <>
      <PageHeader
        title={svc.name}
        subtitle={svc.description}
        crumbs={[
          { label: 'Agencies', to: '/agencies' },
          { label: svc.agencyName, to: `/agencies/${svc.agencyCode}` },
          { label: svc.name },
        ]}
      />

      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} md={8}>
          <Stack spacing={2.5}>
            <SectionCard title="What you need">
              <Chip label={svc.agencyName} size="small" sx={{ mb: 2 }} />

              {/* Only shown when the requirement exceeds what being signed in already
                  gives you — see ./assurance.js. Previously every service displayed
                  "Requires assurance L2" regardless. */}
              {extraId && <Alert severity="info" sx={{ mb: 2 }}>{extraId}</Alert>}

              {svc.prerequisites?.length ? (
                <List dense disablePadding>
                  {svc.prerequisites.map((p, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                      <ListItemIcon aria-hidden sx={{ minWidth: 34 }}>
                        <CheckCircleRoundedIcon fontSize="small" sx={{ color: 'success.main' }} />
                      </ListItemIcon>
                      <ListItemText primary={p} primaryTypographyProps={{ variant: 'body1' }} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Nothing to bring in advance — the form tells you if a document is needed.
                </Typography>
              )}
            </SectionCard>

            <SectionCard title="How it works">
              <List disablePadding>
                {steps.map((s, i) => (
                  <ListItem key={i} disableGutters alignItems="flex-start" sx={{ py: 0.75 }}>
                    <ListItemIcon aria-hidden sx={{ minWidth: 38, mt: 0.25 }}>
                      {/* Numbered because these ARE a sequence — the order is the meaning. */}
                      <Box sx={{
                        width: 26, height: 26, borderRadius: '50%', bgcolor: 'primary.main', color: 'common.white',
                        display: 'grid', placeItems: 'center', fontSize: '0.8125rem', fontWeight: 700,
                      }}>
                        {i + 1}
                      </Box>
                    </ListItemIcon>
                    <ListItemText primary={s} primaryTypographyProps={{ variant: 'body1' }} />
                  </ListItem>
                ))}
              </List>

              <Button variant="contained" size="large" startIcon={<PlayArrowRoundedIcon />} sx={{ mt: 2.5 }}
                onClick={() => navigate(`/services/${id}/apply`)}>
                Start application
              </Button>
            </SectionCard>
          </Stack>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* ── AskGov card ──────────────────────────────────────────────────────
              Same bug as the apply banner: `theme.gradients.brand` had been renamed
              away, so the background resolved to `undefined`. The `primary.onSubtle`
              text colour here was a workaround for that — dark green reads fine on
              the accidentally-white card but would be green-on-green once the
              gradient came back. Both are fixed: real green gradient, white text. */}
          <div className="relative overflow-hidden rounded-card text-white
                          bg-gradient-to-br from-primary-deep via-primary to-[#0F8A63]">
            <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gold/70" />
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(320px circle at 85% -30%, rgba(252,209,22,.20), transparent 62%)',
              }}
            />
            <div className="relative p-4 sm:p-5">
              <span aria-hidden className="w-10 h-10 rounded-tile bg-white/15 grid place-items-center backdrop-blur-sm">
                <svg viewBox="0 0 18 18" width="19" height="19" fill="currentColor">
                  <path d="M9 1.5l1.6 4.2 4.4 1.5-4.4 1.5L9 13l-1.6-4.3L3 7.2l4.4-1.5L9 1.5z" />
                </svg>
              </span>
              <h2 className="text-card-title font-bold mt-3">Let AskGov help</h2>
              <p className="text-sm text-white/85 mt-1.5">
                AskGov can fill this application in from your saved details and answer questions
                as you go. You check every value and submit it yourself.
              </p>
              <button
                type="button"
                onClick={() => { setAssistantOpen(true); navigate(`/services/${id}/apply`); }}
                className="oc-btn-gold w-full mt-4"
              >
                Apply with AskGov
              </button>
            </div>
          </div>
        </Grid>
      </Grid>
    </>
  );
}
