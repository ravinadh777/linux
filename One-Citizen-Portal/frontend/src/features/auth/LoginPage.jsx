import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Stack, InputAdornment, IconButton, Link, Alert,
} from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import { api, apiError,MuleSoftApi } from '../../lib/api.js';
import { toast } from '../../stores/toastStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import AuthScaffold from './AuthScaffold.jsx';

// The POST /auth/login call, the 404 → register funnel and the post-login redirect
// are all unchanged. What changed is how failure is communicated.

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState(location.state?.identifier || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  // Errors are held in state and rendered inline. They used to be raised only as a
  // toast that auto-dismissed after 3.5s — long enough to miss, and gone before a
  // citizen reading slowly could act on it. Field-level errors also mark the input.
  const [formError, setFormError] = useState('');
  const [touched, setTouched] = useState({ identifier: false, password: false });

  const identifierError = touched.identifier && !identifier.trim() ? 'Enter the email address you signed up with.'
    : touched.identifier && !/^\S+@\S+\.\S+$/.test(identifier.trim()) ? 'That does not look like an email address.'
    : '';
  const pwError = touched.password && !password ? 'Enter your password.' : '';

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ identifier: true, password: true });
    setFormError('');
    if (!identifier.trim() || !password) return;

    setLoading(true);
    try {
      const { data } = await MuleSoftApi.post('/login', { identifier, password });
      // A 2xx with no credential is not a sign-in. Without this guard the store would
      // hold a null token, RequireAuth would bounce the citizen back here, and the
      // only visible evidence would be a "Welcome back" toast on the login page.
      if (!data?.token && !data?.accessToken) {
        throw new Error('Sign-in did not return a session token. Please try again or contact support.');
      }
      setSession(data);
      // ── Return the citizen to what they were doing ───────────────────────────
      // Two sources, in priority order:
      //   1. `returnTo` persisted by an EXPIRED session (survives a full reload, so
      //      it works even when the tab was closed and reopened).
      //   2. router state `from`, set by RequireAuth on a normal redirect.
      // `takeReturnTo` is one-shot, so a later voluntary sign-in is never hijacked
      // into a stale form.
      const expiredReturnTo = useAuthStore.getState().takeReturnTo();
      const from = location.state?.from;
      const target = expiredReturnTo
        || (from ? `${from.pathname || ''}${from.search || ''}` : '')
        || '/dashboard';
      const resuming = !!expiredReturnTo && expiredReturnTo.includes('/apply');
      toast.success(resuming
        ? 'Signed back in — picking up where you left off.'
        : `Welcome back${data.user?.name ? ', ' + data.user.name.split(' ')[0] : ''}!`);
      navigate(target, { replace: true });
    } catch (err) {
      // No account for this email → funnel the visitor straight into registration.
      if (err.response?.status === 404) {
        toast.info('No account found for that email — let’s create one.');
        // `email` is the key RegisterPage reads; the value is this page's `identifier`
        // state. A bare `email` here was a ReferenceError thrown inside this catch
        // block, so the funnel never ran and the visitor saw nothing at all.
        navigate('/register', { state: { email: identifier } });
        return;
      }
      // 401 gets specific, actionable copy instead of the raw API message.
      setFormError(
        err.response?.status === 401
          ? 'That email and password do not match. Check them and try again.'
          : apiError(err),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      heading="The single front door to government."
      blurb="One account, one document vault, and one place to apply for and track every government service in Guyana."
    >
      <Typography variant="h4" component="h1">Sign in</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, mb: 3.5 }}>
        Use the email and password you created your oneCitizen account with.
      </Typography>

      {formError && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setFormError('')}>
          {formError}
        </Alert>
      )}

      <Box component="form" onSubmit={submit} noValidate>
        <Stack spacing={2.5}>
          <TextField
            label="Email address"
            placeholder='Enter your email address'
            type="email"
            autoComplete="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, identifier: true }))}
            error={!!identifierError}
            helperText={identifierError}
            fullWidth
            required
            InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon color="action" /></InputAdornment> }}
          />

          <TextField
            label="Password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder='Enter your password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={!!pwError}
            helperText={pwError}
            fullWidth
            required
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockRoundedIcon color="action" /></InputAdornment>,
              // One control for showing the password, not two. There used to be both
              // this toggle and a separate "Show password" checkbox below, wired to
              // the same state.
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showPw}
                  >
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ textAlign: 'right' }}>
            {/* Was href="#" — a dead link on the one page where being locked out
                matters most. There is no password-reset endpoint yet, so this now
                routes to the help desk, which can actually resolve it. */}
            <Link component="button" type="button" onClick={() => navigate('/help/contact')} variant="body2">
              Forgotten your password?
            </Link>
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={loading}
            startIcon={<LoginRoundedIcon />}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <Typography variant="body2" align="center" color="text.secondary">
            First time here?{' '}
            <Link component="button" type="button" onClick={() => navigate('/register')}>
              Create an account
            </Link>
          </Typography>
        </Stack>
      </Box>
    </AuthScaffold>
  );
}
