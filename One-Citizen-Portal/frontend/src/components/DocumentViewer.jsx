import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, IconButton, Dialog, DialogTitle, DialogContent, CircularProgress, Chip, Tooltip,
} from '@mui/material';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import { api, apiError } from '../lib/api.js';
import { toast } from '../stores/toastStore.js';

// Virus-scan states, in citizen language rather than the raw API token.
const SCAN_LABEL = { clean: 'Checked', pending: 'Checking', infected: 'Not safe' };

const IMAGE = new Set(['png', 'jpg', 'jpeg']);
const isImage = (d) => IMAGE.has(String(d.format || '').toLowerCase()) || String(d.mimeType || '').startsWith('image/');
const isPdf = (d) => String(d.format || '').toLowerCase() === 'pdf' || d.mimeType === 'application/pdf';
const canPreview = (d) => isImage(d) || isPdf(d);
const prettySize = (n) => (!n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const iconFor = (d) => (isPdf(d) ? <PictureAsPdfRoundedIcon color="error" /> : isImage(d) ? <ImageRoundedIcon color="primary" /> : <DescriptionRoundedIcon color="action" />);

// Fetch a document's bytes (auth-guarded via the axios bearer interceptor) as an object URL.
async function fetchBlobUrl(documentId, kind) {
  const res = await api.get(`/documents/${documentId}/${kind}`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

/** Stream a download with the correct filename. */
export async function downloadDocument(documentId, fileName) {
  try {
    const url = await fetchBlobUrl(documentId, 'content');
    const a = document.createElement('a');
    a.href = url; a.download = fileName || documentId;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error(apiError(e));
  }
}

// Inline preview dialog: PDF in an iframe, images with zoom, others fall back to download.
function PreviewDialog({ doc, open, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, error: '' });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) return undefined;
    let revoked = false; let url;
    setState({ loading: true, url: null, error: '' });
    setZoom(1);
    fetchBlobUrl(doc.documentId, 'preview')
      .then((u) => { url = u; if (!revoked) setState({ loading: false, url: u, error: '' }); })
      .catch((e) => { if (!revoked) setState({ loading: false, url: null, error: apiError(e) }); });
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [open, doc.documentId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-label={`Preview ${doc.fileName}`}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        {iconFor(doc)}
        <Typography component="span" noWrap sx={{ fontWeight: 700, flexGrow: 1 }}>{doc.fileName || 'Document'}</Typography>
        {isImage(doc) && state.url && (
          <>
            <IconButton size="small" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Zoom out"><ZoomOutRoundedIcon /></IconButton>
            <IconButton size="small" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in"><ZoomInRoundedIcon /></IconButton>
          </>
        )}
        <Tooltip title="Download"><IconButton size="small" onClick={() => downloadDocument(doc.documentId, doc.fileName)} aria-label="Download"><DownloadRoundedIcon /></IconButton></Tooltip>
        <IconButton size="small" onClick={onClose} aria-label="Close preview" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      {/* One scroll container, and only when the content actually exceeds it.
          Previously this was `overflow: 'auto'` wrapped around a `70vh` iframe: the PDF
          viewer supplied its own scrollbar inside a box that also scrolled, so you got
          two nested vertical bars on every PDF. The iframe now fills a fixed-height
          box and this container clips. */}
      <DialogContent
        dividers
        className="oc-scroll"
        sx={{
          p: 0,
          height: { xs: '70dvh', sm: '72dvh' },
          bgcolor: 'action.hover',
          overflow: isImage(doc) && zoom > 1 ? 'auto' : 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {state.loading && <CircularProgress />}
        {!state.loading && state.error && <Typography color="error" sx={{ p: 3 }}>{state.error}</Typography>}

        {!state.loading && state.url && isPdf(doc) && (
          <Box component="iframe" title={doc.fileName} src={state.url}
            sx={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
        )}

        {!state.loading && state.url && isImage(doc) && (
          // Zoom by WIDTH, not `transform: scale()`. A transform does not change the
          // element's layout box, so a scaled-up image produced no scrollable overflow —
          // the zoomed portion was simply clipped and unreachable. Width does, so
          // zooming in now genuinely lets you pan around the document.
          <Box
            component="img"
            alt={doc.fileName}
            src={state.url}
            sx={{
              display: 'block',
              width: zoom === 1 ? 'auto' : `${zoom * 100}%`,
              maxWidth: zoom === 1 ? '100%' : 'none',
              maxHeight: zoom === 1 ? '100%' : 'none',
              objectFit: 'contain',
              margin: 'auto',
              transition: (t) => `width ${t.motion.base}ms ${t.motion.ease}`,
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * A single document row with inline Preview + Download controls. Used on the apply form,
 * tracking page, and profile. Preview-able types (PDF/image) open an inline viewer; other
 * types (e.g. docx) offer download only.
 */
export default function DocumentCard({ doc, dense = false }) {
  const [open, setOpen] = useState(false);
  const previewable = canPreview(doc);
  const openPreview = useCallback(() => setOpen(true), []);

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: dense ? 1 : 1.5,
        border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex' }}>{iconFor(doc)}</Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{doc.label || doc.fileName || 'Document'}</Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
          {doc.fileName && doc.label && <Typography variant="caption" color="text.secondary" noWrap>{doc.fileName}</Typography>}
          {doc.fileSize ? <Typography variant="caption" color="text.secondary">· {prettySize(doc.fileSize)}</Typography> : null}
          {/* Plain-language scan state. The raw status string ('pending', 'infected')
              used to be printed verbatim for anything that was not 'clean'. */}
          {doc.status && (
            <Chip
              size="small"
              variant="outlined"
              color={doc.status === 'clean' ? 'success' : doc.status === 'infected' ? 'error' : 'warning'}
              label={SCAN_LABEL[doc.status] || 'Checking'}
              sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
            />
          )}
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.5}>
        <Tooltip title={previewable ? 'Preview' : 'Preview not available — download instead'}>
          <span>
            <IconButton size="small" onClick={openPreview} disabled={!previewable} aria-label={`Preview ${doc.fileName || 'document'}`}>
              <VisibilityRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Download">
          <IconButton size="small" onClick={() => downloadDocument(doc.documentId, doc.fileName)} aria-label={`Download ${doc.fileName || 'document'}`}>
            <DownloadRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {previewable && open && <PreviewDialog doc={doc} open={open} onClose={() => setOpen(false)} />}
    </Box>
  );
}
