// File blob storage adapter (local filesystem in the reference build; object storage in prod).
// Lives in lib/ so it may use fs; the vault service depends on this interface, not on fs.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export function createFileStorage({ dir }) {
  return {
    async save(key, buffer) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, key), buffer);
      return key;
    },
    async read(key) {
      return fs.readFile(path.join(dir, key));
    },
    async remove(key) {
      await fs.rm(path.join(dir, key), { force: true });
    },
  };
}
