// ─────────────────────────────────────────────────────────────────────────────
// Application draft service — server-side autosave + resume.
//
// THE PROBLEM THIS SOLVES. The access token lives for 15 minutes (JWT_ACCESS_TTL).
// A citizen filling a 40-field passport application is very likely to cross that
// boundary, and before this existed the whole form was held in React state only:
// an expiry, a refresh, a closed tab or a flat battery lost everything typed. For
// the audience this portal serves — old-age pension and public assistance claims —
// that is not a minor annoyance, it is the reason an application never gets filed.
//
// THE APPROACH. Every draft is a row keyed to (ownerId, serviceId): exactly one
// live draft per citizen per service, so the client can autosave on a debounce and
// each save is an idempotent UPSERT rather than an append. Because it is stored
// server-side and not in localStorage, a draft survives logout AND follows the
// citizen to another device.
//
// WHAT IS STORED. The raw form values, the active step/section index, and the
// vault metadata for uploaded documents. Uploads are NOT duplicated here: the
// vault already persisted the file at upload time and returned a documentId, so
// keeping the metadata map is enough to restore the upload state intact.
//
// DELIBERATELY NOT VALIDATED. A draft is by definition incomplete — validating
// required fields on save would make it impossible to save the thing that most
// needs saving. Validation belongs at submit (applications.service.create).
// Only the shape is checked, so a malformed payload cannot poison the row.
// ─────────────────────────────────────────────────────────────────────────────
import { resolveSubject } from '../../lib/authz.js';
import { SYSTEM_CTX } from '../../config/repositories.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

const nowIso = () => new Date().toISOString();

/** Shape-only guard. Content is intentionally free-form — see the header note. */
function validateDraft({ form, documents, activeStep }) {
  if (form !== undefined && (form === null || typeof form !== 'object' || Array.isArray(form))) {
    throw new ValidationError('form must be an object of field values.');
  }
  if (documents !== undefined && (documents === null || typeof documents !== 'object' || Array.isArray(documents))) {
    throw new ValidationError('documents must be an object keyed by field name.');
  }
  if (activeStep !== undefined && (!Number.isInteger(activeStep) || activeStep < 0)) {
    throw new ValidationError('activeStep must be a non-negative integer.');
  }
}

export function createDraftsService({ repos, catalogueService }) {
  // Owner scope: a citizen can only ever see and write their OWN drafts. Same
  // pattern as applications.service.js citizenCtx, so delegated "acting-for"
  // access resolves identically.
  const ctxFor = (auth) => ({
    actor: auth.sub,
    roles: auth.roles,
    scope: { where: { ownerId: resolveSubject(auth) } },
  });

  /** The single live draft for this citizen + service, or null. */
  async function findDraft(auth, serviceId) {
    const { items } = await repos.applicationDrafts.find(
      { ownerId: resolveSubject(auth), serviceId },
      ctxFor(auth),
      { limit: 1 },
    );
    return items[0] || null;
  }

  /** Trim the stored shape down to what the client actually needs to resume. */
  const present = (d) => (d ? {
    id: d.id,
    serviceId: d.serviceId,
    serviceName: d.serviceName || null,
    activeStep: d.activeStep ?? 0,
    form: d.form || {},
    documents: d.documents || {},
    lastSavedAt: d.lastSavedAt || d.updatedAt || d.createdAt,
    createdAt: d.createdAt,
  } : null);

  return {
    /**
     * Create or update the citizen's draft for a service. This is the autosave
     * endpoint, so it is called often and must stay cheap and idempotent.
     *
     * PARTIAL BY DESIGN: an omitted key leaves the stored value alone. That lets the
     * client send `{ activeStep }` when only the step changed without having to
     * round-trip the entire form, and means a truncated request can never blank out
     * a field the citizen had already filled.
     */
    async save({ auth, serviceId, form, documents, activeStep }) {
      if (!serviceId) throw new ValidationError('serviceId is required');
      const service = catalogueService.service(serviceId); // 404s on an unknown service
      validateDraft({ form, documents, activeStep });

      const ownerId = resolveSubject(auth);
      const existing = await findDraft(auth, serviceId);

      if (existing) {
        const patch = { lastSavedAt: nowIso() };
        if (form !== undefined) patch.form = form;
        if (documents !== undefined) patch.documents = documents;
        if (activeStep !== undefined) patch.activeStep = activeStep;
        const updated = await repos.applicationDrafts.update(
          existing.id, patch, existing.version, ctxFor(auth),
        );
        return present(updated);
      }

      const created = await repos.applicationDrafts.create(
        {
          ownerId,
          serviceId,
          serviceName: service.name,
          agencyCode: service.agencyCode,
          agencyName: service.agencyName,
          activeStep: activeStep ?? 0,
          form: form || {},
          documents: documents || {},
          lastSavedAt: nowIso(),
        },
        SYSTEM_CTX,
      );
      return present(created);
    },

    /** The citizen's draft for one service — null (not 404) when there is none, so
     *  the client can treat "no draft" as an ordinary empty-form start. */
    async get({ auth, serviceId }) {
      if (!serviceId) throw new ValidationError('serviceId is required');
      return present(await findDraft(auth, serviceId));
    },

    /** Every draft the citizen has in flight — powers the "Drafts" KPI and the
     *  resume list on the dashboard. Most recently saved first. */
    async listMine({ auth }) {
      const { items } = await repos.applicationDrafts.find({}, ctxFor(auth), { limit: 100 });
      return items
        .map(present)
        .sort((a, b) => (String(a.lastSavedAt) < String(b.lastSavedAt) ? 1 : -1));
    },

    /** Discard a draft (explicit "delete draft", or internally after a successful
     *  submit). Idempotent: deleting a draft that is already gone is not an error,
     *  because submit-then-retry must not fail on the cleanup step. */
    async discard({ auth, serviceId }) {
      if (!serviceId) throw new ValidationError('serviceId is required');
      const existing = await findDraft(auth, serviceId);
      if (!existing) return { discarded: false };
      await repos.applicationDrafts.delete(existing.id, ctxFor(auth));
      return { discarded: true };
    },

    /** Same as discard but throws if absent — used by the explicit DELETE route so
     *  the client gets a truthful 404 rather than a silent success. */
    async remove({ auth, serviceId }) {
      const res = await this.discard({ auth, serviceId });
      if (!res.discarded) throw new NotFoundError('No draft found for this service');
      return res;
    },

    /** Counts for the dashboard KPI strip. Kept here so the dashboard service does
     *  not need its own knowledge of how drafts are stored. */
    async countMine({ auth }) {
      const { items } = await repos.applicationDrafts.find({}, ctxFor(auth), { limit: 500 });
      return items.length;
    },
  };
}
