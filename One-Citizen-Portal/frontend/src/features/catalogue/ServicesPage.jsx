import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardActionArea, CardContent, Typography, Box, Button, Stack } from '@mui/material';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { api } from '../../lib/api.js';
import { ErrorState, PageHeader, EmptyState, GridSkeleton } from '../../components/ui.jsx';

export default function ServicesPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['services', code],
    queryFn: () => api.get(`/catalogue/agencies/${code}/services`).then((r) => r.data),
  });

  const services = data?.services || [];

  return (
    <>
      <PageHeader
        title={data?.agency?.name || 'Services'}
        subtitle="Pick a service to see what you need and start your application."
        crumbs={[
          { label: 'Agencies', to: '/agencies' },
          { label: data?.agency?.name || code },
        ]}
      />

      {isLoading && <GridSkeleton count={6} md={4} lg={4} showMedia={false} />}
      {error && <ErrorState error={error} title="We could not load these services" onRetry={refetch} />}

      {!isLoading && !error && services.length === 0 && (
        <Card>
          <Box sx={{ p: 2 }}>
            <EmptyState
              icon={<DesignServicesRoundedIcon />}
              title="No services listed yet"
              hint="This agency has no online services available at the moment. The help desk can tell you how to apply in person."
              action={<Button variant="outlined" onClick={() => navigate('/help/contact')}>Contact support</Button>}
            />
          </Box>
        </Card>
      )}

      <Grid container spacing={2}>
        {services.map((s) => (
          <Grid item xs={12} sm={6} md={4} key={s.id} sx={{ display: 'flex' }}>
            <Card sx={{
              width: '100%', display: 'flex', flexDirection: 'column',
              transition: (t) => `border-color ${t.motion.base}ms ${t.motion.ease}, box-shadow ${t.motion.base}ms ${t.motion.ease}`,
              '&:hover': { borderColor: 'primary.main', boxShadow: (t) => t.elevationTokens[3] },
            }}>
              {/* The card body opens the service DETAIL page; the footer button starts the
                  application. Two destinations, so each is now its own explicit control —
                  previously the whole card and the button did different things with no
                  visual boundary between them. */}
              <CardActionArea onClick={() => navigate(`/services/${s.id}`)} sx={{ flexGrow: 1, alignItems: 'stretch' }}>
                <CardContent>
                  <Box aria-hidden sx={{ width: 46, height: 46, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.subtle', color: 'primary.onSubtle', mb: 1.5 }}>
                    <DesignServicesRoundedIcon />
                  </Box>
                  <Typography variant="h6" component="h2">{s.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{s.description}</Typography>
                  {/* The "Assurance L2" chip that used to sit here is gone — see
                      ./assurance.js for why it told the citizen nothing. */}
                </CardContent>
              </CardActionArea>
              <Stack direction="row" spacing={1} sx={{ p: 2, pt: 0 }}>
                <Button fullWidth variant="contained" endIcon={<ArrowForwardRoundedIcon />}
                  onClick={() => navigate(`/services/${s.id}/apply`)}>
                  Start application
                </Button>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
