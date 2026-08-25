import { useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, InputAdornment, IconButton, Link, Grid, Alert,
  LinearProgress, MenuItem, Stack,
} from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { api, apiError, MuleSoftApi } from '../../lib/api.js';
import { toast } from '../../stores/toastStore.js';
import {
  USER_PROFILE_FIELDS, emptyProfile, validateProfileFields, profileCompleteness,
} from './userFields.js';
import AuthScaffold from './AuthScaffold.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Registration.
//
// The POST /auth/register payload, the `confirm` field being stripped client-side,
// and the 409 → login funnel are all UNCHANGED. What changed is everything around
// them.
//
// ── WHY THIS IS A WIZARD NOW ─────────────────────────────────────────────────
// The profile is the thing that makes the portal's central promise work: tell us
// once, and every application afterwards is pre-filled. That only holds if the data
// is actually captured — and the previous form asked for 18 profile fields while
// enforcing NONE of them, so a citizen could complete registration with an entirely
// empty profile and every application would still start blank.
//
// The field set is now ~45 (the union of what the 13 application forms actually
// use). Putting 45 enforced fields in front of a public service is how you get
// abandonment, so the flow splits:
//
//   Steps 1–3  REQUIRED  sign-in, identity, contact & address
//              — the fields every application needs. Enforced.
//   Steps 4–5  OPTIONAL  employment & payment, family & emergency & description
//              — genuinely skippable, clearly labelled, one click to bypass.
//
// The account is usable the moment step 3 passes. Completeness is then surfaced as a
// percentage with a prompt to finish later, which is the honest way to ask for the
// rest: visible, motivating, and never blocking.
//
// ── VALIDATION MODEL ─────────────────────────────────────────────────────────
// Rules live in userFields.js as plain functions, so the SAME rule runs here and on
// the profile page. Errors are per-field and inline; a failed "Continue" moves focus
// to the first offending input and announces the count, because on a long form the
// citizen otherwise has to hunt for what is wrong.
// ─────────────────────────────────────────────────────────────────────────────

/** Plain-language password strength. Deliberately advisory, never blocking. */
function strengthOf(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length < 8) return { pct: 15, label: 'Too short', tone: 'error' };
  if (score <= 2) return { pct: 40, label: 'Weak', tone: 'warning' };
  if (score === 3) return { pct: 65, label: 'Good', tone: 'warning' };
  if (score === 4) return { pct: 85, label: 'Strong', tone: 'success' };
  return { pct: 100, label: 'Very strong', tone: 'success' };
}

const fieldsIn = (...sections) => USER_PROFILE_FIELDS.filter((f) => sections.includes(f.section));

