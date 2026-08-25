// ─────────────────────────────────────────────────────────────────────────────
// Citizen records — the platform layer behind the portal's record modules:
// vehicles, properties, employment, family, wallet, messages and business.
//
// These are seven collections that share one shape: rows OWNED by a citizen,
// listed and mutated only by that citizen. Rather than seven near-identical
// services, this is one factory parameterised per collection — so ownership
// scoping, validation and the audit trail are implemented once and cannot drift
// between modules.
//
// Ownership: every record carries `ownerId`. Reads and writes go through the
// scope ctx from lib/authz, so the repository applies `ownerId = <subject>` as a
// MANDATORY filter — a citizen physically cannot read another's rows, and the
// rule lives in one place rather than in seven controllers.
//
// There is NO seeded citizen data. Every row is created by a real request, so an
// empty account legitimately returns [] and the UI shows its empty state.
// ─────────────────────────────────────────────────────────────────────────────
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { buildScopeCtx, resolveSubject } from '../../lib/authz.js';

/** Trim strings, drop undefined/empty, keep everything else as-is. */
function clean(src = {}, allowed) {
  const out = {};
  for (const k of allowed) {
    if (src[k] === undefined || src[k] === null) continue;
    const v = typeof src[k] === 'string' ? src[k].trim() : src[k];
    if (v !== '') out[k] = v;
  }
  return out;
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Collection definitions. `fields` is the write allow-list — anything a client
 * sends outside it is never stored. `required` is enforced on create only, so a
 * PATCH can update one field without resending the whole record.
 */
export const COLLECTIONS = Object.freeze({
  vehicles: {
    repo: 'vehicles',
    label: 'Vehicle',
    fields: ['registration', 'make', 'model', 'year', 'colour', 'bodyType', 'engineNo', 'chassisNo',
      'licenceClass', 'licenceExpiry', 'insurer', 'insuranceExpiry', 'fitnessExpiry', 'notes'],
    required: ['registration'],
    // Registration is the natural key a citizen recognises; two rows for the same
    // plate on one account is always a mistake.
    unique: 'registration',
    sort: (a, b) => String(a.registration || '').localeCompare(String(b.registration || '')),
  },
  properties: {
    repo: 'properties',
    label: 'Property',
    fields: ['lot', 'street', 'village', 'region', 'localAuthority', 'propertyType', 'tenure',
      'titleNumber', 'transportNumber', 'valuation', 'rateAccount', 'notes'],
    required: ['village', 'region'],
    sort: (a, b) => String(a.village || '').localeCompare(String(b.village || '')),
  },
  employment: {
    repo: 'employment',
    label: 'Employment record',
    fields: ['employer', 'employerTin', 'position', 'employmentType', 'startDate', 'endDate',
      'monthlySalary', 'nisNumber', 'current', 'notes'],
    required: ['employer'],
    // Current role first, then most recent start date.
    sort: (a, b) => (Number(!!b.current) - Number(!!a.current))
      || String(b.startDate || '').localeCompare(String(a.startDate || '')),
  },
  family: {
    repo: 'family',
    label: 'Family member',
    fields: ['fullName', 'relationship', 'dob', 'gender', 'nationalId', 'phone', 'isDependant', 'notes'],
    required: ['fullName', 'relationship'],
    sort: (a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')),
  },
  wallet: {
    repo: 'walletMethods',
    label: 'Payment method',
    // No PAN, no CVV, no full account number — a citizen-facing wallet stores only
    // what is needed to RECOGNISE a method. Anything sensitive belongs with a
    // payment processor, not in this database.
    fields: ['kind', 'label', 'provider', 'last4', 'expiryMonth', 'expiryYear', 'isDefault'],
    required: ['kind', 'label'],
    sort: (a, b) => (Number(!!b.isDefault) - Number(!!a.isDefault)),
  },
  messages: {
    repo: 'messages',
    label: 'Message',
    // Citizens do not author these — they are sent BY agencies. Creation is
    // therefore restricted (see `readOnlyForCitizen`); a citizen may only mark
    // one read or archived.
    fields: ['subject', 'body', 'agencyCode', 'agencyName', 'isRead', 'archived', 'applicationId', 'sentAt'],
    required: ['subject'],
    readOnlyForCitizen: true,
    citizenPatchable: ['isRead', 'archived'],
    sort: (a, b) => String(b.sentAt || b.createdAt || '').localeCompare(String(a.sentAt || a.createdAt || '')),
  },
  business: {
    repo: 'businesses',
    label: 'Business',
    fields: ['name', 'registrationNumber', 'tin', 'businessType', 'registeredDate', 'status',
      'lot', 'street', 'village', 'region', 'sector', 'employeeCount', 'notes'],
    required: ['name'],
    unique: 'registrationNumber',
    sort: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
  },
});

export function createRecordsService({ repos, events }) {
  /** Scope ctx for a citizen-owned collection. */
  const ctxFor = (auth) => buildScopeCtx(auth, { ownerField: 'ownerId' });

  function defFor(collection) {
    const def = COLLECTIONS[collection];
    if (!def) throw new NotFoundError(`Unknown record collection: ${collection}`);
    return def;
  }

  function repoFor(def) {
    const repo = repos[def.repo];
    if (!repo) throw new Error(`Repository not registered: ${def.repo}`);
    return repo;
  }

  async function list({ auth, collection, query = {} }) {
    const def = defFor(collection);
    const { items } = await repoFor(def).find({}, ctxFor(auth), { limit: 200 });
    let rows = items;
    // `archived` is opt-in across every collection that has the flag, so an
    // archived row never silently disappears from a count the citizen can see.
    if (query.archived === undefined || query.archived === 'false') {
      rows = rows.filter((r) => !r.archived);
    }
    return def.sort ? [...rows].sort(def.sort) : rows;
  }

  async function get({ auth, collection, id }) {
    const def = defFor(collection);
    const rec = await repoFor(def).findById(id, ctxFor(auth));
    if (!rec) throw new NotFoundError(`${def.label} not found`);
    return rec;
  }

  async function create({ auth, collection, body, allowRestricted = false }) {
    const def = defFor(collection);
    if (def.readOnlyForCitizen && !allowRestricted) {
      throw new ValidationError(`${def.label}s are sent by government agencies and cannot be created here.`);
    }
    if (!isPlainObject(body)) throw new ValidationError('A record body is required.');

    const data = clean(body, def.fields);
    const missing = (def.required || []).filter((k) => data[k] === undefined);
    if (missing.length) {
      throw new ValidationError(`${def.label} requires: ${missing.join(', ')}.`);
    }

    const ctx = ctxFor(auth);
    if (def.unique && data[def.unique]) {
      const existing = await list({ auth, collection });
      const clash = existing.find(
        (r) => String(r[def.unique] || '').toLowerCase() === String(data[def.unique]).toLowerCase(),
      );
      if (clash) {
        throw new ValidationError(`You already have a ${def.label.toLowerCase()} with ${def.unique} ${data[def.unique]}.`);
      }
    }

    // ownerId is set from the TOKEN, never from the body — a client cannot file a
    // record against another citizen.
    const rec = await repoFor(def).create({ ...data, ownerId: resolveSubject(auth) }, ctx);
    events?.emit?.('record.created', { collection, id: rec.id, ownerId: rec.ownerId });
    return rec;
  }

  async function update({ auth, collection, id, body }) {
    const def = defFor(collection);
    if (!isPlainObject(body)) throw new ValidationError('A record body is required.');

    // Messages: a citizen may only flip read/archived, never rewrite the content
    // an agency sent them.
    const writable = def.readOnlyForCitizen ? (def.citizenPatchable || []) : def.fields;
    const data = clean(body, writable);
    if (!Object.keys(data).length) {
      throw new ValidationError('No updatable fields were provided.');
    }

    const ctx = ctxFor(auth);
    const existing = await repoFor(def).findById(id, ctx);
    if (!existing) throw new NotFoundError(`${def.label} not found`);

    const rec = await repoFor(def).update(id, data, ctx);
    events?.emit?.('record.updated', { collection, id, ownerId: existing.ownerId });
    return rec;
  }

  async function remove({ auth, collection, id }) {
    const def = defFor(collection);
    if (def.readOnlyForCitizen) {
      // Archive rather than delete, so an agency's message is never destroyed by
      // the recipient.
      return update({ auth, collection, id, body: { archived: true } });
    }
    const ctx = ctxFor(auth);
    const existing = await repoFor(def).findById(id, ctx);
    if (!existing) throw new NotFoundError(`${def.label} not found`);
    await repoFor(def).remove(id, ctx);
    events?.emit?.('record.deleted', { collection, id, ownerId: existing.ownerId });
    return { id, deleted: true };
  }

  /** Counts for the sidebar badge + dashboard tiles, in one round trip. */
  async function summary({ auth }) {
    const names = Object.keys(COLLECTIONS);
    const results = await Promise.all(names.map(async (c) => {
      const rows = await list({ auth, collection: c }).catch(() => []);
      return [c, rows];
    }));
    const out = {};
    for (const [c, rows] of results) out[c] = { count: rows.length };
    // Unread message count drives the sidebar badge the prototype shows.
    const msgs = results.find(([c]) => c === 'messages')?.[1] || [];
    out.messages.unread = msgs.filter((m) => !m.isRead).length;
    return out;
  }

  return { list, get, create, update, remove, summary, collections: () => Object.keys(COLLECTIONS) };
}
