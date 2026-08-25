import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Accordion, AccordionSummary, AccordionDetails,
  TextField, InputAdornment, Stack, Button,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { PageHeader, SectionHeader, EmptyState } from '../../components/ui.jsx';
import { FAQ_GROUPS } from './helpData.js';
import { useUiStore } from '../../stores/uiStore.js';

export default function FaqsPage() {
  const navigate = useNavigate();
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  const groups = useMemo(() => {
    if (!term) return FAQ_GROUPS;
    return FAQ_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => it.q.toLowerCase().includes(term) || it.a.toLowerCase().includes(term)),
    })).filter((g) => g.items.length);
  }, [term]);
  const matchCount = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);

  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <PageHeader
        title="Frequently Asked Questions"
        subtitle="Quick answers about services, payments, appointments and your account."
        crumbs={[{ label: 'Help & Support' }, { label: 'FAQs' }]}
      />

      <TextField
        fullWidth
        type="search"
        label="Search the questions"
        placeholder="For example: passport fees"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 1.5 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon color="action" /></InputAdornment> }}
      />

      {/* Result count. Searching previously gave no feedback on how much had matched,
          so it was unclear whether a short list meant "few answers" or "bad search". */}
      {term && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }} aria-live="polite">
          {matchCount === 0
            ? `No answers match “${q}”`
            : `${matchCount} answer${matchCount === 1 ? '' : 's'} match “${q}”`}
        </Typography>
      )}

      {groups.length === 0 ? (
        <Card>
          <Box sx={{ p: 2 }}>
            <EmptyState
              icon={<SearchRoundedIcon />}
              title={`Nothing matches “${q}”`}
              hint="Try a different word, or ask AskGov — it can answer in your own words and look things up for you."
              action={
                <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => setAssistantOpen(true)}>
                  Ask AskGov
                </Button>
              }
            />
          </Box>
        </Card>
      ) : (
        <Stack spacing={3}>
          {groups.map((g) => (
            <Box component="section" key={g.category}>
              <SectionHeader title={g.category} level="h2" />
              <Stack spacing={1}>
                {g.items.map((it, i) => (
                  <Accordion key={i} disableGutters elevation={0} sx={{ overflow: 'hidden' }}>
                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                      <Typography sx={{ fontWeight: 600 }}>{it.q}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body1" color="text.secondary">{it.a}</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <Card sx={{ mt: 3, background: (t) => t.gradients.accentSubtle, borderColor: 'primary.subtle' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>Still need help?</Typography>
              <Typography variant="body2" color="text.secondary">Ask AskGov, or contact a government officer directly.</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => setAssistantOpen(true)}>Ask AskGov</Button>
              <Button variant="outlined" onClick={() => navigate('/help/contact')}>Contact support</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
