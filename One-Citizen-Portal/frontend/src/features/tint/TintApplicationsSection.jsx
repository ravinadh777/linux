import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Grid, Card, CardContent, Typography, Box, Stack, Alert, Dialog, MenuItem, TextField,
  CircularProgress,
} from '@mui/material';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { StatusChip, SectionHeader } from '../../components/ui.jsx';
import { Button } from '../../ui/index.js';
import { toast } from '../../stores/toastStore.js';
import {
  useTintApplications, tintStatusForChip, discardTintApplication,
  downloadApprovalLetter, TINT_APPLICATIONS_KEY,
} from './tintSync.jsx';
import { tintError } from './api/tintClient.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tint Waiver applications, on the citizen's tracking page.
//
// This exists because Tint applications live in MOHA, not in the portal's own
// `applications` table — so the portal's tracking query cannot see them. Without this
// section a citizen submits a waiver and it disappears from their view entirely, which
// is the single worst gap the MOHA-only migration opened.
//
// It renders alongside the portal's own applications using the SAME card, chip and
// section-header components, so it reads as one list rather than a bolted-on panel.
//
// ── Every action here is a real endpoint ──────────────────────────────────────
//   Continue  → resume the Draft in the shared ApplyPage (GET /v1/applications/:id)
//   Delete    → DELETE /v1/applications/:id   (Drafts only — MOHA rejects otherwise)
//   Download  → GET /v1/applications/:id/approval-letter.pdf (Approved only,
//               per-vehicle for Organization applications)
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  : null);

