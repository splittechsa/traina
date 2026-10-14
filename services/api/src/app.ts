import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  DomainError,
  PLATFORM_CAPABILITIES,
  calculateCommissionPosting,
  summarizeDiary,
  validateOnboarding,
  type OnboardingInput,
} from '@sahhti/domain';
import {
  commissionQuoteRequestSchema,
  diarySummaryRequestSchema,
  onboardingRequestSchema,
} from '@sahhti/contracts';
import { verifyDevToken, type DevClaims } from './auth.js';
import { pingDatabase, sanitizeDatabaseError, type Database } from './db/database.js';
import { ApiError, assertLiveSession, loadActor } from './identity/accounts.js';
import type { CoachRuntime } from './coach/provider.js';
import { registerProductRoutes } from './routes/product.js';

declare module 'fastify' {
  interface FastifyRequest {
    claims: DevClaims | null;
  }
}

export type AppOptions = {
  authMode: 'unconfigured' | 'hmac_dev' | 'session';
  devTokenSecret?: string;
  tokenSecret?: string;
  database?: Database | null;
  databaseKind?: 'postgres' | 'pglite' | 'none';
  coachProvider?: 'development_mock' | 'unconfigured';
  coach?: CoachRuntime;
  fetchImpl?: typeof fetch;
  mailbox?: 'outbox' | 'none';
};

const PUBLIC_PATHS = new Set([
  '/v1/health',
  '/v1/ready',
  '/v1/meta',
  '/v1/auth/register',
  '/v1/auth/verify',
  '/v1/auth/verify/resend',
  '/v1/auth/login',
  '/v1/auth/refresh',
  '/v1/auth/recover',
  '/v1/auth/reset',
  '/v1/dev/mailbox',
]);

function sendError(reply: FastifyReply, status: number, code: string, message?: string) {
  return reply.code(status).send({ error: { code, message: message ?? code } });
}

