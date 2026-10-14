import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

function readPostgresEnv(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== 'DATABASE_URL' && key !== 'DATABASE_URL_UNPOOLED' && !key.startsWith('SAHHTI_COACH_')) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) values[key] = value;
  }
  return values;
}

const secretPath = '.data/dev-token-secret';
if (!existsSync(secretPath)) {
  mkdirSync('.data', { recursive: true });
  writeFileSync(secretPath, randomBytes(32).toString('hex'));
}
const secret = readFileSync(secretPath, 'utf8').trim();
const postgresEnv = readPostgresEnv('.env');
const databaseUrl = process.env.DATABASE_URL ?? postgresEnv.DATABASE_URL;
const unpooled = process.env.DATABASE_URL_UNPOOLED ?? postgresEnv.DATABASE_URL_UNPOOLED;
const env = {
  ...process.env,
  NODE_ENV: 'development',
  SAHHTI_TOKEN_SECRET: process.env.SAHHTI_TOKEN_SECRET ?? secret,
  PORT: process.env.PORT ?? '3040',
};
for (const key of ['SAHHTI_COACH_PROVIDER', 'SAHHTI_COACH_API_KEY', 'SAHHTI_COACH_BASE_URL', 'SAHHTI_COACH_MODEL']) {
  if (postgresEnv[key] !== undefined && (env[key] === undefined || env[key] === '')) env[key] = postgresEnv[key];
}
if (databaseUrl !== undefined && databaseUrl.length > 0) {
  env.DATABASE_URL = databaseUrl;
  if (unpooled !== undefined && unpooled.length > 0) env.DATABASE_URL_UNPOOLED = unpooled;
  delete env.SAHHTI_PGLITE_DIR;
} else {
  env.SAHHTI_PGLITE_DIR = process.env.SAHHTI_PGLITE_DIR ?? '.data/pglite';
}
const child = spawn(process.execPath, ['services/api/dist/server.js'], {
  env,
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
