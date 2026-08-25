// Seed loader: on first boot, copy data/seed → data/store for any file not
// already present in store (so runtime state is never clobbered). See Architecture §8.
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function copyRecursive(srcDir, destDir, { overwrite = false } = {}) {
  let entries;
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return; // no seed dir — nothing to do
    throw err;
  }
  await fs.mkdir(destDir, { recursive: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(src, dest, { overwrite });
    } else {
      const exists = await fileExists(dest);
      if (overwrite || !exists) await fs.copyFile(src, dest);
    }
  }
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Ensure the store is seeded (idempotent; preserves existing runtime files). */
export async function ensureSeeded(dataDir) {
  const seedDir = path.join(dataDir, 'seed');
  const storeDir = path.join(dataDir, 'store');
  await copyRecursive(seedDir, storeDir, { overwrite: false });
}

/** Reset: wipe store contents (except .gitkeep) and re-copy seed. Destructive. */
export async function resetStore(dataDir) {
  const storeDir = path.join(dataDir, 'store');
  try {
    const entries = await fs.readdir(storeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.gitkeep') continue;
      await fs.rm(path.join(storeDir, entry.name), { recursive: true, force: true });
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  await copyRecursive(path.join(dataDir, 'seed'), storeDir, { overwrite: true });
}
