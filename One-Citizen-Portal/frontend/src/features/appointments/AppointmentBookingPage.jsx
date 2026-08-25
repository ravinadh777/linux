import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Grid, Card, CardContent, Typography, Button, Stack, TextField, MenuItem,
  Divider, ButtonBase, Alert, CircularProgress, Avatar, Skeleton,
} from '@mui/material';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import LockClockRoundedIcon from '@mui/icons-material/LockClockRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import { api, apiError } from '../../lib/api.js';
import { ErrorState, PageHeader, DataRow } from '../../components/ui.jsx';

const get = (url) => api.get(url).then((r) => r.data);
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const PURPOSES = ['New application', 'Collection / pick-up', 'Submit documents', 'Biometrics / photo', 'General enquiry', 'Other'];

export default function AppointmentBookingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [office, setOffice] = useState('');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState(null);        // held slot { id, label, time24 }
  const [purpose, setPurpose] = useState('New application');
  const [notes, setNotes] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(null);    // confirmed record

  const me = useQuery({ queryKey: ['me'], queryFn: () => get('/me') });
  const offices = useQuery({ queryKey: ['apt-offices'], queryFn: () => get('/appointments/offices') });

  // Next 14 working days (skip weekends), Teams-style date strip.
  const days = useMemo(() => {
    const out = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    while (out.length < 14) {
      d.setDate(d.getDate() + 1);
      const g = d.getDay();
      if (g !== 0 && g !== 6) out.push(new Date(d));
    }
    return out;
  }, []);

  // Sensible defaults once data is ready.
  useEffect(() => { if (!office && offices.data?.items?.length) setOffice(offices.data.items[0].code); }, [offices.data, office]);
  useEffect(() => { if (!date && days.length) setDate(toISO(days[0])); }, [days, date]);
  useEffect(() => { if (me.data) { setFullName((v) => v || me.data.name || ''); setPhone((v) => v || me.data.phone || ''); } }, [me.data]);
  useEffect(() => { setSlot(null); }, [office, date]);   // clear held slot when office/date changes

  const slots = useQuery({
    queryKey: ['apt-slots', office, date],
    queryFn: () => get(`/appointments/slots?office=${encodeURIComponent(office)}&date=${encodeURIComponent(date)}`),
    enabled: !!office && !!date,
  });

  const book = useMutation({
    mutationFn: () => api.post('/appointments', { office, date, slotId: slot.id, fullName, phone, purpose, notes }).then((r) => r.data),
    onSuccess: (rec) => { setBooked(rec); qc.invalidateQueries({ queryKey: ['apt-slots', office, date] }); },
    onError: (err) => {
      setError(apiError(err));
      setSlot(null);
      slots.refetch();       // someone may have taken it — refresh availability
    },
  });

  const officeName = offices.data?.items?.find((o) => o.code === office)?.name || '';
  const prettyDate = date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const canConfirm = office && date && slot && fullName.trim() && phone.trim() && purpose;

  // ── Confirmation state ──
  if (booked) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <Avatar sx={{ width: 68, height: 68, bgcolor: 'success.main', mx: 'auto', mb: 2 }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 38 }} />
            </Avatar>
            <Typography variant="h4" component="h1" sx={{ mb: 0.75 }}>Your appointment is booked</Typography>
            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 440, mx: 'auto' }}>
              Please arrive 10 minutes early and bring the documents listed for your service.
            </Typography>
            <Card variant="outlined" sx={{ textAlign: 'left', maxWidth: 460, mx: 'auto' }}>
              <CardContent component="dl" sx={{ m: 0 }}>
                <Stack divider={<Divider flexItem />} spacing={0}>
                  <DataRow label="Reference" value={booked.reference} strong />
                  <DataRow label="Office" value={booked.officeName} />
                  <DataRow label="Date" value={new Date(`${booked.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
                  <DataRow label="Time" value={booked.timeLabel} strong />
                  <DataRow label="Reason for visit" value={booked.purpose} />
                </Stack>
              </CardContent>
            </Card>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
              <Button variant="contained" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
              {/* Many citizens will want this on paper to bring with them. */}
              <Button variant="outlined" onClick={() => window.print()}>Print this</Button>
              <Button color="inherit" onClick={() => { setBooked(null); setSlot(null); }}>Book another</Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <>
      <PageHeader
        title="Book an appointment"
        subtitle="Choose an office, a day, then a time. Nobody else can take your time once you confirm it."
        crumbs={[{ label: 'Agencies', to: '/agencies' }, { label: 'Appointments' }]}
      />

      {error && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2.5}>
        {/* ── Scheduler ── */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              {/* Office */}
              <Typography variant="overline" color="text.secondary">Office</Typography>
              <TextField select fullWidth size="small" value={office} onChange={(e) => setOffice(e.target.value)} sx={{ mt: 0.5, mb: 3 }}>
                {(offices.data?.items || []).map((o) => <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>)}
              </TextField>

              {/* Date strip */}
              <Typography variant="overline" color="text.secondary">Select a day</Typography>
              {/* Deliberate horizontal strip (14 working days). The scroll stays; the
                  10px grey bar underneath it does not — it read as a layout defect
                  rather than an affordance. Snap points make it feel intentional, and
                  the strip remains wheel-, drag- and keyboard-scrollable. */}
              <Box
                className="oc-no-scrollbar"
                sx={{
                  display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, mt: 0.5, mb: 3,
                  scrollSnapType: 'x proximity',
                  overscrollBehaviorX: 'contain',
                  '& > *': { scrollSnapAlign: 'start' },
                }}
              >
                {days.map((d) => {
                  const iso = toISO(d);
                  const active = iso === date;
                  return (
                    <ButtonBase key={iso} onClick={() => setDate(iso)}
                      aria-pressed={active}
                      aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      sx={{
                        flex: '0 0 auto', width: 68, minHeight: 76, py: 1.25, borderRadius: 2, flexDirection: 'column',
                        border: 1, borderColor: active ? 'primary.main' : 'divider',
                        bgcolor: active ? 'primary.main' : 'transparent', color: active ? '#fff' : 'text.primary',
                        transition: (t) => `background-color ${t.motion.fast}ms ${t.motion.ease}, border-color ${t.motion.fast}ms ${t.motion.ease}`,
                        '&:hover': { borderColor: 'primary.main', bgcolor: active ? 'primary.main' : 'action.hover' },
                      }}>
                      <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Typography>
                      <Typography variant="h6" sx={{ lineHeight: 1.1 }}>{d.getDate()}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>{d.toLocaleDateString('en-US', { month: 'short' })}</Typography>
                    </ButtonBase>
                  );
                })}
              </Box>

              {/* Legend */}
              <Stack direction="row" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 2 }}>
                <Legend swatch={{ border: 1, borderColor: 'divider' }} label="Free" />
                <Legend swatch={{ bgcolor: 'primary.main' }} label="Your choice" />
                <Legend swatch={{ bgcolor: 'action.disabledBackground' }} label="Already taken" />
              </Stack>

              {/* Slots. Skeleton matches the grid so it does not jump when times land. */}
              {slots.isLoading && (
                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(3,1fr)', sm: 'repeat(4,1fr)', md: 'repeat(5,1fr)' } }}
                  role="status" aria-busy="true" aria-label="Loading available times">
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} variant="rounded" height={44} />)}
                </Box>
              )}
              {slots.error && <ErrorState error={slots.error} title="We could not load the available times" onRetry={slots.refetch} />}
              {slots.data?.closed && <Alert severity="info">{slots.data.reason}</Alert>}
              {slots.data && !slots.data.closed && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {slots.data.summary.available} of {slots.data.summary.total} slots available on {prettyDate}
                  </Typography>
                  {['Morning', 'Afternoon'].map((period) => {
                    const group = slots.data.slots.filter((s) => s.period === period);
                    if (!group.length) return null;
                    return (
                      <Box key={period} sx={{ mb: 2.5 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1, color: 'text.secondary' }}>
                          {period === 'Morning' ? <WbSunnyRoundedIcon sx={{ fontSize: 16 }} /> : <Brightness4RoundedIcon sx={{ fontSize: 16 }} />}
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{period}</Typography>
                        </Stack>
                        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(3,1fr)', sm: 'repeat(4,1fr)', md: 'repeat(5,1fr)' } }}>
                          {group.map((s) => {
                            const selected = slot?.id === s.id;
                            const taken = !s.available && !selected;
                            return (
                              <Button key={s.id} disableElevation
                                disabled={taken}
                                variant={selected ? 'contained' : 'outlined'}
                                onClick={() => { setError(''); setSlot(s); }}
                                // "Already taken" was previously conveyed by a strikethrough
                                // alone. An explicit accessible label states it, so the
                                // information does not depend on seeing the line.
                                aria-label={taken ? `${s.label} — already taken` : `${s.label}${selected ? ' — your choice' : ''}`}
                                sx={{
                                  fontWeight: 700,
                                  color: selected ? undefined : s.available ? 'text.primary' : 'text.disabled',
                                  borderColor: 'divider',
                                  bgcolor: taken ? 'action.disabledBackground' : undefined,
                                  textDecoration: taken ? 'line-through' : 'none',
                                }}>
                                {s.label}
                              </Button>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Summary / confirm rail ── */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Your appointment</Typography>

              <Stack spacing={1.25} sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <PlaceRoundedIcon fontSize="small" color="action" sx={{ mt: 0.25 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{officeName || 'Select an office'}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EventAvailableRoundedIcon fontSize="small" color="action" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{prettyDate || 'Select a day'}</Typography>
                </Stack>
                <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: slot ? 'primary.main' : 'divider', bgcolor: slot ? 'action.hover' : 'transparent' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LockClockRoundedIcon fontSize="small" color={slot ? 'primary' : 'disabled'} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{slot ? slot.label : 'No time selected'}</Typography>
                      <Typography variant="caption" color="text.secondary">{slot ? 'Held for you — confirm to reserve' : 'Pick an available time'}</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Stack spacing={1.5}>
                <TextField size="small" label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth />
                <TextField size="small" label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
                <TextField size="small" select label="Purpose of visit" value={purpose} onChange={(e) => setPurpose(e.target.value)} fullWidth>
                  {PURPOSES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
                <TextField size="small" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} />
              </Stack>

              <Button fullWidth variant="contained" size="large" sx={{ mt: 2 }} disabled={!canConfirm || book.isPending}
                startIcon={book.isPending ? <CircularProgress size={18} color="inherit" /> : <CheckCircleRoundedIcon />}
                onClick={() => { setError(''); book.mutate(); }}>
                {book.isPending ? 'Reserving…' : 'Confirm appointment'}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                The slot is locked to you on confirmation — no one else can book the same time.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

function Legend({ swatch, label }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 14, height: 14, borderRadius: 0.75, ...swatch }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}
