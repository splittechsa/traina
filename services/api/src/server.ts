import { coachRuntimeFromEnv } from './coach/provider.js';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgDatabase, createPgliteDatabase, openConfiguredDatabase, postgresTransport, sanitizeDatabaseError } from './db/database.js';

const databaseUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.DATABASE_URL_UNPOOLED;
const pgliteDir = process.env.SAHHTI_PGLITE_DIR;
let opened: Awaited<ReturnType<typeof openConfiguredDatabase>>;
try {
  opened = await openConfiguredDatabase(
    { databaseUrl, migrationUrl, pgliteDir, nodeEnv: process.env.NODE_ENV },
    { postgres: createPgDatabase, pglite: createPgliteDatabase, migrate: (db) => applyMigrationsTo(db) },
  );
} catch (error) {
  console.error(JSON.stringify({ service: 'sahhti-api', error: sanitizeDatabaseError(error) }));
  process.exit(1);
}
const database = opened.database;

const tokenSecret = process.env.SAHHTI_TOKEN_SECRET ?? process.env.SAHHTI_DEV_TOKEN_SECRET;
const authMode =
  database !== null && process.env.SAHHTI_AUTH_MODE !== 'hmac_dev' && tokenSecret !== undefined
    ? 'session'
    : process.env.SAHHTI_AUTH_MODE === 'hmac_dev'
      ? 'hmac_dev'
      : 'unconfigured';

const coach = coachRuntimeFromEnv(process.env);
const app = buildApp({
  authMode,
  database,
  databaseKind: opened.kind,
  tokenSecret,
  devTokenSecret: process.env.SAHHTI_DEV_TOKEN_SECRET,
  mailbox: process.env.NODE_ENV === 'production' ? 'none' : 'outbox',
  coachProvider: coach.name === 'development_mock' ? 'development_mock' : 'unconfigured',
  coach,
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0', exclusive: true });
console.log(JSON.stringify({
  service: 'sahhti-api',
  port,
  auth: authMode,
  database: opened.kind,
  transport: opened.kind === 'postgres' && databaseUrl !== undefined && databaseUrl.length > 0 ? postgresTransport(databaseUrl) : opened.kind,
}));
