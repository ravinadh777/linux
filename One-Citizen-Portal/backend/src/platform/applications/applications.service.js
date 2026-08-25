// Application/case service. The CITIZEN persona submits an application; a BACK-OFFICE
// officer (a future app on this same database) reviews, approves or rejects it. Both
// personas share this service and the `applications` + `application_events` tables, so the
// two apps stay in lockstep with one consistent, audited workflow.
import { resolveSubject, buildScopeCtx, assertDistinctActors } from '../../lib/authz.js';
import { SYSTEM_CTX } from '../../config/repositories.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../lib/errors.js';
import { EVENTS, APPLICATION_STATUS } from '@onecitizen/shared/constants';

const nowIso = () => new Date().toISOString();

const OFFICER_RE = /^(officer\.|coordinator|programme\.admin|oversight|sysadmin)/;
const isOfficer = (roles = []) => roles.some((r) => OFFICER_RE.test(r));
function requireOfficer(auth) {
  if (!isOfficer(auth.roles)) throw new ForbiddenError('This action requires a back-office officer role.');
}

function validateSubmission(form, documents) {
  if (form === null || typeof form !== 'object' || Array.isArray(form)) {
    throw new ValidationError('form must be an object of field values.');
  }
  if (documents !== undefined && !Array.isArray(documents)) {
    throw new ValidationError('documents must be an array.');
  }
  for (const d of documents || []) {
    if (!d || typeof d.documentId !== 'string' || typeof d.field !== 'string') {
      throw new ValidationError('each document must reference { field, documentId }.');
    }
  }
}

