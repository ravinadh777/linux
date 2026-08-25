import { useRef, useState } from 'react';
import { Box, Button, Typography, Stack, LinearProgress, IconButton, Link } from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import GppMaybeRoundedIcon from '@mui/icons-material/GppMaybeRounded';
import { api, apiError } from '../lib/api.js';
import DocumentCard from './DocumentViewer.jsx';

// Uploads a file to the vault (POST /documents) and reports the stored document id.
// The request, the payload and the onUploaded contract are unchanged.

const MAX_MB = 25;
const ACCEPT_BASE = ['pdf', 'jpg', 'jpeg', 'png'];

/**
 * Virus-scan state, driven by the REAL `scanStatus` the API returns.
 *
 * This component used to render a hardcoded green "Scanned · clean" chip on every
 * successful upload while ignoring the `scanStatus` it had just received — so a
 * pending or infected file was reported to the citizen as clean. That is a safety
 * claim the UI is not entitled to make, so the three states are now distinct and
 * the copy is plain.
 */
const SCAN = {
  clean: { label: 'Checked — safe', tone: 'success', icon: <CheckCircleRoundedIcon sx={{ fontSize: 17 }} /> },
  pending: { label: 'Checking for viruses…', tone: 'warning', icon: <HourglassTopRoundedIcon sx={{ fontSize: 17 }} /> },
  infected: { label: 'Not safe — remove this file', tone: 'error', icon: <GppMaybeRoundedIcon sx={{ fontSize: 17 }} /> },
};
const scanFor = (status) => SCAN[status] || SCAN.pending;

/**
 * @param {Function} [uploader] optional `(file) => Promise<object>` that REPLACES the
 *   portal-vault upload entirely. Used by the MOHA Tint Waiver services, where MOHA is
 *   the system of record: their documents go through MOHA's signed-URL flow and the
 *   portal vault is not involved at all. Whatever it resolves becomes the document meta
 *   (it must include a truthy `documentId` so the shared required-document gate is
 *   satisfied). A failure here IS a failed upload and is reported as one — unlike the
 *   vault path there is no second copy, so silence would be a lie.
 */
export default function DocumentUpload({
  label, docType, required, value, filename, scanStatus, onUploaded, onRemove, error, uploader,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const uploaded = !!value;
  const extra = docType === 'building_plan' ? ['dwg', 'dxf'] : [];
  const allowed = [...ACCEPT_BASE, ...extra];
  const accept = allowed.map((e) => `.${e}`).join(',');

  /**
   * Validate before the request. The 25 MB limit was stated in the helper text
   * but never enforced client-side, so an oversized file uploaded for a long time
   * and then failed server-side. Checking here fails instantly instead.
   */
  const validate = (file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext)) {
      return `${label} must be a ${allowed.slice(0, -1).join(', ').toUpperCase()} or ${allowed.at(-1).toUpperCase()} file. You chose a .${ext} file.`;
    }
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_MB) {
      return `That file is ${mb.toFixed(1)} MB — the limit is ${MAX_MB} MB. Try a smaller scan or photo.`;
    }
    if (file.size === 0) return 'That file is empty. Please choose another.';
    return null;
  };

  const upload = async (file) => {
    if (!file) return;
    const problem = validate(file);
    if (problem) { setErr(problem); return; }
    setErr('');
    setBusy(true);
    try {
      let meta;
      if (uploader) {
        // ── EXTERNAL store (MOHA Tint signed-URL flow) ──────────────────────────
        // Replaces the vault entirely: for a Tint waiver MOHA is the system of
        // record, so there is no portal copy of the document. That also means a
        // failure here is a genuine upload failure with no fallback — it propagates
        // to the catch below and is shown to the citizen, because reporting success
        // for a file that was never stored is the worst outcome available.
        meta = await uploader(file);
      } else {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', docType);
        const { data } = await api.post('/documents', fd);
        // scanStatus is passed through to the caller so the real state is shown.
        meta = { documentId: data.id, filename: file.name, scanStatus: data.scanStatus, fileSize: file.size };
      }
      onUploaded(meta);
    } catch (e2) {
      setErr(apiError(e2));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (busy || uploaded) return;
    upload(e.dataTransfer.files?.[0]);
  };

  const shownError = error || err;
  const scan = scanFor(scanStatus);
  const inputId = `upload-${docType}-${label.replace(/\s+/g, '-').toLowerCase()}`;

  // ── Uploaded ───────────────────────────────────────────────────────────────
  if (uploaded) {
    return (
      <Box sx={{ border: 1, borderColor: scanStatus === 'infected' ? 'error.main' : 'success.main', borderRadius: 2, p: 1.75, bgcolor: 'success.subtle' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ color: `${scan.tone}.main`, display: 'flex', flexShrink: 0 }}>{scan.icon}</Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, color: `${scan.tone}.text` }}>
              {/* Word + icon, never colour alone. */}
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{scan.label}</Typography>
            </Stack>
          </Box>
          <IconButton onClick={onRemove} aria-label={`Remove ${label}`} size="small">
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box sx={{ mt: 1.25 }}>
          <DocumentCard
            dense
            doc={{
              documentId: value,
              fileName: filename,
              format: (filename || '').split('.').pop()?.toLowerCase(),
              status: scanStatus,
            }}
          />
        </Box>
        {shownError && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'error.text', fontWeight: 600 }}>{shownError}</Typography>
        )}
      </Box>
    );
  }

  // ── Empty / uploading ──────────────────────────────────────────────────────
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      sx={{
        border: '1px dashed', borderRadius: 2, p: 2,
        borderColor: shownError ? 'error.main' : dragOver ? 'primary.main' : 'divider',
        bgcolor: dragOver ? 'primary.subtle' : shownError ? 'error.subtle' : 'transparent',
        transition: (t) => `background-color ${t.motion.fast}ms ${t.motion.ease}, border-color ${t.motion.fast}ms ${t.motion.ease}`,
      }}
    >
      <input ref={inputRef} id={inputId} type="file" hidden accept={accept} onChange={(e) => upload(e.target.files?.[0])} />

      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.5}>
        <Box sx={{ color: 'text.secondary', display: 'flex', flexShrink: 0 }}><DescriptionRoundedIcon /></Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography component="label" htmlFor={inputId} variant="body2" sx={{ fontWeight: 700, cursor: 'pointer', display: 'block' }}>
            {label}
            {required && <Box component="span" sx={{ color: 'error.main' }} aria-hidden> *</Box>}
            {required && <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>(required)</Box>}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            Drag it here, or{' '}
            <Link component="button" type="button" onClick={() => inputRef.current?.click()} sx={{ fontWeight: 600 }}>
              choose a file
            </Link>
            {' · '}{allowed.map((e) => e.toUpperCase()).join(', ')} · up to {MAX_MB} MB
          </Typography>
        </Box>
        {!busy && (
          <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => inputRef.current?.click()} sx={{ flexShrink: 0 }}>
            Upload
          </Button>
        )}
      </Stack>

      {busy && (
        <Box sx={{ mt: 1.5 }} role="status" aria-live="polite">
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Uploading {label}…
          </Typography>
          {/* Indeterminate: the vault endpoint does not report byte progress, so a
              fake percentage would be a lie. The label carries the meaning. */}
          <LinearProgress />
        </Box>
      )}

      {shownError && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: 'error.text', fontWeight: 600 }} role="alert">
          {shownError}
        </Typography>
      )}
    </Box>
  );
}