// Steps 1–3 are required; 4–5 are skippable. `optional` drives both the "Skip"
// affordance and the fact that Continue never blocks on them.
const STEPS = [
  { key: 'account', title: 'Your sign-in details', blurb: 'How you will sign in to oneCitizen.' },
  {
    key: 'identity',
    title: 'Who you are',
    blurb: 'These details appear on almost every government form, so we ask once and reuse them.',
    fields: fieldsIn('Identity'),
  },
  {
    key: 'address',
    title: 'How to reach you',
    blurb: 'Where you live and how we tell you an application has moved forward.',
    fields: fieldsIn('Contact & address'),
  },
  {
    key: 'work',
    title: 'Work and payments',
    blurb: 'Used by pension, public assistance and cash grant applications — and to pay you.',
    fields: fieldsIn('Employment & income', 'How you are paid'),
    optional: true,
  },
  {
    key: 'extras',
    title: 'Family and emergency contacts',
    blurb: 'Needed by passport, certificate and licence applications.',
    fields: fieldsIn('Family & parentage', 'Next of kin & emergency', 'Physical description'),
    optional: true,
  },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', email: location.state?.email || '', password: '', confirm: '', ...emptyProfile(),
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState({});   // key → message, for fields already checked
  const [touched, setTouched] = useState({});
  const topRef = useRef(null);

  const set = (k) => (e) => {
    const value = e?.target?.value ?? e;
    setForm((f) => {
      const next = { ...f, [k]: value };
      // Splitting a full name on whitespace is a guess, not a fact — compound
      // surnames ("de Souza", "Van Der Berg") break it. So it is offered only as a
      // PREFILL the citizen can correct on the next step, never as the stored truth.
      if (k === 'name' && !touched.surname && !touched.givenNames) {
        const parts = String(value).trim().split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
          next.surname = parts[parts.length - 1];
          next.givenNames = parts.slice(0, -1).join(' ');
        } else {
          next.givenNames = parts[0] || '';
        }
      }
      return next;
    });
    setFormError('');
    setErrors((prev) => (prev[k] ? { ...prev, [k]: '' } : prev)); // clear as they fix it
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const strength = useMemo(() => strengthOf(form.password), [form.password]);
  const completeness = useMemo(() => profileCompleteness(form), [form]);

  // ── Account-step rules (unchanged from before: name, email, password ≥ 8, match)
  const accountErrors = () => ({
    name: !form.name.trim() ? 'Enter your full name, as it appears on your national ID.' : '',
    email: !form.email.trim() ? 'Enter your email address.'
      : !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? 'That does not look like an email address.' : '',
    password: !form.password ? 'Choose a password.'
      : form.password.length < 8 ? `Your password needs at least 8 characters. It currently has ${form.password.length}.` : '',
    confirm: !form.confirm ? 'Type your password a second time.'
      : form.password !== form.confirm ? 'The two passwords do not match.' : '',
  });

  /** Errors for the current step. Optional steps validate FORMAT but never require. */
  const errorsForStep = (i) => {
    const s = STEPS[i];
    if (s.key === 'account') {
      const e = accountErrors();
      return Object.fromEntries(Object.entries(e).filter(([, v]) => v));
    }
    return validateProfileFields(s.fields.map((f) => f.key), form);
  };

  /** Move focus + scroll to the first field with a problem. */
  const focusFirstError = (errs) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    const el = document.getElementsByName(first)?.[0];
    el?.focus?.();
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  };

  const goNext = () => {
    const errs = errorsForStep(step);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const n = Object.keys(errs).length;
      setFormError(n === 1
        ? 'One field needs your attention before you can continue.'
        : `${n} fields need your attention before you can continue.`);
      focusFirstError(errs);
      return;
    }
    setFormError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    topRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };

  const goBack = () => {
    setFormError('');
    setStep((s) => Math.max(s - 1, 0));
    topRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    // Re-validate every REQUIRED step, not just the current one. A citizen who used
    // the step rail to jump forward could otherwise reach Create account with an
    // earlier step still incomplete.
    for (let i = 0; i < STEPS.length; i += 1) {
      if (STEPS[i].optional) continue;
      const errs = errorsForStep(i);
      if (Object.keys(errs).length) {
        setStep(i);
        setErrors(errs);
        setFormError('Some required details are missing. We have taken you back to them.');
        setTimeout(() => focusFirstError(errs), 0);
        return;
      }
    }
    // Format errors on the OPTIONAL steps still block: a malformed phone number is
    // worse stored than absent, because it will be prefilled into an application.
    const optionalErrs = STEPS.filter((s) => s.optional)
      .reduce((acc, s) => ({ ...acc, ...validateProfileFields(s.fields.map((f) => f.key), form) }), {});
    if (Object.keys(optionalErrs).length) {
      const idx = STEPS.findIndex((s) => s.optional && s.fields.some((f) => optionalErrs[f.key]));
      setStep(idx);
      setErrors(optionalErrs);
      setFormError('Please correct the highlighted details, or clear them to leave them out.');
      setTimeout(() => focusFirstError(optionalErrs), 0);
      return;
    }

    setLoading(true);
    setFormError('');
    try {
      const payload = { ...form };
      delete payload.confirm; // client-only field
      await MuleSoftApi.post('/register', payload); // full field set saved to the users table
      toast.success('Account created — please sign in to continue.');
      navigate('/login', { state: { email: form.email } });
    } catch (err) {
      if (err.response?.status === 409) {
        toast.info('You already have an account — please sign in.');
        navigate('/login', { state: { email: form.email } });
        return;
      }
      setFormError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // ── Field renderer ─────────────────────────────────────────────────────────
  const renderField = (f) => {
    const err = errors[f.key];
    const common = {
      name: f.key,
      fullWidth: true,
      size: 'small',
      label: f.label,
      value: form[f.key] ?? '',
      onChange: set(f.key),
      onBlur: blur(f.key),
      error: !!err,
      // Help text stays visible when there is no error, so guidance is not something
      // you only see by getting it wrong.
      helperText: err || f.help || ' ',
      required: !!f.required,
    };
    if (f.type === 'select') {
      return (
        <TextField {...common} select>
          {/* An explicit empty option, so an optional select can be UNSET again after
              being chosen. Without it the citizen cannot undo a mistaken selection. */}
          {!f.required && <MenuItem value=""><em>Not specified</em></MenuItem>}
          {f.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
      );
    }
    return (
      <TextField
        {...common}
        type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : 'text'}
        multiline={f.type === 'textarea'}
        minRows={f.type === 'textarea' ? 2 : undefined}
        placeholder={f.placeholder}
        InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
        inputProps={{
          inputMode: f.inputMode,
          maxLength: f.maxLength,
          autoComplete: f.autoComplete,
        }}
      />
    );
  };

  return (
    <AuthScaffold
      heading="Create your oneCitizen account."
      blurb="Tell us your details once. Every government service you apply for afterwards is pre-filled from them."
      panelFlex="1 1 42%"
      formFlex="1 1 58%"
      maxWidth={720}
    >
      <div ref={topRef} />
      <Typography variant="h4" component="h1">Create your account</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
        Step {step + 1} of {STEPS.length} · {current.title}
      </Typography>

      {/* ── Progress ────────────────────────────────────────────────────────
          A real progress bar plus a clickable step rail. Going BACK is always
          allowed; going forward runs the same validation as Continue, so the rail
          can never be used to skip a required step. */}
      <Box sx={{ mt: 2, mb: 1 }}>
        <LinearProgress
          variant="determinate"
          value={((step + 1) / STEPS.length) * 100}
          aria-label={`Registration progress: step ${step + 1} of ${STEPS.length}`}
          sx={{ height: 6, borderRadius: 999 }}
        />
      </Box>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
        {STEPS.map((s, i) => {
          const state = i === step ? 'current' : i < step ? 'done' : 'todo';
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => { if (i < step) { setStep(i); setFormError(''); } else if (i > step) goNext(); }}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`oc-btn oc-btn-sm ${state === 'current' ? 'oc-btn-primary' : 'oc-btn-secondary'}
                          ${state === 'todo' ? 'opacity-70' : ''}`}
            >
              {state === 'done' && (
                <svg aria-hidden viewBox="0 0 18 18" width="13" height="13" fill="none"
                  stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9.4l3.2 3.2L14 6" />
                </svg>
              )}
              <span className="hidden sm:inline">{s.title}</span>
              <span className="sm:hidden">{i + 1}</span>
              {s.optional && <span className="text-micro opacity-75">optional</span>}
            </button>
          );
        })}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{current.blurb}</Typography>

      {current.optional && (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          <strong>This step is optional.</strong> Filling it in now means applications that need
          these details are pre-filled later — but you can skip it and add them any time from your
          profile.
        </Alert>
      )}

      {formError && (
        // `role="alert"` so the failure is announced, not just shown. This is the
        // message a screen-reader user relies on to know Continue did nothing.
        <Alert severity="error" role="alert" sx={{ mb: 2.5 }} onClose={() => setFormError('')}>
          {formError}
        </Alert>
      )}

      <Box component="form" onSubmit={(e) => { e.preventDefault(); if (isLast) submit(e); else goNext(); }} noValidate>
        {current.key === 'account' ? (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                name="name" label="Full name" autoComplete="name" required fullWidth
                value={form.name} onChange={set('name')} onBlur={blur('name')}
                error={!!errors.name} helperText={errors.name || 'As it appears on your national ID'}
                InputProps={{ startAdornment: <InputAdornment position="start"><BadgeRoundedIcon color="action" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="email" label="Email address" type="email" autoComplete="email" required fullWidth
                value={form.email} onChange={set('email')} onBlur={blur('email')}
                error={!!errors.email} helperText={errors.email || 'This becomes your sign-in name'}
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon color="action" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                name="password" label="Password" type={showPw ? 'text' : 'password'}
                autoComplete="new-password" required fullWidth
                value={form.password} onChange={set('password')} onBlur={blur('password')}
                error={!!errors.password}
                helperText={errors.password || 'At least 8 characters'}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockRoundedIcon color="action" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}
                        aria-label={showPw ? 'Hide password' : 'Show password'}>
                        {showPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {/* Advisory only — the rule enforced is still "at least 8 characters". */}
              {strength && (
                <Box sx={{ mt: 1 }} aria-live="polite">
                  <LinearProgress
                    variant="determinate" value={strength.pct}
                    sx={{ height: 6, '& .MuiLinearProgress-bar': { bgcolor: `${strength.tone}.main` } }}
                  />
                  <Typography variant="caption" sx={{ color: `${strength.tone}.text`, fontWeight: 600, mt: 0.5, display: 'block' }}>
                    {strength.label}
                  </Typography>
                </Box>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                name="confirm" label="Confirm password" type={showPw ? 'text' : 'password'}
                autoComplete="new-password" required fullWidth
                value={form.confirm} onChange={set('confirm')} onBlur={blur('confirm')}
                error={!!errors.confirm} helperText={errors.confirm || ' '}
                InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon color="action" /></InputAdornment> }}
              />
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={2}>
            {current.fields.map((f) => (
              <Grid item xs={12} sm={f.sm} key={f.key}>{renderField(f)}</Grid>
            ))}
          </Grid>
        )}

        {/* ── Completeness ────────────────────────────────────────────────────
            Shown from the optional steps onward. The number is the argument for
            filling them in — more persuasive than a instruction, and it stays
            honest because nothing here is blocking. */}
        {current.optional && (
          <Box sx={{ mt: 3 }} className="oc-glass-sunken rounded-card p-4">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Profile completeness</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }} className="tabular-nums">
                {completeness.percent}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate" value={completeness.percent}
              aria-label={`Profile ${completeness.percent} percent complete`}
              sx={{ height: 8, borderRadius: 999 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              The more you fill in, the more of each application AskGov can complete for you.
            </Typography>
          </Box>
        )}

        {/* ── Navigation ──────────────────────────────────────────────────────
            Reversed on mobile so the primary action sits at the bottom, under the
            thumb, rather than above the secondary one. */}
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} sx={{ mt: 3.5, alignItems: { sm: 'center' } }}>
          {step > 0 && (
            <Button onClick={goBack} startIcon={<ArrowBackRoundedIcon />} size="large">Back</Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {/* Skip is a real, first-class control on optional steps. Hiding it behind
              "just press Continue with everything blank" makes people fill in fields
              they did not need to. */}
          {current.optional && !isLast && (
            <Button onClick={() => setStep((s) => s + 1)} size="large" color="inherit">Skip this step</Button>
          )}
          {current.optional && isLast && (
            <Button onClick={submit} size="large" color="inherit" disabled={loading}>
              Skip and create account
            </Button>
          )}
          {isLast ? (
            <Button
              type="submit" variant="contained" size="large" disabled={loading}
              startIcon={loading ? null : <HowToRegRoundedIcon />}
            >
              {loading ? 'Creating your account…' : 'Create account'}
            </Button>
          ) : (
            <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />}>
              Continue
            </Button>
          )}
        </Stack>

        {/* Reassurance about what happens next, at the point of commitment. */}
        {isLast && (
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 2 }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main', mt: 0.25 }} aria-hidden />
            <Typography variant="caption" color="text.secondary">
              Everything except your email can be changed later from your profile.
            </Typography>
          </Stack>
        )}

        <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 2.5 }}>
          Already have an account?{' '}
          <Link component="button" type="button" onClick={() => navigate('/login')}>Sign in</Link>
        </Typography>
      </Box>
    </AuthScaffold>
  );
}
