import { useEffect } from 'react';
import { Box, Paper, Typography, IconButton, Grow, Stack } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useToastStore } from '../stores/toastStore.js';

// Semantic tone per toast type. These used to be four hardcoded hex values
// (#16794c, #c62828, #b26a00, #1565c0) which meant the accent stayed fixed in dark
// mode — the success green measured 3.14:1 on the dark paper and failed AA. Reading
// from the palette makes each tone mode-aware.
const VARIANT = {
  success: { tone: 'success', icon: <CheckCircleRoundedIcon /> },
  error: { tone: 'error', icon: <ErrorRoundedIcon /> },
  warning: { tone: 'warning', icon: <WarningRoundedIcon /> },
  info: { tone: 'info', icon: <InfoRoundedIcon /> },
};

// Global toaster: one instance at the app root. Toasts are bottom-centred and dismiss
// instantly (the Grow exit timeout is 0, so nothing lingers). Escape clears them all.
// It never blocks clicks elsewhere (pointer-events).
export default function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  const clear = useToastStore((s) => s.clear);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') clear(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts.length, clear]);

  return (
    <Box
      sx={{
        // Was a bare 2000, which painted the toast OVER an open dropdown (1300).
        // theme.zIndex.snackbar is bound to Z.toast — one rung above overlay, so a
        // toast clears a menu without burying it.
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: (t) => t.zIndex.snackbar,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        pointerEvents: 'none', px: 2, pb: { xs: 3, sm: 4 },
      }}
    >
      <Stack spacing={1.25} sx={{ width: '100%', maxWidth: 460 }}>
        {toasts.map((t) => {
          const v = VARIANT[t.type] || VARIANT.info;
          // `role` alone announces it. The container previously ALSO carried
          // aria-live="polite", so every toast was announced twice by screen readers.
          // Errors interrupt (alert); everything else waits its turn (status).
          const isUrgent = t.type === 'error' || t.type === 'warning';
          return (
            <Grow key={t.id} in appear timeout={{ enter: 160, exit: 0 }}>
              <Paper
                elevation={0}
                role={isUrgent ? 'alert' : 'status'}
                aria-live={isUrgent ? 'assertive' : 'polite'}
                sx={{
                  pointerEvents: 'auto',
                  display: 'flex', alignItems: 'flex-start', gap: 1.25,
                  p: 2, borderRadius: 2.5,
                  border: 1, borderColor: 'divider',
                  borderLeft: '5px solid',
                  borderLeftColor: `${v.tone}.main`,
                  bgcolor: 'background.paper',
                  boxShadow: (th) => th.elevationTokens[4],
                }}
              >
                <Box aria-hidden sx={{ color: `${v.tone}.main`, display: 'flex', mt: '1px', flexShrink: 0 }}>{v.icon}</Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  {t.title && <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>{t.title}</Typography>}
                  <Typography variant="body2" sx={{ color: 'text.primary', wordBreak: 'break-word' }}>{t.message}</Typography>
                </Box>
                <IconButton size="small" onClick={() => remove(t.id)} aria-label="Dismiss" sx={{ mt: '-4px', mr: '-4px', flexShrink: 0 }}>
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Paper>
            </Grow>
          );
        })}
      </Stack>
    </Box>
  );
}