export function buildApp(options: AppOptions): FastifyInstance {
  if (options.authMode === 'hmac_dev') {
    if (options.devTokenSecret === undefined || options.devTokenSecret.length < 16) {
      throw new Error('hmac_dev requires a dev token secret of at least 16 characters');
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('hmac_dev auth cannot run in production');
    }
  }
  if (options.authMode === 'session') {
    if (options.database == null || options.tokenSecret === undefined || options.tokenSecret.length < 16) {
      throw new Error('session auth requires a database and token secret');
    }
    if (process.env.NODE_ENV === 'production' && options.mailbox === 'outbox') {
      throw new Error('outbox mailbox cannot run in production');
    }
  }

  const app = Fastify({ logger: false });
  const database = options.database ?? null;
  const sessionSecret = options.tokenSecret;

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof DomainError) {
      return reply.code(422).send({ error: { code: error.code, message: error.message } });
    }
    if (process.env.NODE_ENV !== 'production') console.error(sanitizeDatabaseError(error));
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
      const message = error instanceof Error ? error.message : 'Request could not be read';
      return reply.code(statusCode).send({ error: { code: statusCode === 400 ? 'VALIDATION' : 'HTTP', message } });
    }
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Unexpected error' } });
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', randomUUID());
    const path = request.url.split('?')[0] ?? '';
    if (PUBLIC_PATHS.has(path)) {
      request.claims = null;
      return;
    }
    if (options.authMode === 'session' && database !== null && sessionSecret !== undefined) {
      const header = request.headers.authorization;
      if (header === undefined || !header.startsWith('Bearer ')) {
        return sendError(reply, 401, 'UNAUTHENTICATED');
      }
      const claims = verifyDevToken(sessionSecret, header.slice('Bearer '.length));
      if (claims?.sid === undefined) {
        return sendError(reply, 401, 'UNAUTHENTICATED');
      }
      try {
        await assertLiveSession(database, claims.sid, claims.sub);
      } catch {
        return sendError(reply, 401, 'UNAUTHENTICATED');
      }
      const actor = await loadActor(database, claims.sub);
      if (actor === null) {
        return sendError(reply, 401, 'UNAUTHENTICATED');
      }
      request.claims = {
        sub: actor.userId,
        sid: claims.sid,
        roles: [...actor.roles],
        gymOrganizationIds: [...actor.gymOrganizationIds],
        exp: claims.exp,
      };
      return;
    }
    if (options.authMode === 'unconfigured' || options.devTokenSecret === undefined) {
      return sendError(reply, 503, 'AUTH_NOT_CONFIGURED', 'Production identity provider is not configured');
    }
    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith('Bearer ')) {
      return sendError(reply, 401, 'UNAUTHENTICATED');
    }
    const claims = verifyDevToken(options.devTokenSecret, header.slice('Bearer '.length));
    if (claims === null) {
      return sendError(reply, 401, 'UNAUTHENTICATED');
    }
    request.claims = claims;
  });

  app.get('/v1/health', async () => ({
    live: true,
    service: 'sahhti-api',
    auth: options.authMode,
    database: options.databaseKind ?? (database === null ? 'none' : 'configured'),
  }));

  app.get('/v1/ready', async (_request, reply) => {
    const missing: string[] = [];
    if (database === null) {
      missing.push('database');
    } else {
      try {
        await pingDatabase(database, { attempts: 3 });
      } catch {
        missing.push('database');
      }
    }
    if (options.authMode !== 'session') {
      missing.push('production_auth');
    }
    missing.push('store_verifier');
    return reply.code(missing.length === 0 ? 200 : 503).send({ ready: missing.length === 0, missing });
  });

  app.get('/v1/meta', async () => ({ capabilities: PLATFORM_CAPABILITIES }));

  app.post('/v1/onboarding/validate', async (request, reply) => {
    const parsed = onboardingRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, parsed.error);
    }
    const result = validateOnboarding(parsed.data as OnboardingInput);
    return reply.code(result.ok ? 200 : 422).send({
      persisted: false,
      authority: 'domain_validation',
      result,
    });
  });

  app.post('/v1/nutrition/diary/summarize', async (request, reply) => {
    const parsed = diarySummaryRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, parsed.error);
    }
    const summary = summarizeDiary(null, parsed.data.entries);
    return {
      persisted: false,
      authority: 'domain_arithmetic',
      target: null,
      summary,
    };
  });

  app.post('/v1/partnerships/commissions/quote', async (request, reply) => {
    const parsed = commissionQuoteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, parsed.error);
    }
    try {
      const posting = calculateCommissionPosting({
        purpose: 'quote',
        policy: parsed.data.policy,
        charge: { ...parsed.data.charge, verifier: 'test_fixture' },
        gymOrganizationId: parsed.data.gymOrganizationId,
        attributionId: parsed.data.attributionId,
        priorPostings: parsed.data.priorPaymentEventIds.map((paymentEventId: string) => ({
          paymentEventId,
          kind: 'accrual' as const,
        })),
        taxPolicy: parsed.data.taxPolicy,
        allowTestFixtures: false,
      });
      return {
        persisted: false,
        authority: 'domain_quote',
        priorsSource: 'request_body',
        settlementAllowed: false,
        posting,
      };
    } catch (error) {
      return domainError(reply, error);
    }
  });

  app.post('/v1/internal/commissions/settle', async (_request, reply) =>
    sendError(reply, 503, 'LEDGER_DATABASE_REQUIRED', 'Settlement cannot be posted until the ledger database is configured and verified'),
  );

  app.post('/v1/internal/billing/verify', async (_request, reply) =>
    sendError(reply, 501, 'STORE_VERIFIER_NOT_CONFIGURED', 'App Store and Play billing verifiers are not configured'),
  );

  registerProductRoutes(app, {
    database,
    tokenSecret: options.authMode === 'session' ? (sessionSecret ?? null) : null,
    coachProvider: options.coachProvider ?? 'unconfigured',
    coach: options.coach,
    fetchImpl: options.fetchImpl,
    exposeDevTokens: options.mailbox === 'outbox' && process.env.NODE_ENV !== 'production',
  });

  return app;
}

function validationError(reply: FastifyReply, error: ZodError) {
  return reply.code(400).send({
    error: {
      code: 'VALIDATION',
      message: 'The request is not valid',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
    },
  });
}

function domainError(reply: FastifyReply, error: unknown) {
  if (error instanceof DomainError) {
    return sendError(reply, 422, error.code, error.message);
  }
  throw error;
}

export function claimsOf(request: FastifyRequest): DevClaims | null {
  return request.claims;
}
