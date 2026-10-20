import {describe,it,expect} from 'vitest';
import {parseScaledInteger} from '@sahhti/domain';
import {normalizeWorkoutNumber} from './numericInput';
describe('localized workout numbers',()=>{
  it('accepts Arabic and Persian keyboards with decimal separators',()=>{
    expect(parseScaledInteger(normalizeWorkoutNumber('٧٢٫٥'),1000)).toBe(72500);
    expect(parseScaledInteger(normalizeWorkoutNumber('۷۲,۵'),1000)).toBe(72500);
    expect(Number(normalizeWorkoutNumber('١٢'))).toBe(12);
  });
  it('keeps invalid characters visible to validation instead of changing the entered weight',()=>{
    expect(()=>parseScaledInteger(normalizeWorkoutNumber('٥kg'),1000)).toThrow();
    expect(()=>parseScaledInteger(normalizeWorkoutNumber('١٫٢٫٣'),1000)).toThrow();
  });
});
