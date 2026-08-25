import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Stack, Button, Divider } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import { PageHeader } from '../../components/ui.jsx';

// The step number is structural, not part of the title string — these ARE a sequence,
// so the order carries meaning and is rendered as a numbered marker below.
const STEPS = [
  { icon: <CheckCircleRoundedIcon />, title: 'Check what you qualify for', body: 'Eligibility is based on clear, published criteria — the old-age pension, for example, is for every resident aged 65 and over. The eligibility check explains each result, and it never signs you up for anything.' },
  { icon: <VerifiedUserRoundedIcon />, title: 'Apply once, and reuse your details', body: 'Your oneCitizen profile fills in the form, and records government has already verified are reused, so you do not submit the same document twice. AskGov can draft the rest — you check it and confirm.' },
  { icon: <GavelRoundedIcon />, title: 'A person makes the decision', body: 'Automatic checks prepare your application, but every decision, payment and suspension is made by an accountable government officer. You see the status and the reason under Tracking.' },
  { icon: <PaymentsRoundedIcon />, title: 'Get paid the way you choose', body: 'Approved benefits go to your bank account, to Mobile Money (MMG), or you can collect them at a post office. Regular benefits follow a payment calendar, and we remind you.' },
];

export default function HowBenefitsWorkPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <PageHeader
        title="How Benefits Work"
        subtitle="From checking eligibility to getting paid — what to expect at each step."
        crumbs={[{ label: 'Help & Support' }, { label: 'How benefits work' }]}
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack divider={<Divider flexItem />} spacing={0}>
            {STEPS.map((s, i) => (
              <Stack key={s.title} direction="row" spacing={2} alignItems="flex-start" sx={{ py: 2.5 }}>
                <Box sx={{ position: 'relative', flexShrink: 0 }}>
                  <Box aria-hidden sx={{ width: 46, height: 46, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.subtle', color: 'primary.onSubtle' }}>
                    {s.icon}
                  </Box>
                  <Box aria-hidden sx={{
                    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                    bgcolor: 'primary.main', color: 'common.white', display: 'grid', placeItems: 'center',
                    fontSize: '0.75rem', fontWeight: 700, border: 2, borderColor: 'background.paper',
                  }}>
                    {i + 1}
                  </Box>
                </Box>
                <Box>
                  <Typography component="h2" sx={{ fontWeight: 700 }}>
                    <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      Step {i + 1}:{' '}
                    </Box>
                    {s.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>{s.body}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ background: (t) => t.gradients.accentSubtle, borderColor: 'primary.subtle' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>Ready to see what you qualify for?</Typography>
              <Typography variant="body2" color="text.secondary">It takes under a minute and won’t affect any current benefit.</Typography>
            </Box>
            <Button variant="contained" sx={{ flexShrink: 0 }} onClick={() => navigate('/eligibility')}>Check my eligibility</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
