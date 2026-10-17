import { describe, expect, it } from 'vitest';
import { label } from './labels';

describe('user-facing labels', () => {
  it('translates goals and hides unknown enums', () => {
    expect(label('ar', 'goal', 'cutting')).toBe('تنشيف');
    expect(label('en', 'goal', 'cutting')).toBe('Cutting');
    expect(label('ar', 'goal', 'not_a_real_goal')).toBe('غير محدد');
    expect(label('en', 'discipline', 'general_fitness')).not.toBe('general_fitness');
    expect(label('ar', 'activityKind', 'boxing')).toBe('ملاكمة');
    expect(label('ar', 'meal', 'breakfast')).toBe('وجبة الفطور');
  });
});
