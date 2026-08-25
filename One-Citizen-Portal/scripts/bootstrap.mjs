#!/usr/bin/env node
// One-command setup for the whole repo. Because each app owns its own dependency tree
// (no npm workspaces — see .npmrc), a fresh clone needs an install per app plus a Python
// venv for the agent service. This script does all of it, cross-platform.
//
//   node scripts/bootstrap.mjs              # node apps + python service
//   node scripts/bootstrap.mjs --node-only  # skip the python service
//
// Idempotent: safe to re-run after pulling dependency changes.
import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const nodeOnly = process.argv.includes('--node-only');

// shared/ must be installed first: backend and frontend depend on it via file:../shared,
// and npm resolves that symlink target at install time.
const NODE_APPS = ['shared', 'backend', 'frontend'];

function run(cmd, args, cwd) {
  const label = `${path.relative(ROOT, cwd) || '.'}$ ${cmd} ${args.join(' ')}`;
  console.log(`\n→ ${label}`);
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin });
  if (res.status !== 0) {
    console.error(`\n✗ failed: ${label}`);
    process.exit(res.status ?? 1);
  }
}

/** Seed a local .env from .env.example so a fresh clone boots without hand-editing. */
function seedEnv(dir) {
  const env = path.join(dir, '.env');
  const example = path.join(dir, '.env.example');
  if (!existsSync(env) && existsSync(example)) {
    copyFileSync(example, env);
    console.log(`  created ${path.relative(ROOT, env)} from .env.example — review its values`);
  }
}

console.log('oneCitizen bootstrap');
console.log(`node ${process.version} on ${process.platform}`);

// ── Node apps ────────────────────────────────────────────────────────────────
run('npm', ['install'], ROOT); // root: orchestration devDeps (concurrently) only
for (const app of NODE_APPS) {
  const dir = path.join(ROOT, app);
  // `npm ci` needs a lockfile; fall back to `install` on the very first run.
  const hasLock = existsSync(path.join(dir, 'package-lock.json'));
  run('npm', [hasLock ? 'ci' : 'install'], dir);
  seedEnv(dir);
}

// ── AskGov agent service (Python) ────────────────────────────────────────────
if (nodeOnly) {
  console.log('\n--node-only: skipping the Python agent service.');
} else {
  const svc = path.join(ROOT, 'service');
  const venv = path.join(svc, '.venv');
  const py = isWin ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');

  if (!existsSync(py)) run(isWin ? 'python' : 'python3', ['-m', 'venv', '.venv'], svc);
  run(py, ['-m', 'pip', 'install', '--upgrade', 'pip'], svc);
  run(py, ['-m', 'pip', 'install', '-r', 'requirements.txt'], svc);
  seedEnv(svc);
}

console.log(`
✓ Bootstrap complete.

  npm run dev       backend :4000 + frontend :5173
  npm run dev:all   ... plus the AskGov agent on :4100

Review the generated .env files before first boot — the agent service needs
OPENAI_API_KEY (it falls back to a deterministic agent without one), and
service/.env JWT_SECRET must match backend/.env JWT_SECRET.
`);
