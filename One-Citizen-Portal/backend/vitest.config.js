import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Quiet logs and deterministic env for tests. Tests ALWAYS use the JSON driver for
    // isolation + speed, regardless of what backend/.env selects (set before env.js loads;
    // dotenv never overrides an already-set var). The live Postgres contract test opts back
    // in by connecting directly.
    env: { LOG_LEVEL: 'silent', NODE_ENV: 'test', PERSISTENCE_DRIVER: 'json' },
    // Serialize test files: avoids Windows EBUSY on vitest's shared transform cache and
    // contention on the per-test temp JSON stores.
    fileParallelism: false,
  },
});
