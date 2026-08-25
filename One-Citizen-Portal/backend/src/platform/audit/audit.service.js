// Append-only audit (FR-P7 / SECURITY §6). Records who/what/when with before/after hashes;
// reads are restricted to oversight roles and are themselves audited.
import { createHash } from 'node:crypto';
import { SYSTEM_CTX } from '../../config/repositories.js';

const hashOf = (v) => (v == null ? null : createHash('sha256').update(JSON.stringify(v)).digest('hex'));

export function createAuditService({ repos }) {
  return {
    /** Record a business event. before/after are hashed (never stored raw). */
    async record({ actor, actingFor, role, action, entity, entityId, before, after, requestId, consumerId }) {
      return repos.audit.append({
        actor: actor || null,
        actingFor: actingFor || null,
        role: role || null,
        action,
        entity: entity || null,
        entityId: entityId || null,
        beforeHash: hashOf(before),
        afterHash: hashOf(after),
        requestId: requestId || null,
        consumerId: consumerId || null,
      });
    },

    /** Query the audit trail (oversight only — enforced at the route). The read is self-audited. */
    async query({ filters = {}, auth, requestId, limit = 50, cursor } = {}) {
      const result = await repos.audit.find(filters, SYSTEM_CTX, { limit, cursor });
      await repos.audit.append({
        actor: auth?.sub || null,
        role: auth?.roles || null,
        action: 'audit.read',
        entity: 'audit',
        entityId: null,
        filters,
        requestId: requestId || null,
      });
      return result;
    },
  };
}
