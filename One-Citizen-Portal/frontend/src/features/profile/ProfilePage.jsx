import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Grid, Card, CardContent, Typography, Stack, TextField, Button, Avatar, Divider, Chip, Alert,
} from '@mui/material';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { api, apiError } from '../../lib/api.js';
import { toast } from '../../stores/toastStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import {
  ErrorState, PageHeader, DataRow, SectionCard, FormSkeleton,
} from '../../components/ui.jsx';
import { userToForm } from '../auth/userFields.js';
import ProfileFields from '../auth/ProfileFields.jsx';

const getUser = () => api.get('/me').then((r) => r.data);
const initials = (name, email) => {
  const src = name || email || 'U';
  return (src.includes('@') ? src[0] : src.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('')).toUpperCase();
};

export default function ProfilePage() {
  const qc = useQueryClient();
  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // Seed from Zustand for an instant render, then keep fresh from the users table via /me.
  const me = useQuery({ queryKey: ['me'], queryFn: getUser, initialData: storeUser || undefined });
  const [form, setForm] = useState(() => userToForm(storeUser));
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (me.data) { setForm(userToForm(me.data)); setDirty(false); } }, [me.data]);

  // Warn before the browser discards unsaved edits. The page previously let a
  // citizen fill in their details, navigate away, and lose everything silently —
  // costly on a long form, and worse on a phone where a back gesture is easy to
  // trigger by accident.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => api.patch('/me', form).then((r) => r.data), // updateUser → users table
    onSuccess: (updated) => {
      setUser(updated);                 // latest details → Zustand (name updates in nav live)
      qc.setQueryData(['me'], updated); // and the query cache
      setDirty(false);
      toast.success('Your details have been saved.');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (me.isLoading && !me.data) {
    return (
      <>
        <PageHeader title="Your details" />
        <FormSkeleton fields={8} />
      </>
    );
  }
  if (me.error && !me.data) return <ErrorState error={me.error} title="We could not load your details" onRetry={me.refetch} />;

  const user = me.data || {};
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setDirty(true); };
  const discard = () => { setForm(userToForm(me.data)); setDirty(false); };

  return (
    <Box sx={{ width: '100%' }}>
      <PageHeader
        title="Your details"
        subtitle="Keeping these up to date means your applications are filled in correctly from the start."
        crumbs={[{ label: 'Account' }, { label: 'Your details' }]}
      />

      <Grid container spacing={2.5} alignItems="flex-start">
        {/* Account summary (read-only) */}
        <Grid item xs={12} md={4}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ textAlign: 'center', p: { xs: 2, sm: 3 } }}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', bgcolor: 'primary.main', fontSize: '1.75rem', fontWeight: 700 }}>
                {initials(user.name, user.email)}
              </Avatar>
              <Typography variant="h6" component="h2" sx={{ mt: 1.5 }}>{user.name || '—'}</Typography>
              <Chip
                size="small"
                icon={<VerifiedRoundedIcon sx={{ fontSize: 15 }} />}
                label={user.role || 'citizen'}
                sx={{ mt: 1, textTransform: 'capitalize', bgcolor: 'success.subtle', color: 'success.text' }}
              />
              <Divider sx={{ my: 2.5 }} />
              <Stack component="dl" spacing={0} sx={{ textAlign: 'left', m: 0 }} divider={<Divider flexItem />}>
                <DataRow label="Email" value={user.email} />
                <DataRow label="Phone" value={user.profile?.phone} />
                <DataRow label="With us since" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5 }}>
                Your email is how you sign in, so it cannot be changed here. Contact support if it needs to change.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Editable details — the same field set collected at registration */}
        <Grid item xs={12} md={8}>
          <SectionCard title="Your sign-in details">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Full name" value={form.name ?? ''} onChange={set('name')} fullWidth
                  helperText="As it appears on your national ID" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Email address" value={user.email ?? ''} fullWidth disabled
                  helperText="This is how you sign in" />
              </Grid>
            </Grid>

            <Box sx={{ mt: 1 }}>
              <ProfileFields form={form} onChange={set} />
            </Box>

            {dirty && (
              <Alert severity="warning" sx={{ mt: 3 }}>
                You have changes that are not saved yet.
              </Alert>
            )}

            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" spacing={1.5} sx={{ mt: 3 }}>
              <Button variant="outlined" color="inherit" startIcon={<UndoRoundedIcon />}
                disabled={!dirty || save.isPending} onClick={discard}>
                Discard changes
              </Button>
              <Button variant="contained" size="large" startIcon={<SaveRoundedIcon />}
                disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
                {save.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
