import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Stack, Button, MenuItem, TextField, Chip, Divider, Alert, AlertTitle,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { api } from '../../lib/api.js';
import { PageHeader, SectionCard, EmptyState } from '../../components/ui.jsx';

const get = (url) => api.get(url).then((r) => r.data);

/**
 * Age from date of birth.
 *
 * This used to read `const now = new Date('2026-07-16T00:00:00')` — a hardcoded
 * "today". Every age was computed as if it were 16 July 2026, so the result went
 * stale the day after it was written and drifted further every day. Because age
 * gates the 65+ pension result, that silently produced wrong eligibility answers.
 * It now uses the real current date.
 */
const ageFrom = (dob) => {
  if (!dob) return null;
  const b = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a -= 1;
  return a;
};

// Transparent, public-criteria rules. Never auto-enrols — each result deep-links to apply.
// The rules themselves are unchanged.
function evaluate({ age, employment, income, circumstances, children }) {
  const out = [];
  if (age != null && age >= 65) {
    out.push({ id: 'old-age-pension', name: 'Old-Age Pension', level: 'qualify', why: `You are ${age}. Residents aged 65 and over qualify for the old-age pension.` });
  }
  if (income === 'Under $60,000' || circumstances.includes('Illness or disability') || circumstances.includes('Unable to work')) {
    out.push({ id: 'public-assistance', name: 'Public Assistance', level: 'maybe', why: 'Your circumstances — a low income and/or being unable to work — may qualify you. A case officer reviews this before any decision.' });
  }
  if (circumstances.includes('Single parent') || children === 'Yes') {
    out.push({ id: 'cash-grant', name: 'Cash Grant / School Support', level: 'maybe', why: 'Households with school-age children, and single parents, may qualify for an active cash-grant programme.' });
  }
  if ((employment === 'Employed' || employment === 'Self-employed') && age != null && age < 65) {
    out.push({ id: 'tin-register', name: 'TIN Registration', level: 'info', why: 'Working residents need a Taxpayer Identification Number for employment, business and many other services.' });
  }
  return out;
}

const CHIP = {
  qualify: { color: 'success', label: 'You qualify' },
  maybe: { color: 'warning', label: 'You may qualify' },
  info: { color: 'info', label: 'Worth doing' },
};

const CIRCUMSTANCES = ['Illness or disability', 'Unable to work', 'Single parent', 'Caring for a relative'];

export default function EligibilityPage() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['me'], queryFn: () => get('/me') });
  const profileAge = ageFrom(me.data?.profile?.dob);

  const [employment, setEmployment] = useState('');
  const [income, setIncome] = useState('');
  const [children, setChildren] = useState('');
  const [circumstances, setCircumstances] = useState([]);
  const [checked, setChecked] = useState(false);
  const resultsRef = useRef(null);

  const toggle = (c) => setCircumstances((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const results = useMemo(
    () => (checked ? evaluate({ age: profileAge, employment, income, circumstances, children }) : []),
    [checked, profileAge, employment, income, circumstances, children],
  );
  const canCheck = employment && income && children;

  // Move the citizen to the results. They render below the fold, so pressing
  // "Check eligibility" previously looked like nothing had happened at all —
  // especially on a phone, where the answer was a full screen further down.
  useEffect(() => {
    if (!checked) return;
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultsRef.current?.focus?.();
  }, [checked]);

  const reset = () => setChecked(false);

  return (
    <Box sx={{ width: '100%' }}>
      <PageHeader
        title="Check what you can get"
        subtitle="Answer three questions and we will show you the programmes you may qualify for. This changes nothing about any benefit you already receive."
        crumbs={[{ label: 'Help & Support' }, { label: 'Eligibility' }]}
      />

      <SectionCard title="About you" sx={{ mb: 2.5 }}>
        {profileAge != null && (
          <Alert severity="info" sx={{ mb: 2.5 }}>
            We are using your age ({profileAge}) from your profile. Your answers below are private to you.
          </Alert>
        )}

        <Stack spacing={2.5}>
          <TextField select label="Are you working?" value={employment} required fullWidth
            helperText="Choose the option closest to your situation"
            onChange={(e) => { setEmployment(e.target.value); reset(); }}>
            {['Employed', 'Self-employed', 'Unemployed', 'Unable to work', 'Retired'].map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </TextField>

          <TextField select label="Roughly, what does your household earn each month?" value={income} required fullWidth
            helperText="In Guyanese dollars. An estimate is fine."
            onChange={(e) => { setIncome(e.target.value); reset(); }}>
            {['Under $60,000', '$60,000 – $150,000', 'Over $150,000'].map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </TextField>

          <TextField select label="Are there school-age children in your household?" value={children} required fullWidth
            onChange={(e) => { setChildren(e.target.value); reset(); }}>
            {['Yes', 'No'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>

          <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
            <Typography component="legend" variant="body2" sx={{ fontWeight: 600, mb: 1, p: 0 }}>
              Does any of this apply to you? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>(optional)</Box>
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {CIRCUMSTANCES.map((c) => {
                const on = circumstances.includes(c);
                return (
                  <Chip
                    key={c}
                    label={c}
                    clickable
                    aria-pressed={on}
                    color={on ? 'primary' : 'default'}
                    variant={on ? 'filled' : 'outlined'}
                    onClick={() => { toggle(c); reset(); }}
                    sx={{ height: 40, px: 0.5 }}
                  />
                );
              })}
            </Stack>
          </Box>

          <Box>
            <Button variant="contained" size="large" disabled={!canCheck} onClick={() => setChecked(true)}>
              Show what I can get
            </Button>
            {!canCheck && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Answer the three questions above to continue.
              </Typography>
            )}
          </Box>
        </Stack>
      </SectionCard>

      {checked && (
        // tabIndex -1 so focus can be moved here programmatically without adding a
        // tab stop for everyone else.
        <Box ref={resultsRef} tabIndex={-1} sx={{ outline: 'none' }}>
          <SectionCard title="What you may be able to get">
            <Box aria-live="polite">
              {results.length === 0 ? (
                <EmptyState
                  dense
                  icon={<SearchOffRoundedIcon />}
                  title="No clear match from your answers"
                  hint="That does not mean you are not entitled to anything — criteria change, and some programmes are not covered by this check. AskGov can look at your situation in more detail."
                  action={<Button variant="outlined" onClick={() => navigate('/agencies')}>Browse all services</Button>}
                />
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {results.map((r) => (
                    <Stack key={r.id} direction={{ xs: 'column', sm: 'row' }} spacing={2}
                      alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ py: 2.5 }}>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
                        <Box aria-hidden sx={{ color: `${CHIP[r.level].color}.main`, mt: 0.25, display: 'flex', flexShrink: 0 }}>
                          {r.level === 'qualify' ? <CheckCircleRoundedIcon /> : <HelpOutlineRoundedIcon />}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                            <Typography component="h3" sx={{ fontWeight: 700 }}>{r.name}</Typography>
                            <Chip size="small" color={CHIP[r.level].color} label={CHIP[r.level].label} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{r.why}</Typography>
                        </Box>
                      </Stack>
                      <Button variant="contained" sx={{ flexShrink: 0 }} onClick={() => navigate(`/services/${r.id}`)}>
                        Read more
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>

            <Alert severity="info" sx={{ mt: 2.5 }}>
              <AlertTitle sx={{ fontWeight: 700 }}>This is guidance, not a decision</AlertTitle>
              It is based on published criteria. A government officer makes every final decision,
              and nothing here signs you up for anything.
            </Alert>
          </SectionCard>
        </Box>
      )}
    </Box>
  );
}
