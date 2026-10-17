import { describe, expect, it } from 'vitest';
import { messageFor } from './errors';

describe('api errors', () => {
  it('localizes the unconfigured sign-in failure', () => {
    expect(messageFor('AUTH_NOT_CONFIGURED', 'ar', 'Request failed')).toContain('غير مفعّل');
    expect(messageFor('OFFLINE', 'en', 'Request failed')).toContain('connection');
    expect(messageFor('OFFLINE', 'ar', 'Request failed')).toContain('الاتصال');
    expect(messageFor('TIMEOUT', 'ar', 'Request failed')).toContain('وقتاً');
    expect(messageFor('INVALID_CODE', 'ar', 'Request failed')).toContain('الرمز');
    expect(messageFor('CODE_EXPIRED', 'en', 'Request failed')).toContain('expired');
    expect(messageFor('UNKNOWN', 'en', 'Request failed')).toBe('Request failed');
    expect(messageFor('NOTHING_TO_COPY', 'ar', 'Request failed')).toContain('لا توجد وجبات');
    expect(messageFor('DIARY_DAY_NOT_EMPTY', 'en', 'Request failed')).toContain('already has logged food');
  });
});