export function createApplicationsService({ repos, catalogueService, events, vaultService, draftsService }) {
  // Citizen owner scope (self, or delegated citizen when acting-for).
  const citizenCtx = (auth) => ({ actor: auth.sub, roles: auth.roles, scope: { where: { ownerId: resolveSubject(auth) } } });
  // Officer scope: agency-bound lane (via the token `agency` claim); oversight/sysadmin unrestricted.
  const officerCtx = (auth) => buildScopeCtx(auth, { laneField: 'agencyCode', ownerField: 'ownerId' });

  async function recordEvent({ app, action, fromStatus, toStatus, auth, note }) {
    await repos.applicationEvents.create(
      {
        applicationId: app.id,
        ownerId: app.ownerId, // keep the citizen linkage on the event too
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        action,
        actorEid: auth.sub,
        actorRole: (auth.roles || [])[0] || null,
        note: note ?? null,
      },
      SYSTEM_CTX,
    );
  }

  /** Shared transition: load (officer-scoped), apply audit patch, persist, log event, emit. */
  async function transition({ auth, id, action, event, patch, note }) {
    requireOfficer(auth);
    const ctx = officerCtx(auth);
    const app = await repos.applications.findById(id, ctx);
    if (!app) throw new NotFoundError('Application not found');
    const fromStatus = app.status;
    const updated = await repos.applications.update(id, patch, app.version, ctx);
    await recordEvent({ app: updated, action, fromStatus, toStatus: updated.status, auth, note });
    await events?.emit({ type: event, payload: { applicationId: id, fromStatus, toStatus: updated.status, actor: auth.sub }, actor: auth.sub });
    return updated;
  }

  return {
    // ── Citizen: submit + read own ─────────────────────────────────────────────
    async create({ auth, serviceId, form = {}, documents = [] }) {
      if (!serviceId) throw new ValidationError('serviceId is required');
      const service = catalogueService.service(serviceId); // throws NotFound if unknown
      validateSubmission(form, documents);
      const ownerId = resolveSubject(auth);
      const isAppointment = serviceId === 'book-appointment';
      const ref = isAppointment
        ? `APT-2026-${Math.floor(100000 + (Date.now() % 900000))}`
        : `OC-2026-${Math.floor(100000 + (Date.now() % 900000))}`;
      const docs = isAppointment ? [] : (Array.isArray(documents) ? documents.filter((d) => d && d.documentId) : []);
      const docNote = docs.length ? ` with ${docs.length} document${docs.length === 1 ? '' : 's'}` : '';

      const lanes = isAppointment
        ? [{ name: 'Awaiting confirmation', status: 'in_progress', sla: 'within 2 working days' }]
        : [
            { name: 'Document check', status: 'in_progress', sla: 'in 2 working days' },
            { name: 'Verification', status: 'pending', sla: 'in 5 working days' },
            { name: 'Decision', status: 'pending', sla: 'in 10 working days' },
          ];
      const status = isAppointment ? APPLICATION_STATUS.AWAITING_CONFIRMATION : APPLICATION_STATUS.SUBMITTED;
      const timelineNote = isAppointment
        ? `Appointment request received for ${form.office || 'the selected office'} — awaiting confirmation.`
        : `${service.name} application received${docNote}.`;

      const app = await repos.applications.create(
        {
          ownerId,
          reference: ref,
          serviceId,
          serviceName: service.name,
          ministryCode: service.ministryCode,
          ministryName: service.ministryName,
          agencyCode: service.agencyCode,
          agencyName: service.agencyName,
          kind: isAppointment ? 'appointment' : 'application',
          status,
          submittedAt: nowIso(),
          assignedOfficer: null,
          form,
          documents: docs,
          lanes,
          timeline: [{ at: nowIso(), event: isAppointment ? 'Requested' : 'Submitted', note: timelineNote }],
        },
        SYSTEM_CTX,
      );
      // Back-link every uploaded document to THIS application + service, so the vault is
      // queryable by "all documents for application Y" (as well as by user).
      if (vaultService && docs.length) {
        await vaultService.linkToApplication({
          ownerId,
          documentIds: docs.map((d) => d.documentId).filter(Boolean),
          applicationId: app.id,
          serviceType: serviceId,
        });
      }
      await recordEvent({ app, action: 'submitted', fromStatus: null, toStatus: status, auth, note: timelineNote });
      await events?.emit({ type: EVENTS.APPLICATION_SUBMITTED, payload: { applicationId: app.id, serviceId, ownerId }, actor: auth.sub });

      // The work-in-progress draft has served its purpose — retire it so the citizen
      // is not offered a stale "resume where you left off" for a form they have just
      // submitted, and so the Drafts KPI drops as they would expect.
      //
      // Deliberately AFTER the application row is committed, and deliberately
      // swallowed: the submission is the thing that matters legally, and it has
      // already succeeded by this point. Failing the request over a cleanup step
      // would tell the citizen their application did not go through when it did.
      // `discard` is itself idempotent, so a retry is safe.
      if (draftsService) {
        try {
          await draftsService.discard({ auth, serviceId });
        } catch {
          /* non-fatal — the draft is stale data, the application is committed */
        }
      }
      return app;
    },

    async listMine({ auth }) {
      const { items } = await repos.applications.find({}, citizenCtx(auth), { limit: 100 });
      return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async get({ auth, id }) {
      // Visible to the owning citizen OR a back-office officer in the same agency lane.
      const app = (await repos.applications.findById(id, citizenCtx(auth)))
        || (isOfficer(auth.roles) ? await repos.applications.findById(id, officerCtx(auth)) : null);
      if (!app) throw new NotFoundError('Application not found');
      return app;
    },

    /** Full audit trail for an application (both personas can read it once they can see the app). */
    async history({ auth, id }) {
      await this.get({ auth, id }); // authorization gate
      const { items } = await repos.applicationEvents.find({ applicationId: id }, SYSTEM_CTX, { limit: 200 });
      return items.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    },

    // ── Back-office: officer queue + workflow transitions ──────────────────────
    async listQueue({ auth, status, limit = 100 }) {
      requireOfficer(auth);
      const query = status ? { status } : {};
      const { items } = await repos.applications.find(query, officerCtx(auth), { limit });
      return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    assign({ auth, id, officerEid }) {
      return transition({
        auth, id, action: 'assigned', event: EVENTS.APPLICATION_ASSIGNED,
        patch: { assignedOfficer: officerEid || auth.sub },
        note: `Assigned to ${officerEid || auth.sub}`,
      });
    },

    review({ auth, id, note }) {
      return transition({
        auth, id, action: 'reviewed', event: EVENTS.APPLICATION_REVIEWED,
        patch: { status: APPLICATION_STATUS.UNDER_REVIEW, reviewedBy: auth.sub, reviewedAt: nowIso() },
        note,
      });
    },

    async approve({ auth, id, note }) {
      const existing = await repos.applications.findById(id, officerCtx(auth));
      if (existing) assertDistinctActors(existing.ownerId, auth.sub, 'An officer cannot approve their own application.');
      return transition({
        auth, id, action: 'approved', event: EVENTS.APPLICATION_APPROVED,
        patch: { status: APPLICATION_STATUS.APPROVED, approvedBy: auth.sub, approvedAt: nowIso() },
        note,
      });
    },

    reject({ auth, id, reason }) {
      if (!reason || !String(reason).trim()) throw new ValidationError('A rejection reason is required.');
      return transition({
        auth, id, action: 'rejected', event: EVENTS.APPLICATION_REJECTED,
        patch: { status: APPLICATION_STATUS.REJECTED, rejectedBy: auth.sub, rejectedAt: nowIso(), rejectionReason: String(reason).trim() },
        note: reason,
      });
    },
  };
}
