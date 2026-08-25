import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Card, CardContent, Typography, Stack, Chip, TextField, MenuItem, Button } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { PageHeader, EmptyState } from '../../components/ui.jsx';
import { CENTERS } from './helpData.js';
import { REGIONS } from '../apply/forms/regions.js';

export default function CentersPage() {
  const navigate = useNavigate();
  const [region, setRegion] = useState('All regions');
  const list = useMemo(() => (region === 'All regions' ? CENTERS : CENTERS.filter((c) => c.region === region)), [region]);

  return (
    <Box sx={{ width: '100%' }}>
      <PageHeader
        title="Local Assistance Centres"
        subtitle="Government service centres near you — walk in for in-person help."
        crumbs={[{ label: 'Help & Support' }, { label: 'Service centres' }]}
      />

      <TextField select label="Filter by region" value={region} onChange={(e) => setRegion(e.target.value)} sx={{ mb: 2.5, width: { xs: '100%', sm: 320 } }} size="small">
        <MenuItem value="All regions">All regions</MenuItem>
        {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
      </TextField>

      <Grid container spacing={2}>
        {list.map((c) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={c.name} sx={{ display: 'flex' }}>
            <Card sx={{ width: '100%', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 } }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25 }}>{c.name}</Typography>
                <Chip size="small" label={c.region} sx={{ alignSelf: 'flex-start', mt: 0.75, bgcolor: 'action.hover' }} />
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5, color: 'text.secondary' }}>
                  <PlaceRoundedIcon fontSize="small" sx={{ mt: 0.25 }} />
                  <Typography variant="body2">{c.address}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, color: 'text.secondary' }}>
                  <ScheduleRoundedIcon fontSize="small" />
                  <Typography variant="body2">{c.hours}</Typography>
                </Stack>
                <Box sx={{ mt: 1.25, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {c.services.map((s) => <Chip key={s} size="small" variant="outlined" label={s} sx={{ fontWeight: 600 }} />)}
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" startIcon={<EventAvailableRoundedIcon />} sx={{ mt: 1.5, alignSelf: 'flex-start' }} onClick={() => navigate('/services/book-appointment/apply')}>
                  Book an appointment
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {/* Was bare text floating outside the grid. It is now a proper empty state with a
          way forward, matching every other empty view in the app. */}
      {list.length === 0 && (
        <Card>
          <Box sx={{ p: 2 }}>
            <EmptyState
              icon={<PlaceRoundedIcon />}
              title={`No centres listed in ${region}`}
              hint="Try another region, or contact the help desk — they can tell you the nearest place to get help in person."
              action={<Button variant="outlined" onClick={() => navigate('/help/contact')}>Contact support</Button>}
            />
          </Box>
        </Card>
      )}
    </Box>
  );
}
