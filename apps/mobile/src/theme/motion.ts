import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const motion = {
  fast: 120,
  standard: 220,
  emphasis: 360,
  ambient: 700,
} as const;

export function useMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduce(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return {
    reduce,
    duration: (milliseconds: number) => (reduce ? 0 : milliseconds),
  };
}
