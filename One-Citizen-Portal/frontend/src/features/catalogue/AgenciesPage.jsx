import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardActionArea, Typography, Box, Stack } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import { api } from '../../lib/api.js';
import {
  ErrorState, PageHeader, EmptyState, GridSkeleton, VisuallyHidden,
} from '../../components/ui.jsx';

// Agency brand images (public/brand). Match by agency code first, then ministry code, then a
// neutral government-logo fallback — so every tile always shows an image, no hardcoded per-tile.
const AGENCY_IMAGE = {
  GRA: '/brand/GRA.png',
  GRO: '/brand/GRO.png',
  MOF: '/brand/MOF.png',
  MHSSS: '/brand/MHSSS.png',
  NIS: '/brand/NIS.png',
  CIPO: '/brand/MHF.png',
  OHG: '/brand/MHW.png',
};
const MINISTRY_IMAGE = {
  MOHA: '/brand/MHF.png',
  GRA: '/brand/GRA.png',
  MOF: '/brand/MOF.png',
  MHSSS: '/brand/MHSSS.png',
  MOL: '/brand/NIS.png',
};
const FALLBACK_IMAGE = '/brand/guyana-logo.png';
const imageFor = (a) => AGENCY_IMAGE[a.code] || MINISTRY_IMAGE[a.ministryCode] || FALLBACK_IMAGE;

// Catalogue entry point — every government agency, agency-first (ministries removed from the flow).
export default function AgenciesPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agencies-all'],
    queryFn: () => api.get('/catalogue/agencies').then((r) => r.data),
  });
  // The signed-in citizen — handed to redirect-only agencies (e.g. NIS) so their
  // micro-frontend can pick up the session without a second login.
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/me').then((r) => r.data) });

  // External agencies live in a separate micro-frontend. Behaviour unchanged: we deep-link to
  // their URL in a new tab and pass the logged-in user object as a URL-encoded path param.
  const openAgency = (a) => {
    if (a.externalUrl) {
      const base = a.externalUrl.replace(/\/+$/, '');
      const role = { persona: 'individual', nationality: 'guyanese', bizType: 'sole' };
      const payload = { ...(me || {}), role };
      const userParam = encodeURIComponent(JSON.stringify(payload));
      window.open(`${base}/${userParam}`, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(`/agencies/${a.code}`);
  };

  const servicesLine = (a) => {
    if (a.services?.length) return a.services.join(' · ');
    return a.externalUrl ? 'Register on the agency’s own site' : 'View services';
  };

  const agencies = data?.items || [];

  return (
    <>
      <PageHeader
        title="Government agencies"
        subtitle="Choose the agency that handles what you need. Each one lists the services you can apply for."
      />

      {isLoading && <GridSkeleton count={8} />}
      {error && <ErrorState error={error} title="We could not load the agency list" onRetry={refetch} />}

      {!isLoading && !error && agencies.length === 0 && (
        <Card>
          <Box sx={{ p: 2 }}>
            <EmptyState
              icon={<AccountBalanceRoundedIcon />}
              title="No agencies to show"
              hint="The service catalogue is empty right now. Please try again shortly, or contact the help desk if this continues."
            />
          </Box>
        </Card>
      )}

      <Grid container spacing={2} alignItems="stretch">
        {agencies.map((a) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={a.code} sx={{ display: 'flex' }}>
            <Card sx={{
              width: '100%', overflow: 'hidden',
              transition: (t) => `border-color ${t.motion.base}ms ${t.motion.ease}, box-shadow ${t.motion.base}ms ${t.motion.ease}`,
              '&:hover': { borderColor: 'primary.main', boxShadow: (t) => t.elevationTokens[3] },
            }}>
              <CardActionArea
                sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                onClick={() => openAgency(a)}
              >
                {/* Logo band. `bgcolor` was `grey.50` — a hardcoded light grey that stayed
                    light in dark mode, leaving a bright stripe across every tile. It is now
                    the themed `surface.sunken`. */}
                <Box sx={{
                  height: 132, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', px: 2, bgcolor: 'surface.sunken', borderBottom: 1, borderColor: 'divider',
                }}>
                  <Box
                    component="img"
                    src={imageFor(a)}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                    sx={{ maxHeight: 96, maxWidth: '100%', width: 'auto', objectFit: 'contain', display: 'block' }}
                  />
                </Box>

                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <Stack direction="row" spacing={0.75} alignItems="flex-start">
                    <Typography
                      variant="subtitle1"
                      component="h2"
                      sx={{
                        fontWeight: 700, lineHeight: 1.3, flexGrow: 1,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}
                    >
                      {a.name}
                    </Typography>
                    {/* External agencies open in a new tab. That was previously invisible —
                        the citizen only found out when the tab appeared. */}
                    {a.externalUrl && (
                      <>
                        <OpenInNewRoundedIcon aria-hidden sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5, flexShrink: 0 }} />
                        <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
                      </>
                    )}
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {a.ministryName}
                  </Typography>

                  <Box sx={{ flexGrow: 1, minHeight: 8 }} />

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    title={servicesLine(a)}
                    sx={{
                      mt: 1.5, pt: 1.25, borderTop: 1, borderColor: 'divider',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}
                  >
                    {servicesLine(a)}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
