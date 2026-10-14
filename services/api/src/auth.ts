import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '@sahhti/domain';

export type DevClaims = {
  sub: string;
  roles: Role[];
  gymOrganizationIds: string[];
  exp: number;
  sid?: string;
};

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function signDevToken(secret: string, claims: DevClaims): string {
  const body = encode(JSON.stringify(claims));
  return `${body}.${sign(secret, body)}`;
}

export function verifyDevToken(secret: string, token: string, nowMs = Date.now()): DevClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const body = parts[0];
  const signature = parts[1];
  if (body === undefined || signature === undefined || body.length === 0 || signature.length === 0) {
    return null;
  }
  const expected = sign(secret, body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<DevClaims>;
    if (typeof parsed.sub !== 'string' || !Array.isArray(parsed.roles) || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp * 1000 <= nowMs) {
      return null;
    }
    return {
      sub: parsed.sub,
      roles: parsed.roles,
      gymOrganizationIds: Array.isArray(parsed.gymOrganizationIds) ? parsed.gymOrganizationIds.filter((id) => typeof id === 'string') : [],
      exp: parsed.exp,
      ...(typeof parsed.sid === 'string' ? { sid: parsed.sid } : {}),
    };
  } catch {
    return null;
  }
}
