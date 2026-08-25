// Low-level JSON file store: in-memory cache, crash-safe atomic writes, append-only support.
// One JsonStore == one collection file. Writers are serialized by the owning repository's mutex.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export class JsonStore {
  constructor(filePath, { appendOnly = false } = {}) {
    this.filePath = filePath;
    this.appendOnly = appendOnly;
    this.data = null;         // in-memory array cache
    this.loaded = false;
    this.dirty = false;
    this.deferPersist = false; // true while enlisted in a transaction
  }

  async load() {
    if (this.loaded) return;
    // Dedupe concurrent first-time loads so they don't race on the initial file write.
    if (!this._loading) {
      this._loading = this._doLoad().finally(() => {
        this._loading = null;
      });
    }
    return this._loading;
  }

  async _doLoad() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.data = [];
        await this._writeFile(this.data);
      } else {
        throw err;
      }
    }
    this.loaded = true;
  }

  async _writeFile(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await this._rename(tmp, this.filePath); // atomic on same volume
  }

  // Windows can transiently return EPERM/EACCES/EEXIST on rename (AV / open handles).
  async _rename(tmp, dest, attempts = 6) {
    for (let i = 0; i < attempts; i++) {
      try {
        await fs.rename(tmp, dest);
        return;
      } catch (err) {
        const transient = err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EEXIST';
        if (transient && i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 10 * (i + 1)));
          continue;
        }
        // best-effort cleanup of the temp file before surfacing the error
        try {
          await fs.rm(tmp, { force: true });
        } catch {
          /* ignore */
        }
        throw err;
      }
    }
  }

  /** Persist the cache to disk, unless deferred by an active transaction. */
  async persist() {
    if (this.deferPersist) {
      this.dirty = true;
      return;
    }
    await this._writeFile(this.data);
    this.dirty = false;
  }

  snapshot() {
    return JSON.stringify(this.data);
  }
  restore(snap) {
    this.data = JSON.parse(snap);
    this.dirty = false;
  }
}
