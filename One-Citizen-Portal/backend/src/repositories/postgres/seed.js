// Postgres boot config loading. There is NO user/data seeding: users are created only
// via /auth/register, so the DB is populated entirely by real registrations at runtime. The
// ONLY thing bootstrapped from data/seed is the immutable CONFIGURATION data (service
// catalogue + reference lists) the app needs to render its service directory. All of it is
// idempotent: a config row that already exists is left untouched (never clobbers live data).
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { logger } from '../../lib/logger.js';

const log = logger.child ? logger.child({ mod: 'pg.seed' }) : logger;

const SYSTEM_CTX = Object.freeze({ actor: 'system', roles: ['sysadmin'], scope: { unrestricted: true } });

const CATALOGUE_ID = 'catalogue';
const REFERENCE_ID = 'reference';

async function readJson(file, fallback = []) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

/**
 * ADDITIVE reconcile of the service catalogue.
 *
 * WHY THIS EXISTS. The original loader seeded the catalogue row only when it was
 * absent, and treated the DB as authoritative from then on. That is right for edits a
 * back-office makes — but it also means a NEW ministry, agency or service added to
 * data/seed/catalogue.json is invisible on every database that has already booted
 * once. Adding the Tint Waiver service surfaced this: the code shipped, the service
 * did not appear, and nothing logged a reason.
 *
 * The fix is deliberately one-directional: entries present in the file but missing
 * from the DB are ADDED; nothing already in the DB is modified, reordered or removed.
 * So a back-office rename still sticks, a back-office deletion is not resurrected on
 * the next boot (the key is matched, and a deleted key simply gets re-added — see the
 * caveat below), and a new service appears without a manual DB reset.
 *
 * CAVEAT, stated rather than hidden: because "missing from the DB" is how we detect
 * "new in the file", a service an operator deliberately DELETED from the DB will be
 * re-added on the next boot as long as it remains in the seed file. Removing a service
 * for good means removing it from the file too. That trade is the right way round —
 * silently missing services are worse than a resurrected one — but it is a trade.
 *
 * @returns {{ministries: any[], added: string[]}} merged list + what was added
 */
function reconcileCatalogue(dbMinistries, fileMinistries) {
  const added = [];
  const ministries = Array.isArray(dbMinistries) ? dbMinistries.map((m) => ({ ...m })) : [];

  for (const fileMin of fileMinistries || []) {
    const dbMin = ministries.find((m) => m.code === fileMin.code);
    if (!dbMin) {
      ministries.push(fileMin);
      added.push(`ministry:${fileMin.code}`);
      continue;
    }
    dbMin.agencies = Array.isArray(dbMin.agencies) ? dbMin.agencies.map((a) => ({ ...a })) : [];
    for (const fileAgency of fileMin.agencies || []) {
      const dbAgency = dbMin.agencies.find((a) => a.code === fileAgency.code);
      if (!dbAgency) {
        dbMin.agencies.push(fileAgency);
        added.push(`agency:${fileMin.code}/${fileAgency.code}`);
        continue;
      }
      dbAgency.services = Array.isArray(dbAgency.services) ? [...dbAgency.services] : [];
      for (const fileService of fileAgency.services || []) {
        if (!dbAgency.services.some((s) => s.id === fileService.id)) {
          dbAgency.services.push(fileService);
          added.push(`service:${fileService.id}`);
        }
      }
    }
  }
  return { ministries, added };
}

/**
 * Ensure the configuration data (service catalogue + reference lists) exists in the DB, then
 * return it — so the app serves catalogue/reference from Postgres, not from files. Seeds from
 * data/seed on first boot, and thereafter RECONCILES additively (see reconcileCatalogue) so
 * newly added services appear without wiping operator edits.
 * @param {{ repository: Function }} container
 * @param {string} dataDir
 * @returns {Promise<{ catalogueData: any[], referenceData: object }>}
 */
