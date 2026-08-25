import { useNavigate } from 'react-router-dom';
import { Box, Grid, Card, CardContent, Typography, Stack, Button, Divider, Avatar } from '@mui/material';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { PageHeader, SectionHeader } from '../../components/ui.jsx';
import { HELPDESK, AGENCY_CONTACTS } from './helpData.js';
import { useUiStore } from '../../stores/uiStore.js';

function Channel({ icon, label, value, href }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
      <Avatar sx={{ bgcolor: 'action.hover', color: 'primary.main', width: 40, height: 40, flexShrink: 0 }}>{icon}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography
          sx={{ fontWeight: 700, wordBreak: 'break-word' }}
          component={href ? 'a' : 'div'}
          href={href}
          style={href ? { color: 'inherit', textDecoration: 'none' } : undefined}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

export default function ContactPage() {
  const navigate = useNavigate();
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);

  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <PageHeader
        title="Contact Support"
        subtitle="Reach the oneCitizen help desk or a specific agency directly."
        crumbs={[{ label: 'Help & Support' }, { label: 'Contact' }]}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeader title="oneCitizen Help Desk" />
              <Channel icon={<CallRoundedIcon />} label="Hotline" value={HELPDESK.hotline} href={`tel:${HELPDESK.hotline.replace(/\s/g, '')}`} />
              <Divider />
              <Channel icon={<ChatRoundedIcon />} label="WhatsApp" value={HELPDESK.whatsapp} href={`https://wa.me/${HELPDESK.whatsapp.replace(/[^\d]/g, '')}`} />
              <Divider />
              <Channel icon={<EmailRoundedIcon />} label="Email" value={HELPDESK.email} href={`mailto:${HELPDESK.email}`} />
              <Divider />
              <Channel icon={<ScheduleRoundedIcon />} label="Opening hours" value={HELPDESK.hours} />
              <Button fullWidth variant="contained" startIcon={<AutoAwesomeRoundedIcon />} sx={{ mt: 2 }} onClick={() => setAssistantOpen(true)}>
                Chat with AskGov now
              </Button>
              <Button fullWidth variant="outlined" startIcon={<PlaceRoundedIcon />} sx={{ mt: 1 }} onClick={() => navigate('/help/centers')}>
                Find a service centre
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeader title="Agency directory" />
              <Stack divider={<Divider flexItem />} spacing={0}>
                {AGENCY_CONTACTS.map((a) => (
                  <Box key={a.code} sx={{ py: 1.5 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={{ xs: 0.75, sm: 2 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{a.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.for}</Typography>
                      </Box>
                      <Stack spacing={0.25} sx={{ textAlign: { sm: 'right' }, flexShrink: 0, minWidth: 0 }}>
                        <Typography variant="body2" component="a" href={`tel:${a.phone.replace(/\s/g, '')}`} sx={{ fontWeight: 600, color: 'primary.main', textDecoration: 'none' }}>{a.phone}</Typography>
                        <Typography variant="caption" component="a" href={`mailto:${a.email}`} sx={{ color: 'text.secondary', textDecoration: 'none', wordBreak: 'break-word' }}>{a.email}</Typography>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
