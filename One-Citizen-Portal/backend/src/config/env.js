// Validated environment loader — the SINGLE source of runtime configuration.
// Everything the app needs to run in any environment comes from here, so deploying to a
// new environment is an .env change, never a code change.
//
// The .env is loaded from the backend workspace root via an ABSOLUTE path (derived from
// this module's location), so config resolves identically no matter the current working
// directory (dev, `npm start`, tests, containers, cron).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Robust env boolean: "false"/"0"/"no"/"off"/"" → false, "true"/"1"/"yes"/"on" → true.
// (z.coerce.boolean() is WRONG for env: Boolean("false") === true.)
const envBool = (def) =>
  z.preprocess((v) => {
    if (typeof v === 'boolean') return v;
    if (v === undefined || v === null) return def;
    const s = String(v).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(s)) return false;
    return def;
  }, z.boolean());

const EnvSchema = z.object({
  // ── Runtime ────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // ── Auth ───────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(1).default('change-me-dev-only-not-for-production'),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(604800),

  // ── Persistence ─────────────────────────────────────────────────────────────
  // 'json'     → file-backed store under DATA_DIR (zero-setup default).
  // 'postgres' → PostgreSQL via the connection settings below (production path).
  PERSISTENCE_DRIVER: z.enum(['json', 'postgres']).default('json'),
  // Seed + runtime store root, resolved relative to the backend workspace. Containers
  // override this to a mounted volume (see infra/docker/docker-compose.yml).
  // MOCK_DATA_DIR is the pre-rename name, still honoured so old .env files keep working.
  DATA_DIR: z.string().default('../data'),
  MOCK_DATA_DIR: z.string().optional(),

  // PostgreSQL (used only when PERSISTENCE_DRIVER=postgres). DATABASE_URL wins if set;
  // otherwise the discrete PG* parts are used. Sensible localhost defaults for dev.
  DATABASE_URL: z.string().optional(),
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().default(5432),
  PGUSER: z.string().default('onecitizen'),
  PGPASSWORD: z.string().default('onecitizen'),
  PGDATABASE: z.string().default('onecitizen'),
  PGSSL: envBool(false),
  PG_POOL_MAX: z.coerce.number().default(10),
  PG_POOL_IDLE_MS: z.coerce.number().default(30000),
  PG_CONNECT_TIMEOUT_MS: z.coerce.number().default(10000),
  DB_AUTO_MIGRATE: envBool(true), // ensure tables/indexes on boot
  DB_SEED: envBool(true), // seed identities/clients if empty

  // ── Uploads / integrations ───────────────────────────────────────────────────
  MAX_UPLOAD_MB: z.coerce.number().default(25),
  MOCK_INTEGRATIONS: envBool(true),

  // Anti-virus adapter mode, consumed by context.js via createAvScanner.
  // This key was previously MISSING from the schema: `env` is the output of
  // EnvSchema.parse(), and zod strips unknown keys, so env.AV_SCANNER was always
  // undefined and setting AV_SCANNER in a .env did nothing. Behaviour was unaffected
  // (createAvScanner defaults to 'mock'), but the switch was silently unconfigurable —
  // which matters for a security control. Declared here so it actually takes effect.
  AV_SCANNER: z.enum(['mock', 'off', 'clamav', 'service']).default('mock'),

  // ── AskGov agent gateway (Ask_Agent Python service) ──────────────────────────
  AGENT_ENABLED: envBool(true),
  AGENT_SERVICE_URL: z.string().default('http://127.0.0.1:4100'),
  AGENT_TIMEOUT_MS: z.coerce.number().default(30000),
  AGENT_RATE_WINDOW_MS: z.coerce.number().default(60000),
  AGENT_RATE_MAX: z.coerce.number().default(30),
  AGENT_HISTORY_REPLAY: z.coerce.number().default(20),

});

export const env = EnvSchema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
export const isProd = env.NODE_ENV === 'production';

// Absolute data dir for the json driver. Relative values resolve against the backend
// workspace root (not the CWD) so it is identical in dev, `npm start`, tests and containers.
const BACKEND_ROOT = path.resolve(__dirname, '../..');
export const dataDir = path.resolve(BACKEND_ROOT, env.MOCK_DATA_DIR ?? env.DATA_DIR);
