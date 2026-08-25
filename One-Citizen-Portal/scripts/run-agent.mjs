#!/usr/bin/env node
// Launch the AskGov agent service from its own venv. Replaces the two platform-specific
// npm scripts (dev:agent / dev:agent:posix) that hardcoded Scripts/ vs bin/ — this picks
// the right interpreter itself, so `npm run dev:all` works the same on Windows and POSIX.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICE = path.join(ROOT, 'service');
const isWin = process.platform === 'win32';
const py = isWin
  ? path.join(SERVICE, '.venv', 'Scripts', 'python.exe')
  : path.join(SERVICE, '.venv', 'bin', 'python');

if (!existsSync(py)) {
  console.error(
    `No virtualenv at ${path.relative(ROOT, py)}.\nRun \`npm run bootstrap\` first.`,
  );
  process.exit(1);
}

const host = process.env.AGENT_HOST || '127.0.0.1';
const port = process.env.AGENT_PORT || '4100';

const child = spawn(
  py,
  ['-m', 'uvicorn', 'app.main:app', '--host', host, '--port', port, '--reload'],
  { cwd: SERVICE, stdio: 'inherit' },
);

child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
