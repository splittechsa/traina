import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

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
