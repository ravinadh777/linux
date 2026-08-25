// Vault routes (docs/API.md §5). Uploads require Level-2 assurance.
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAssurance } from '../../middleware/rbac.js';
import { ValidationError } from '../../lib/errors.js';
import { FORMAT_MIME } from '../../lib/fileType.js';
import { env } from '../../config/env.js';

export function createVaultRouter({ vaultService, requireAuth }) {
  const r = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: (env.MAX_UPLOAD_MB || 25) * 1024 * 1024 } });

  // Run multer and translate its errors into the standard contract.
  const single = (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      if (err) return next(new ValidationError(err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds size limit' : 'Upload error'));
      next();
    });

  r.post('/documents', requireAuth, requireAssurance(2), single, asyncHandler(async (req, res) => {
    res.status(201).json(await vaultService.upload({ auth: req.auth, type: req.body?.type, file: req.file }));
  }));

  r.post('/documents/:id/reupload', requireAuth, requireAssurance(2), single, asyncHandler(async (req, res) => {
    res.status(201).json(await vaultService.reupload({ auth: req.auth, id: req.params.id, type: req.body?.type, file: req.file }));
  }));

  // List the caller's own documents (metadata only — no binary). Optional ?applicationId= filter.
  r.get('/documents', requireAuth, asyncHandler(async (req, res) => {
    res.json({ items: await vaultService.listMine({ auth: req.auth, applicationId: req.query.applicationId }) });
  }));

  r.get('/documents/:id', requireAuth, asyncHandler(async (req, res) => {
    res.json(await vaultService.get({ auth: req.auth, id: req.params.id }));
  }));

  r.get('/documents/:id/versions', requireAuth, asyncHandler(async (req, res) => {
    res.json({ items: await vaultService.versions({ auth: req.auth, id: req.params.id }) });
  }));

  // PREVIEW — inline render in the browser (no forced download). Correct Content-Type; the
  // base64 is decoded server-side into the streamed body, never dumped into the DOM.
  r.get('/documents/:id/preview', requireAuth, asyncHandler(async (req, res) => {
    const { doc, buffer } = await vaultService.preview({ auth: req.auth, id: req.params.id });
    res.set('Content-Type', FORMAT_MIME[doc.format] || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${doc.filename || doc.id}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=60');
    res.send(buffer);
  }));

  // DOWNLOAD — streamed attachment with the correct filename + MIME type.
  r.get('/documents/:id/content', requireAuth, asyncHandler(async (req, res) => {
    const { doc, buffer } = await vaultService.content({ auth: req.auth, id: req.params.id });
    res.set('Content-Type', FORMAT_MIME[doc.format] || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${doc.filename || doc.id}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }));

  // Soft-delete one of the caller's own documents.
  r.delete('/documents/:id', requireAuth, asyncHandler(async (req, res) => {
    res.json(await vaultService.remove({ auth: req.auth, id: req.params.id }));
  }));

  return r;
}
