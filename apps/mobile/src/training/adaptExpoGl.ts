const fallbackAttributes = {
  alpha: true,
  antialias: false,
  depth: true,
  failIfMajorPerformanceCaveat: false,
  powerPreference: 'default',
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  stencil: false,
} as const;

/**
 * Three.js r163+ throws if the passed context is `instanceof WebGLRenderingContext`.
 * Expo Go on iPhone reports a WebGL 2 context that still sits on that prototype
 * (expo/expo#51572). The proxy target is a plain object so the constructor check
 * fails, while GPU calls stay bound to the real Expo GL context.
 */
export function adaptExpoGl<T extends object>(gl: T): T {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'constructor') return Object;
        if (property === 'getContextAttributes') {
          return () => {
            const current = (gl as { getContextAttributes?: () => unknown }).getContextAttributes?.();
            return current === null || current === undefined ? fallbackAttributes : current;
          };
        }
        const value = Reflect.get(gl, property);
        return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(gl) : value;
      },
      has(_target, property) {
        return property in gl;
      },
      set(_target, property, value) {
        Reflect.set(gl, property, value);
        return true;
      },
    },
  ) as T;
}
