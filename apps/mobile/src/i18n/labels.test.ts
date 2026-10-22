import { describe, expect, it } from 'vitest';
import { label } from './labels';
import { TRAIN_A_CAPABILITIES } from '@sahhti/domain';

describe('user-facing labels', () => {
  it('covers the server capability contract in both languages without exposing protocol keys', () => {
    for (const locale of ['ar','en'] as const) for (const capability of TRAIN_A_CAPABILITIES) {
      const value=label(locale,'capability',capability);
      expect(value).not.toBe(capability);expect(value).not.toBe('غير محدد');expect(value).not.toBe('Unspecified');
    }
    expect(label('ar','subscriptionStatus','free')).toBe('مجاني');
    expect(label('ar','capability','future.internal_key')).toBe('غير محدد');
  });
  it('translates goals and hides unknown enums', () => {
    expect(label('ar', 'goal', 'cutting')).toBe('تنشيف');
    expect(label('en', 'goal', 'cutting')).toBe('Cutting');
    expect(label('ar', 'goal', 'not_a_real_goal')).toBe('غير محدد');
    expect(label('en', 'discipline', 'general_fitness')).not.toBe('general_fitness');
  });
});
