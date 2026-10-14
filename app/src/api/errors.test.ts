import { describe, expect, it } from 'vitest';
import { messageFor } from './errors';

describe('api errors', () => {
  it('localizes the unconfigured sign-in failure', () => {
    expect(messageFor('AUTH_NOT_CONFIGURED', 'ar', 'Request failed')).toContain('غير مفعّل');
    expect(messageFor('OFFLINE', 'en', 'Request failed')).toContain('connection');
    expect(messageFor('OFFLINE', 'ar', 'Request failed')).toContain('الاتصال');
    expect(messageFor('INVALID_CODE', 'ar', 'Request failed')).toContain('الرمز');
    expect(messageFor('CODE_EXPIRED', 'en', 'Request failed')).toContain('expired');
    expect(messageFor('UNKNOWN', 'en', 'Request failed')).toBe('Request failed');
  });
});