export async function loadConfigFromDb(container, dataDir) {
  const catRepo = container.repository('catalogue', { prefix: 'cat' });
  const refRepo = container.repository('reference', { prefix: 'ref' });
  const dir = path.join(dataDir, 'seed', 'reference');

  const fileMinistries = await readJson(path.join(dataDir, 'seed', 'catalogue.json'), []);
  let cat = await catRepo.findById(CATALOGUE_ID, SYSTEM_CTX);
  if (!cat) {
    cat = await catRepo.create({ id: CATALOGUE_ID, ministries: Array.isArray(fileMinistries) ? fileMinistries : [] }, SYSTEM_CTX);
    log.info({ ministries: cat.ministries.length }, 'seeded service catalogue into postgres');
  } else {
    const { ministries, added } = reconcileCatalogue(cat.ministries, fileMinistries);
    if (added.length) {
      cat = await catRepo.update(CATALOGUE_ID, { ministries }, cat.version, SYSTEM_CTX);
      log.info({ added }, 'catalogue reconciled — new config entries added from seed');
    }
  }

  // Reference lists follow the same rule, per KEY: a key the DB row does not yet have
  // is populated from its seed file. An existing key is left exactly as the DB has it.
  const REF_FILES = {
    regions: ['regions.json', []],
    localAuthorities: ['local-authorities.json', []],
    feeSchedules: ['fee-schedules.json', []],
    documentTypes: ['document-types.json', []],
    reasonCodes: ['reason-codes.json', {}],
    // PRE-EXISTING GAP, fixed in passing: data/seed/reference/civil-registration.json
    // has been in the repo all along and reference.service.js reads
    // `data.civilRegistration` — but the loader never populated it, so the key was
    // always undefined and the GRO civil-registration list rendered empty with
    // `configured: 0`. One line, and an existing screen starts working.
    civilRegistration: ['civil-registration.json', {}],
    // Tint Waiver option lists (exemption categories, medical conditions, vehicle
    // types/colours, make→model catalogue). Served from the DB like every other
    // reference list rather than hardcoded in a component.
    tint: ['tint.json', {}],
  };

  let ref = await refRepo.findById(REFERENCE_ID, SYSTEM_CTX);
  if (!ref) {
    const seeded = { id: REFERENCE_ID };
    for (const [key, [file, fallback]] of Object.entries(REF_FILES)) {
      seeded[key] = await readJson(path.join(dir, file), fallback);
    }
    ref = await refRepo.create(seeded, SYSTEM_CTX);
    log.info('seeded reference data into postgres');
  } else {
    const patch = {};
    for (const [key, [file, fallback]] of Object.entries(REF_FILES)) {
      const existing = ref[key];
      const fileValue = await readJson(path.join(dir, file), fallback);

      const isEmpty = (v) => v === undefined || v === null
        || (Array.isArray(v) && v.length === 0)
        || (!Array.isArray(v) && typeof v === 'object' && Object.keys(v).length === 0);

      if (isEmpty(existing)) { patch[key] = fileValue; continue; }

      // ── ARRAY-of-records reconcile, matched on `code` ────────────────────────
      // Same trap as the object case: `documentTypes` is a non-empty array, so a
      // whole-key check skips it forever and a NEW document type added to the seed
      // file never reaches an existing database. That is not cosmetic — the vault
      // validates uploads against this list, so a missing code makes every upload of
      // that type fail with "Unknown document type".
      //
      // Entries are appended by `code`; an existing code is left exactly as the DB has
      // it, so an operator's relabelling survives.
      if (Array.isArray(existing) && Array.isArray(fileValue)
          && fileValue.every((e) => e && typeof e === 'object' && 'code' in e)) {
        const codes = new Set(existing.filter((e) => e && typeof e === 'object').map((e) => e.code));
        const additions = fileValue.filter((e) => !codes.has(e.code));
        if (additions.length) patch[key] = [...existing, ...additions];
        continue;
      }

      // ── PER-LIST reconcile for object-shaped reference sets ──────────────────
      // Whole-key emptiness is not enough. `tint` is an OBJECT of several lists, and it
      // is deliberately seeded with EMPTY arrays before MOHA supplies the values. Once
      // that object exists the key is no longer "empty", so a whole-key check would
      // skip it forever and filling in tint.json would silently do nothing — which
      // makes the documented workflow ("drop your lists in and restart") a lie.
      //
      // So for an object-shaped set, each INNER list is reconciled on its own: a list
      // the DB still has empty is filled from the file. A list with values in the DB is
      // left alone, preserving the operator-edits-win rule at the level that matters.
      if (!Array.isArray(existing) && typeof existing === 'object'
          && !Array.isArray(fileValue) && fileValue && typeof fileValue === 'object') {
        const merged = { ...existing };
        let changed = false;
        for (const [innerKey, innerFileValue] of Object.entries(fileValue)) {
          if (isEmpty(existing[innerKey]) && !isEmpty(innerFileValue)) {
            merged[innerKey] = innerFileValue;
            changed = true;
          }
        }
        if (changed) patch[key] = merged;
      }
    }
    if (Object.keys(patch).length) {
      ref = await refRepo.update(REFERENCE_ID, patch, ref.version, SYSTEM_CTX);
      log.info({ keys: Object.keys(patch) }, 'reference data reconciled — new lists added from seed');
    }
  }

  return {
    catalogueData: cat.ministries || [],
    referenceData: {
      regions: ref.regions || [],
      localAuthorities: ref.localAuthorities || [],
      feeSchedules: ref.feeSchedules || [],
      documentTypes: ref.documentTypes || [],
      reasonCodes: ref.reasonCodes || {},
      civilRegistration: ref.civilRegistration || {},
      tint: ref.tint || {},
    },
  };
}
