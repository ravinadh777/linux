// CLI: `npm run seed:reset` — restore data/store from data/seed (destructive).
// Resolves the data dir through config/env.js so it honours DATA_DIR exactly like the server.
import { dataDir } from '../config/env.js';
import { resetStore } from './seed.js';

resetStore(dataDir)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`Store reset from seed at ${dataDir}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed reset failed:', err);
    process.exit(1);
  });
