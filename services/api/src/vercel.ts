import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { buildApp } from './app.js';
import { coachRuntimeFromEnv } from './coach/provider.js';
import { createPgDatabase } from './db/database.js';

/** Request-scoped Neon connections: no sockets, work or migration jobs survive the response. */
export async function vercelHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = process.env.DATABASE_URL;
  const tokenSecret = process.env.SAHHTI_TOKEN_SECRET;
  if (!url || !tokenSecret || tokenSecret.length < 32) {
    response.statusCode = 503; response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ error: { code: 'STAGING_NOT_CONFIGURED' } })); return;
  }
  const db = createPgDatabase(url, { maxConnections: 2 });
  const app = buildApp({ authMode: 'session', database: db, databaseKind: 'postgres', tokenSecret, mailbox: 'none', coach: coachRuntimeFromEnv(process.env) });
  try {
    await app.ready();
    await new Promise<void>((resolve) => {
      response.once('finish', resolve); response.once('close', resolve);
      app.server.emit('request', request, response);
    });
  } catch {
    console.error(JSON.stringify({ service: 'traina-api', error: 'SERVERLESS_REQUEST_FAILED', incident: randomUUID() }));
    if (!response.headersSent) { response.statusCode = 503; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } })); }
    else response.end();
  } finally {
    try { await app.close(); } finally { await db.close(); }
  }
}
