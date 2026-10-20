import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, process.argv[2] ?? 'docs/evidence/launch-2026-10-20');
mkdirSync(output, { recursive: true });
const checks = [
  ['build', 'npm run build', root],
  ['typecheck', 'npm run typecheck', root],
  ['backend-tests', 'npm test', root],
  ['mobile-typecheck', 'npm run typecheck', resolve(root, 'apps/mobile')],
  ['mobile-tests', 'npm test -- --maxWorkers=1', resolve(root, 'apps/mobile')],
  ['mobile-lint', 'npm run lint', resolve(root, 'apps/mobile')],
  ['coach-build', 'npm run build', resolve(root, 'apps/coach-portal')],
  ['http-smoke', 'node scripts/launch-http-smoke.mjs '+JSON.stringify(resolve(output, 'http-smoke.json')), root],
];
const results = [];
for (const [id, command, cwd] of checks) {
  const started = Date.now();
  const result = spawnSync(command, { cwd, shell: true, encoding: 'utf8', env: process.env, maxBuffer: 20 * 1024 * 1024 });
  writeFileSync(resolve(output, id + '.txt'), (result.stdout ?? '') + (result.stderr ?? ''));
  const record = { id, command, exitCode: result.status, status: result.status === 0 ? 'PASS' : 'FAILED', durationMs: Date.now() - started };
  results.push(record);
  console.log(JSON.stringify(record));
}
writeFileSync(resolve(output, 'validation-summary.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  scope: 'Local synthetic checks; no physical device, production write or remote CI verification', results }, null, 2));
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1;
