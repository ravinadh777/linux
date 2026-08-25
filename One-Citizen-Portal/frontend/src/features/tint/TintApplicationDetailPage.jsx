import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Typography, Box, Stack, Alert, Divider, CircularProgress, MenuItem, TextField,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import { PageHeader, StatusChip, DataRow, ErrorState } from '../../components/ui.jsx';
import { Button } from '../../ui/index.js';
import { toast } from '../../stores/toastStore.js';
import { useTintApplication, tintStatusForChip, downloadApprovalLetter } from './tintSync.jsx';
import { tintError } from './api/tintClient.js';
import { sectionsFor } from './detailSections.js';

// ─────────────────────────────────────────────────────────────────────────────
// One Tint Waiver application in full — the MOHA record, not a portal copy.
//
// Backed by GET /v1/applications/:id, which is the only call that returns `formData`.
// The list endpoint deliberately omits it, so this page is the only place a citizen can
// see what they actually submitted.
//
// Values are rendered THROUGH the form definitions, so every label matches the one the
// citizen filled in and a field added to the form appears here automatically. Reading
// raw keys out of formData instead would drift the moment a label changed.
// ─────────────────────────────────────────────────────────────────────────────

export default function TintApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: app, isLoading, error, refetch } = useTintApplication(id);
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Tint waiver" subtitle="Loading from the Ministry of Home Affairs…" />
        <Card><CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Fetching this application…</Typography>
          </Stack>
        </CardContent></Card>
      </>
    );
  }

  if (error || !app) {
    return (
      <>
        <PageHeader title="Tint waiver"
          crumbs={[{ label: 'Applications', to: '/tracking' }, { label: 'Tint waiver' }]} />
        <ErrorState
          error={error}
          title="We could not load this application from MOHA"
          onRetry={refetch}
        />
      </>
    );
  }

  const fd = app.formData || {};
  const documents = Array.isArray(fd.documents) ? fd.documents : [];
  const sections = sectionsFor(app.serviceId);

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadApprovalLetter(app.id, {
        vehicleIndex: app.vehicleCount > 1 ? vehicleIndex : undefined,
        filename: `tint-waiver-${app.reference || app.id}.pdf`,
      });
    } catch (err) {
      toast.error(tintError(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        title={app.serviceName}
        subtitle={`Ministry of Home Affairs${app.reference ? ` · ${app.reference}` : ''}`}
        crumbs={[
          { label: 'Applications', to: '/tracking' },
          { label: app.reference || 'Tint waiver' },
        ]}
        actions={<StatusChip status={tintStatusForChip(app.status)} size="medium" />}
      />

      {/* ── Status ─────────────────────────────────────────────────────────── */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
            <Box component="dl" sx={{ m: 0, flexGrow: 1 }}>
              <DataRow label="MOHA status" value={app.status} strong />
              <DataRow label="Reference" value={app.reference || 'Not yet issued'} />
              <DataRow label="Application type" value={app.applicationType} />
              {app.vehicleCount > 0 && <DataRow label="Vehicles covered" value={String(app.vehicleCount)} />}
              <DataRow label="Created" value={app.createdAt ? new Date(app.createdAt).toLocaleString() : '—'} />
              <DataRow label="Last updated" value={app.updatedAt ? new Date(app.updatedAt).toLocaleString() : '—'} />
            </Box>
          </Stack>

          {app.needsRevision && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              MOHA has asked for changes before this application can be assessed. Reopen it to make
              the corrections and submit again.
            </Alert>
          )}

          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
            {(app.isDraft || app.needsRevision) && (
              <Button startIcon={<PlayArrowRoundedIcon />}
                onClick={() => navigate(`/services/${app.serviceId}/apply?id=${encodeURIComponent(app.id)}`)}>
                {app.isDraft ? 'Continue this draft' : 'Make corrections'}
              </Button>
            )}
            {/* Approval letter — the only status MOHA will serve it for. */}
            {app.isApproved && (
              <>
                {app.vehicleCount > 1 && (
                  <TextField
                    select size="small" label="Vehicle" sx={{ minWidth: 150 }}
                    value={vehicleIndex} onChange={(e) => setVehicleIndex(Number(e.target.value))}
                  >
                    {Array.from({ length: app.vehicleCount }, (_, i) => (
                      <MenuItem key={i} value={i}>Vehicle {i + 1}</MenuItem>
                    ))}
                  </TextField>
                )}
                <Button startIcon={<DownloadRoundedIcon />} loading={downloading} onClick={onDownload}>
                  Download approval letter
                </Button>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ── What was submitted ─────────────────────────────────────────────────
          Rendered through the form definitions so labels match what the citizen
          filled in, and a new form field appears here without touching this page. */}
      {sections.map((section) => {
        const rows = section.repeat
          ? (fd[section.repeat.name] || [])
          : null;
        const hasAny = section.repeat
          ? rows.length > 0
          : (section.fields || []).some((f) => fd[f.name] !== undefined && fd[f.name] !== '');
        if (!hasAny) return null;
        return (
          <Card key={section.title} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 1.5 }}>
                {section.title}
              </Typography>
              {section.repeat ? (
                <Stack spacing={2}>
                  {rows.map((row, i) => (
                    <Box key={i}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.onSubtle' }}>
                        {section.repeat.itemLabel || 'Item'} {i + 1}
                      </Typography>
                      <Box component="dl" sx={{ m: 0 }}>
                        <Stack divider={<Divider flexItem />} spacing={0}>
                          {(section.fields || []).map((f) => (
                            <DataRow key={f.name} label={f.label} value={row?.[f.name] || '—'} />
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Box component="dl" sx={{ m: 0 }}>
                  <Stack divider={<Divider flexItem />} spacing={0}>
                    {(section.fields || [])
                      // Documents are listed separately below, with their storage paths.
                      .filter((f) => f.type !== 'file')
                      .map((f) => (
                        <DataRow key={f.name} label={f.label}
                          value={fd[f.name] === true ? 'Yes' : (fd[f.name] || '—')} />
                      ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ── Documents ─────────────────────────────────────────────────────────
          Shows the MOHA storagePath each upload produced, which is the only proof
          the two-step signed-URL flow actually completed for this application. */}
      {documents.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Documents ({documents.length})
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={0}>
              {documents.map((d, i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.25 }}>
                  <DescriptionRoundedIcon sx={{ color: 'primary.main', fontSize: 20, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.label || d.field}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                      {d.storagePath || d.filename || '—'}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </>
  );
}
