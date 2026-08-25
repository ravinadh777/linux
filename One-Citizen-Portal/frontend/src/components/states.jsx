import { Box, Card, CardContent, Stack, Typography, Skeleton, Alert, AlertTitle, Button, Grid } from '@mui/material';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { apiError } from '../lib/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Loading · empty · error · success — the four states every data view needs.
//
// Before this file, only ONE of 22 screens (TrackingDetailPage) used skeletons;
// everything else showed a centred spinner, and several screens showed nothing
// at all when a list came back empty — the agencies grid, the services grid, and
// the dashboard's Deadlines / Notifications / Appointments cards each rendered a
// card with a header and a void beneath it. On the variable connections this
// portal is actually used over, a citizen could not tell whether a panel was
// loading, empty, or broken.
//
// Skeletons over spinners on purpose: a skeleton communicates the SHAPE of what
// is arriving, so the page does not jump when it lands.
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton matching a titled card with an icon, two text lines and a body. */
export function CardSkeleton({ lines = 2, showMedia = false }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {showMedia && <Skeleton variant="rounded" width={44} height={44} sx={{ flexShrink: 0 }} />}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="62%" height={22} />
            <Skeleton variant="text" width="38%" height={16} />
          </Box>
        </Stack>
        <Box sx={{ mt: 2 }}>
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} variant="text" height={16} width={i === lines - 1 ? '72%' : '100%'} />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

/** Skeleton for a vertical list of rows (deadlines, notifications, documents). */
export function ListSkeleton({ rows = 3, avatar = true }) {
  return (
    <Stack spacing={2} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Stack key={i} direction="row" spacing={1.5} alignItems="center">
          {avatar && <Skeleton variant="circular" width={38} height={38} sx={{ flexShrink: 0 }} />}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Skeleton variant="text" width={`${70 - i * 8}%`} height={19} />
            <Skeleton variant="text" width={`${45 - i * 5}%`} height={15} />
          </Box>
          <Skeleton variant="rounded" width={64} height={30} sx={{ flexShrink: 0 }} />
        </Stack>
      ))}
    </Stack>
  );
}

/** Skeleton for a responsive card grid (agencies, services, tracking, centres). */
export function GridSkeleton({ count = 6, xs = 12, sm = 6, md = 4, lg = 3, showMedia = true }) {
  return (
    <Grid container spacing={2} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Grid item xs={xs} sm={sm} md={md} lg={lg} key={i}>
          <CardSkeleton showMedia={showMedia} lines={2} />
        </Grid>
      ))}
    </Grid>
  );
}

/** Skeleton for a form section — label/field pairs in two columns. */
export function FormSkeleton({ fields = 6 }) {
  return (
    <Grid container spacing={2} aria-hidden>
      {Array.from({ length: fields }).map((_, i) => (
        <Grid item xs={12} sm={6} key={i}>
          <Skeleton variant="text" width="36%" height={16} />
          <Skeleton variant="rounded" height={48} />
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Loading state. Defaults to a skeleton; `variant="spinner"` remains available
 * for the few places with no predictable shape to mimic.
 *
 * `label` is announced to assistive tech via an aria-live region, so a screen
 * reader user is told the page is working rather than met with silence.
 */
export function Loading({ variant = 'card', label = 'Loading…', rows, count, ...rest }) {
  const skeleton = {
    card: <CardSkeleton {...rest} />,
    list: <ListSkeleton rows={rows} {...rest} />,
    grid: <GridSkeleton count={count} {...rest} />,
    form: <FormSkeleton fields={count} {...rest} />,
  }[variant];

  return (
    <Box role="status" aria-live="polite" aria-busy="true">
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {label}
      </Box>
      {skeleton || <CardSkeleton />}
    </Box>
  );
}

/**
 * Empty state. Never a bare void: always says what belongs here, why it is
 * empty, and what to do next.
 */
export function EmptyState({
  title = 'Nothing here yet',
  hint,
  action,
  icon = <InboxRoundedIcon />,
  dense = false,
}) {
  return (
    <Box sx={{ textAlign: 'center', px: 2, py: dense ? 3 : 5 }}>
      <Box
        aria-hidden
        sx={{
          width: 52, height: 52, mx: 'auto', mb: 1.75, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          bgcolor: 'primary.subtle', color: 'primary.onSubtle',
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', mb: action ? 2.5 : 0 }}>
          {hint}
        </Typography>
      )}
      {action}
    </Box>
  );
}

/**
 * Error state. Says what failed, what to do, and reassures that nothing was
 * lost — then offers the retry. `onRetry` renders the action when supplied.
 */
export function ErrorState({ error, title = 'We could not load this', onRetry, reassure = true }) {
  return (
    <Alert
      severity="error"
      icon={<ErrorOutlineRoundedIcon />}
      sx={{ my: 2 }}
      action={onRetry ? (
        <Button color="inherit" size="small" startIcon={<ReplayRoundedIcon />} onClick={onRetry}>
          Try again
        </Button>
      ) : undefined}
    >
      <AlertTitle sx={{ fontWeight: 700, mb: 0.25 }}>{title}</AlertTitle>
      {apiError(error)}
      {reassure && (
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
          Check your connection and try again. Nothing you have saved has been lost.
        </Typography>
      )}
    </Alert>
  );
}

/** Success confirmation, used after a submit or save. */
export function SuccessState({ title, children }) {
  return (
    <Alert severity="success" icon={<CheckCircleRoundedIcon />} sx={{ my: 2 }}>
      {title && <AlertTitle sx={{ fontWeight: 700, mb: 0.25 }}>{title}</AlertTitle>}
      {children}
    </Alert>
  );
}

/**
 * One helper that resolves the whole loading → error → empty → content sequence,
 * so no screen has to re-implement the ordering (and no screen can forget the
 * empty case, which is how the blank panels happened).
 */
export function DataView({
  isLoading, error, isEmpty, onRetry,
  loadingVariant = 'card', loadingProps, empty, children,
}) {
  if (isLoading) return <Loading variant={loadingVariant} {...loadingProps} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return empty || <EmptyState />;
  return children;
}
