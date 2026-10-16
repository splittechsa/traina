// Daily steps from the phone's motion coprocessor (CoreMotion via expo-sensors Pedometer).
// iPhone keeps 7 days of step history on-device, so "today" and the week are exact device
// counts, not estimates. While the screen is open, a live subscription adds steps as they
// happen; the totals are re-read from CoreMotion whenever the app returns to foreground.
import { useCallback, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useFocusEffect } from 'expo-router';
import { lastDays } from './steps';

export type StepsState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'ready'; today: number; week: number[]; historySupported: boolean; updatedAt: number };

export function useSteps(days = 7) {
  const [state, setState] = useState<StepsState>({ status: 'loading' });
  const subscription = useRef<{ remove: () => void } | null>(null);
  const base = useRef(0);
  const focused = useRef(false);

  const stopLive = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        if (focused.current) setState({ status: 'unavailable' });
        return;
      }
      let permission = await Pedometer.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        if (focused.current) setState({ status: 'denied', canAskAgain: permission.canAskAgain });
        return;
      }

      const now = new Date();
      // Range queries are iOS-only in expo-sensors; Android gets live counting for this session.
      const historySupported = Platform.OS === 'ios';
      let week: number[] = Array.from({ length: days }, () => 0);
      if (historySupported) {
        week = await Promise.all(
          lastDays(now, days).map(async ({ start, end }) => {
            try {
              return (await Pedometer.getStepCountAsync(start, end)).steps;
            } catch {
              return 0;
            }
          }),
        );
      }
      if (!focused.current) return;
      base.current = week[week.length - 1] ?? 0;
      setState({ status: 'ready', today: base.current, week, historySupported, updatedAt: Date.now() });

      stopLive();
      const dayKey = now.toDateString();
      subscription.current = Pedometer.watchStepCount((result) => {
        // Stop carrying yesterday's live baseline across midnight. The next focus/foreground
        // refresh reads the new day's authoritative device count.
        if (new Date().toDateString() !== dayKey) {
          stopLive();
          setState({ status: 'loading' });
          return;
        }
        setState((previous) => {
          if (previous.status !== 'ready') return previous;
          const today = base.current + result.steps;
          const week2 = previous.week.slice();
          week2[week2.length - 1] = today;
          return { ...previous, today, week: week2, updatedAt: Date.now() };
        });
      });
    } catch {
      if (focused.current) setState({ status: 'unavailable' });
    }
  }, [days, stopLive]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    const initial = setTimeout(() => void refresh(), 0);
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
      else stopLive();
    });
    return () => {
      clearTimeout(initial);
      focused.current = false;
      listener.remove();
      stopLive();
    };
  }, [refresh, stopLive]));

  return { state, refresh };
}
