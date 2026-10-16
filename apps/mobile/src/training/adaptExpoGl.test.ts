import { describe, expect, it } from 'vitest';
import { adaptExpoGl } from './adaptExpoGl';

class FakeWebGLRenderingContext {
  getContextAttributes(): unknown {
    return null;
  }
  clear() {
    return 'cleared';
  }
}

describe('adaptExpoGl', () => {
  it('hides the WebGL 1 constructor from Three.js and keeps GPU methods bound', () => {
    const raw = new FakeWebGLRenderingContext();
    expect(raw instanceof FakeWebGLRenderingContext).toBe(true);
    const adapted = adaptExpoGl(raw);
    expect(adapted instanceof FakeWebGLRenderingContext).toBe(false);
    expect(typeof WebGLRenderingContext !== 'undefined' && adapted instanceof WebGLRenderingContext).toBe(false);
    expect(adapted.getContextAttributes()).toEqual(expect.objectContaining({ alpha: true, depth: true }));
    expect(adapted.clear()).toBe('cleared');
  });
});
