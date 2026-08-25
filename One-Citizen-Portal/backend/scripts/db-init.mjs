// Create the database schema (and bootstrap the service-catalogue/reference config) WITHOUT
// starting the HTTP server. Handy after a db:reset or on a fresh database so the tables exist
// immediately — the same migration the API runs on boot. Idempotent and safe to re-run.
// Run: npm run db:init
import { buildContext } from '../src/context.js';

async function run() {
  // buildContext runs the Postgres migration (create tables/indexes/FKs) and seeds only the
  // catalogue/reference config — it never creates users.
  const ctx = await buildContext();
  const { rows } = await ctx.container.registry.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name",
  );
  console.log(`\n[db:init] schema ready — ${rows.length} tables:`);
  console.log(rows.map((r) => '  • ' + r.table_name).join('\n'));
  process.exit(0);
}

run().catch((err) => { console.error('[db:init] failed:', err); process.exit(1); });
