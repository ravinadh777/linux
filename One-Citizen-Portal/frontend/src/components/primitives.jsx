import { Box, Card, CardContent, Stack, Typography, Button, LinearProgress, ButtonBase } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { statusColor, statusLabel } from '../theme/theme.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives that replace per-screen one-offs. Before this file the app
// contained six separate local copies of a "section header with an optional
// right-aligned action", and four separate local label/value row components
// (`Row` in AppointmentBookingPage, `RowRO` in ProfilePage, `PensionStat` in
// DashboardPage, plus inline pairs in TrackingDetailPage) — each with slightly
// different spacing, weight and alignment.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status pill. Carries state as a DOT plus a WORD, never colour alone — that is
 * what keeps status legible for colour-blind citizens, and it is why this is a
 * component rather than a styled Chip.
 */
export function StatusChip({ status, size = 'small' }) {
  const tone = statusColor(status);           // 'success' | 'warning' | 'error' | 'info' | 'default'
  const isDefault = tone === 'default';
  const small = size === 'small';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0,
        px: small ? 1.25 : 1.5, py: small ? 0.5 : 0.75, borderRadius: 999,
        fontSize: small ? '0.8125rem' : '0.875rem', fontWeight: 600, lineHeight: 1.4,
        bgcolor: isDefault ? 'action.hover' : `${tone}.subtle`,
        color: isDefault ? 'text.secondary' : `${tone}.text`,
      }}
    >
      <Box
        aria-hidden
        component="span"
        sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: isDefault ? 'text.disabled' : `${tone}.main` }}
      />
      {statusLabel(status)}
    </Box>
  );
}

/**
 * Label / value row. One component, one alignment, used everywhere a record is
 * displayed read-only.
 */
export function DataRow({ label, value, strong = false, stack = false }) {
  const shown = value === '' || value === undefined || value === null ? '—' : value;
  if (stack) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" component="dt" sx={{ display: 'block' }}>{label}</Typography>
        <Typography component="dd" sx={{ m: 0, fontWeight: strong ? 700 : 600, wordBreak: 'break-word' }}>{shown}</Typography>
      </Box>
    );
  }
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2} sx={{ py: 0.75 }}>
      {/* The label may shrink but not below its words; the value takes the slack and
          breaks. Without `minWidth: 0` a long value (reference numbers, addresses) could
          not shrink and pushed its container sideways. */}
      <Typography variant="body2" color="text.secondary" component="dt" sx={{ minWidth: 0 }}>{label}</Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, minWidth: 0, fontWeight: strong ? 700 : 600, textAlign: 'right', wordBreak: 'break-word' }}>
        {shown}
      </Typography>
    </Stack>
  );
}

/**
 * Section header. `title` renders as a real heading element so the page keeps a
 * valid outline for screen readers — the six local copies this replaces used a
 * styled Typography with no semantic level.
 */
export function SectionHeader({ title, actionLabel, onAction, action, level = 'h2', id }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
      <Typography id={id} variant="h6" component={level} sx={{ color: 'primary.onSubtle' }}>
        {title}
      </Typography>
      {action || (actionLabel && (
        <Button size="small" onClick={onAction} sx={{ flexShrink: 0 }}>{actionLabel}</Button>
      ))}
    </Stack>
  );
}

/** A card with a section header — the most common panel shape in the app. */
export function SectionCard({ title, actionLabel, onAction, action, icon, children, sx, fullHeight = false, id }) {
  return (
    <Card sx={{ ...(fullHeight && { height: '100%' }), ...sx }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {(title || action || actionLabel) && (
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {icon && <Box aria-hidden sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>}
              <Typography id={id} variant="h6" component="h2" sx={{ color: 'primary.onSubtle' }}>{title}</Typography>
            </Stack>
            {action || (actionLabel && <Button size="small" onClick={onAction} sx={{ flexShrink: 0 }}>{actionLabel}</Button>)}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Multi-step progress. Reports a truthful percentage and names what is
 * outstanding rather than only counting it.
 *
 * The apply form previously computed `activeStep / totalSteps`, so on a 3-section
 * form the citizen sat on the final "Review & submit" step looking at 75% — the
 * bar could never reach 100%. `current` here is 1-based and inclusive, so the
 * last step reads 100%.
 */
export function StepProgress({ current, total, label, outstanding = [] }) {
  const pct = total > 0 ? Math.round((Math.min(current, total) / total) * 100) : 0;
  const done = pct >= 100;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label || (done ? 'Last step' : `Step ${Math.min(current, total)} of ${total}`)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        aria-label={`Progress: ${pct}% complete`}
        sx={{ '& .MuiLinearProgress-bar': { bgcolor: done ? 'success.main' : 'primary.main', borderRadius: 999 } }}
      />
      {outstanding.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {outstanding.map((item) => (
            <Stack key={item} direction="row" spacing={0.75} alignItems="center"
              sx={{ px: 1.25, py: 0.75, borderRadius: 1.5, bgcolor: 'warning.subtle', color: 'warning.text' }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>Still needed — {item}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** A checklist row used by the apply side-rail to jump between sections. */
export function StepLink({ title, state = 'todo', onClick }) {
  const colour = state === 'done' ? 'success.main' : state === 'current' ? 'primary.main' : 'text.disabled';
  return (
    <ButtonBase
      onClick={onClick}
      aria-current={state === 'current' ? 'step' : undefined}
      sx={{
        width: '100%', justifyContent: 'flex-start', gap: 1, px: 1, py: 1, borderRadius: 1.5,
        minHeight: 44, textAlign: 'left',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box aria-hidden sx={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
        border: 2, borderColor: colour, color: 'common.white',
        bgcolor: state === 'done' ? 'success.main' : 'transparent',
      }}>
        {state === 'done' && <CheckRoundedIcon sx={{ fontSize: 14 }} />}
      </Box>
      <Typography variant="body2" sx={{
        fontWeight: state === 'current' ? 700 : 500,
        color: state === 'todo' ? 'text.secondary' : 'text.primary',
      }}>
        {title}
      </Typography>
    </ButtonBase>
  );
}

/** Screen-reader-only text. Used for live announcements and extra link context. */
export function VisuallyHidden({ children, ...props }) {
  return (
    <Box
      component="span"
      {...props}
      sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
    >
      {children}
    </Box>
  );
}