/** Per-vehicle chooser for an Organization approval letter. */
function VehiclePicker({ open, count, onClose, onPick, busy }) {
  const [index, setIndex] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <div className="p-5">
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          Which vehicle&apos;s certificate?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
          This application covers {count} vehicles. MOHA issues one certificate per vehicle.
        </Typography>
        <TextField
          select fullWidth size="small" label="Vehicle"
          value={index} onChange={(e) => setIndex(Number(e.target.value))}
        >
          {Array.from({ length: count }, (_, i) => (
            <MenuItem key={i} value={i}>Vehicle {i + 1}</MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onPick(index)} loading={busy} startIcon={<DownloadRoundedIcon />}>
            Download
          </Button>
        </Stack>
      </div>
    </Dialog>
  );
}

/** Confirm before a destructive, irreversible delete. */
function ConfirmDelete({ app, onClose, onConfirm, busy }) {
  return (
    <Dialog open={!!app} onClose={onClose} maxWidth="xs" fullWidth>
      <div className="p-5">
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>Discard this draft?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Your {app?.applicationType} tint waiver draft will be permanently deleted from the
          Ministry of Home Affairs. This cannot be undone, and anything you had filled in will be lost.
        </Typography>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button variant="secondary" onClick={onClose}>Keep it</Button>
          <Button variant="danger" onClick={onConfirm} loading={busy} startIcon={<DeleteOutlineRoundedIcon />}>
            Delete draft
          </Button>
        </Stack>
      </div>
    </Dialog>
  );
}

export default function TintApplicationsSection({ filter = 'all' }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { items, isLoading, unavailable, reason, refetch } = useTintApplications();
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [picking, setPicking] = useState(null);
  const [downloading, setDownloading] = useState(null);

  // Respect the tracking page's active tab so this section filters with the rest of
  // the list rather than ignoring it.
  const shown = items.filter((a) => {
    if (filter === 'drafts') return a.isDraft;
    if (filter === 'open') return !a.isDraft && !a.isApproved;
    if (filter === 'closed') return a.isApproved;
    return true;
  });

  const onDelete = async () => {
    setDeleting(true);
    try {
      await discardTintApplication(confirming.id, confirming.serviceId);
      // Invalidate rather than mutate the cache by hand: the list, the detail view and
      // the dashboard KPI counts all read the same key, so one invalidation refreshes
      // every place the deleted draft was visible.
      await qc.invalidateQueries({ queryKey: TINT_APPLICATIONS_KEY });
      toast.success('Draft deleted.');
      setConfirming(null);
    } catch (err) {
      toast.error(tintError(err));
    } finally {
      setDeleting(false);
    }
  };

  const onDownload = async (app, vehicleIndex) => {
    setDownloading(app.id);
    try {
      await downloadApprovalLetter(app.id, {
        vehicleIndex,
        filename: `tint-waiver-${app.reference || app.id}.pdf`,
      });
      setPicking(null);
    } catch (err) {
      toast.error(tintError(err));
    } finally {
      setDownloading(null);
    }
  };

  // ── Not connected / errored ────────────────────────────────────────────────
  // Deliberately NOT silent. "You have no tint applications" would be a wrong answer
  // that a citizen would act on, when the truth is that we could not ask.
  if (unavailable) {
    return (
      <Box component="section" sx={{ mb: 4 }}>
        <SectionHeader title="Tint waivers" />
        <Alert severity="warning" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>}>
          {reason} Any tint waiver you have applied for is safe with MOHA — it just cannot be
          listed here until the connection works.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box component="section" sx={{ mb: 4 }}>
        <SectionHeader title="Tint waivers" />
        <Card><CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading your tint waivers from the Ministry of Home Affairs…
            </Typography>
          </Stack>
        </CardContent></Card>
      </Box>
    );
  }

  // Nothing to show for this filter — stay silent rather than adding an empty section
  // to a page that already has its own empty state.
  if (!shown.length) return null;

  return (
    <Box component="section" sx={{ mb: 4 }}>
      <SectionHeader title={`Tint waivers (${shown.length})`} />
      <Grid container spacing={2}>
        {shown.map((a) => (
          <Grid item xs={12} sm={6} md={4} key={a.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box aria-hidden sx={{
                    width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center',
                    flexShrink: 0,
                    bgcolor: a.isDraft ? 'warning.subtle' : 'primary.subtle',
                    color: a.isDraft ? 'warning.text' : 'primary.onSubtle',
                  }}>
                    {a.isDraft ? <EditNoteRoundedIcon /> : <DirectionsCarRoundedIcon />}
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{a.serviceName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ministry of Home Affairs
                      {a.vehicleCount > 1 ? ` · ${a.vehicleCount} vehicles` : ''}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                  {/* A Draft has no reference yet — say so rather than invent one. */}
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {a.reference || 'Not yet submitted'}
                  </Typography>
                  <StatusChip status={tintStatusForChip(a.status)} />
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  {a.isDraft
                    ? `Saved ${fmtDate(a.updatedAt) || 'recently'}`
                    : `Submitted ${fmtDate(a.submittedAt) || fmtDate(a.createdAt) || ''}`}
                </Typography>

                {a.needsRevision && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    MOHA has asked for changes before this can be assessed.
                  </Alert>
                )}

                {/* ── Actions ───────────────────────────────────────────────────
                    Only the ones MOHA will actually accept for this status, so there
                    are no buttons that fail by design. */}
                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                  {(a.isDraft || a.needsRevision) && (
                    <Button size="sm" startIcon={<PlayArrowRoundedIcon />}
                      onClick={() => navigate(`/services/${a.serviceId}/apply?id=${encodeURIComponent(a.id)}`)}>
                      Continue
                    </Button>
                  )}
                  {a.isApproved && (
                    <Button size="sm" startIcon={<DownloadRoundedIcon />}
                      loading={downloading === a.id}
                      onClick={() => (a.vehicleCount > 1 ? setPicking(a) : onDownload(a))}>
                      {a.vehicleCount > 1 ? 'Download letters' : 'Download letter'}
                    </Button>
                  )}
                  {a.isDraft && (
                    <Button size="sm" variant="secondary" startIcon={<DeleteOutlineRoundedIcon />}
                      onClick={() => setConfirming(a)}>
                      Delete
                    </Button>
                  )}
                  {!a.isDraft && (
                    <Button size="sm" variant="secondary"
                      onClick={() => navigate(`/tint/applications/${encodeURIComponent(a.id)}`)}>
                      View details
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ConfirmDelete app={confirming} busy={deleting}
        onClose={() => setConfirming(null)} onConfirm={onDelete} />
      <VehiclePicker
        open={!!picking} count={picking?.vehicleCount || 1} busy={downloading === picking?.id}
        onClose={() => setPicking(null)} onPick={(i) => onDownload(picking, i)} />
    </Box>
  );
}
