// Loads static reference data into memory once at boot (cached). Lives in lib/ (not a
// *.service.js) so it may read the filesystem; services receive the cached object.
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function readJson(p, fallback) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
}

// Static config (catalogue, forms, reference data) is sourced from seed/ so edits always
// apply without a store reset; mutable collections (applications, documents, …) use store/.
export async function loadCatalogue(dataDir) {
  const fromSeed = await readJson(path.join(dataDir, 'seed', 'catalogue.json'), null);
  if (fromSeed != null) return fromSeed;
  return readJson(path.join(dataDir, 'store', 'catalogue.json'), []);
}

export async function loadReferenceData(dataDir) {
  const storeDir = path.join(dataDir, 'store', 'reference');
  const seedDir = path.join(dataDir, 'seed', 'reference');
  // Prefer seed (source of truth) then fall back to store.
  const pick = async (name, fb) => {
    const fromSeed = await readJson(path.join(seedDir, name), null);
    if (fromSeed != null) return fromSeed;
    return readJson(path.join(storeDir, name), fb);
  };
  return {
    regions: await pick('regions.json', []),
    localAuthorities: await pick('local-authorities.json', []),
    feeSchedules: await pick('fee-schedules.json', []),
    documentTypes: await pick('document-types.json', []),
    reasonCodes: await pick('reason-codes.json', {}),
    // GRO civil-registration list (Minister's change #3). Entirely file-driven: the
    // screen renders whatever `items` contains, so completing the 24-item list is a
    // JSON edit with no code change.
    civilRegistration: await pick('civil-registration.json', { categories: [], items: [], expectedTotal: 0 }),
  };
}
