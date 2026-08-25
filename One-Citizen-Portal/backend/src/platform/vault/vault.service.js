// Document vault (FR-P2). Typed, versioned, hashed, virus-scanned; retrieval is scope-filtered.
// Re-upload creates a NEW VERSION (never a parallel copy). Infected files are quarantined.
import { createHash } from 'node:crypto';
import { sniffType, FORMAT_MIME } from '../../lib/fileType.js';
import { newId } from '../../lib/id.js';
import { resolveSubject } from '../../lib/authz.js';
import { SYSTEM_CTX } from '../../config/repositories.js';
import { ValidationError, NotFoundError, BusinessRuleError } from '../../lib/errors.js';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

export function createVaultService({ repos, storage, avScanner, referenceService, maxMb = 25 }) {
  const docType = (type) => referenceService.documentTypes().find((d) => d.code === type);

  async function persist({ ownerId, type, buffer, filename, lineageId, revision, applicationId = null, serviceType = null }) {
    const dt = docType(type);
    if (!dt) throw new ValidationError('Unknown document type', [{ field: 'type', issue: `unknown: ${type}` }]);
    if (!buffer || !buffer.length) throw new ValidationError('Empty file');
    const capMb = dt.maxMb || maxMb;
    if (buffer.length > capMb * 1024 * 1024) throw new ValidationError(`File exceeds ${capMb} MB limit`);

    const sniffed = sniffType(buffer);
    if (!sniffed) throw new ValidationError('Unrecognised or unsupported file content');
    if (!dt.formats.includes(sniffed)) {
      // Catches spoofed extensions: declared type disallows the actual content format.
      throw new ValidationError('File content does not match an allowed format for this document type', [
        { field: 'file', issue: `detected ${sniffed}, allowed ${dt.formats.join('/')}` },
      ]);
    }

    const scanStatus = await avScanner.scan(buffer);
    const id = newId('doc');
    const storageKey = `${id}.${sniffed}`;
    await storage.save(storageKey, buffer);

    return repos.documents.create(
      {
        id,
        ownerId,
        applicationId,
        serviceType,
        lineageId: lineageId || id,
        revision: revision || 1,
        type,
        format: sniffed,
        contentType: FORMAT_MIME[sniffed] || 'application/octet-stream',
        filename: filename || null,
        size: buffer.length,
        hash: sha256(buffer),
        scanStatus,
        status: scanStatus,
        originalVerifiedFlag: false,
        storageKey,
      },
      SYSTEM_CTX,
    );
  }

  // Owner scope for every read — a citizen can only ever see their own documents.
  const ownerCtx = (auth) => ({ actor: auth.sub, roles: auth.roles, scope: { where: { ownerId: resolveSubject(auth) } } });
  // Clean DTO — strips the internal storage key + raw `data`; NEVER leaks binary/base64.
  // Keeps the existing metadata fields AND adds enterprise-friendly aliases.
  const toDto = (d) => {
    const { storageKey, data, ...safe } = d; // eslint-disable-line no-unused-vars
    return {
      ...safe,
      documentId: d.id,
      userId: d.ownerId,
      applicationId: d.applicationId || null,
      serviceType: d.serviceType || null,
      fileName: d.filename,
      mimeType: FORMAT_MIME[d.format] || 'application/octet-stream',
      fileSize: d.size,
      checksum: d.hash,
      uploadedAt: d.createdAt,
    };
  };

  return {
    async upload({ auth, type, file, applicationId = null, serviceType = null }) {
      if (!file) throw new ValidationError('file is required');
      const doc = await persist({ ownerId: resolveSubject(auth), type, buffer: file.buffer, filename: file.originalname, applicationId, serviceType });
      await repos.audit.append({ action: 'document.uploaded', actor: auth.sub, entity: 'document', entityId: doc.id });
      return toDto(doc);
    },

    /** List the caller's own documents — optionally scoped to one application. Metadata only. */
    async listMine({ auth, applicationId } = {}) {
      const query = applicationId ? { applicationId } : {};
      const { items } = await repos.documents.find(query, ownerCtx(auth), { limit: 100 });
      return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(toDto);
    },

    /** Back-link freshly-uploaded documents to the application + service on submit. */
    async linkToApplication({ ownerId, documentIds, applicationId, serviceType }) {
      const ctx = { actor: ownerId, roles: ['citizen'], scope: { where: { ownerId } } };
      for (const id of documentIds || []) {
        const doc = await repos.documents.findById(id, ctx);
        if (doc && !doc.applicationId) {
          await repos.documents.update(id, { applicationId, serviceType }, doc.version, ctx);
        }
      }
    },

    async reupload({ auth, id, type, file }) {
      if (!file) throw new ValidationError('file is required');
      const ctx = ownerCtx(auth);
      const existing = await repos.documents.findById(id, ctx);
      if (!existing) throw new NotFoundError('Document not found');
      const versions = (await repos.documents.find({ lineageId: existing.lineageId }, ctx, { limit: 100 })).items;
      const nextRevision = Math.max(...versions.map((v) => v.revision || 1)) + 1;
      const doc = await persist({
        ownerId: existing.ownerId,
        type: type || existing.type,
        buffer: file.buffer,
        filename: file.originalname,
        lineageId: existing.lineageId,
        revision: nextRevision,
        applicationId: existing.applicationId || null,
        serviceType: existing.serviceType || null,
      });
      await repos.audit.append({ action: 'document.reuploaded', actor: auth.sub, entity: 'document', entityId: doc.id });
      return toDto(doc);
    },

    // Raw owner-scoped record (internal — carries storageKey). Never returned to the client.
    async _getRaw(auth, id) {
      const doc = await repos.documents.findById(id, ownerCtx(auth));
      if (!doc) throw new NotFoundError('Document not found');
      return doc;
    },

    /** Metadata DTO for a single document (audited view). */
    async get({ auth, id }) {
      const doc = await this._getRaw(auth, id);
      await repos.audit.append({ action: 'document.viewed', actor: auth.sub, entity: 'document', entityId: id });
      return toDto(doc);
    },

    async versions({ auth, id }) {
      const doc = await this._getRaw(auth, id);
      const { items } = await repos.documents.find({ lineageId: doc.lineageId }, ownerCtx(auth), { limit: 100 });
      return items.sort((a, b) => (a.revision || 1) - (b.revision || 1)).map(toDto);
    },

    /** Bytes for inline PREVIEW (audited). Refuses anything not clean (infected = quarantined). */
    async preview({ auth, id }) {
      const doc = await this._getRaw(auth, id);
      if (doc.scanStatus !== 'clean') {
        throw new BusinessRuleError('Document is not available for preview', 'REF-EVIDENCE', [{ field: 'scanStatus', issue: doc.scanStatus }]);
      }
      const buffer = await storage.read(doc.storageKey);
      await repos.audit.append({ action: 'document.previewed', actor: auth.sub, entity: 'document', entityId: id });
      return { doc, buffer };
    },

    /** Bytes for DOWNLOAD (audited). Returns { doc, buffer }; refuses anything not clean. */
    async content({ auth, id }) {
      const doc = await this._getRaw(auth, id);
      if (doc.scanStatus !== 'clean') {
        throw new BusinessRuleError('Document is not available for download', 'REF-EVIDENCE', [{ field: 'scanStatus', issue: doc.scanStatus }]);
      }
      const buffer = await storage.read(doc.storageKey);
      await repos.audit.append({ action: 'document.downloaded', actor: auth.sub, entity: 'document', entityId: id });
      return { doc, buffer };
    },

    /** Soft-delete one of the caller's own documents (audited; recoverable). */
    async remove({ auth, id }) {
      await this._getRaw(auth, id); // 404 if not the caller's
      await repos.documents.delete(id, ownerCtx(auth));
      await repos.audit.append({ action: 'document.deleted', actor: auth.sub, entity: 'document', entityId: id });
      return { documentId: id, deleted: true };
    },

    /** Mark a document's original as verified at a counter/inspection (FR-P2.3). */
    async markOriginalVerified({ id, officer }) {
      const doc = await repos.documents.findById(id, SYSTEM_CTX);
      if (!doc) throw new NotFoundError('Document not found');
      return repos.documents.update(id, { originalVerifiedFlag: true, verifiedBy: officer }, doc.version, SYSTEM_CTX);
    },
  };
}
