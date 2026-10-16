// One snapping column of a wheel picker.
//
// Rendered with an Animated.ScrollView rather than a FlatList on purpose: every screen
// already lives inside a vertical ScrollView (ScreenBody), and nesting a VirtualizedList in a
// same-orientation ScrollView is exactly what produced "VirtualizedLists should never be nested
// inside plain ScrollViews" on device. Columns are short (the longest is ~270 rows for whole
// kilograms), so virtualization buys nothing here anyway.
//
// Interaction model mirrors UIPickerView: rows scale/fade by distance from the selection band
// on the UI thread, a light selection haptic ticks each time a new row crosses the band, and
// the value is committed when the scroll settles.
import { memo, useCallback, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../../theme/ThemeProvider';
import { useMotion } from '../../theme/motion';
import { fontFamily, typeScale } from '../../theme/tokens';
import { tapSelection } from '../haptics';
import { snapIndex } from './wheelMath';

const HAPTIC_MIN_INTERVAL_MS = 35;

const Row = memo(function Row({
  label,
  index,
  scrollY,
  itemHeight,
  color,
  fontSize,
}: {
  label: string;
  index: number;
  scrollY: SharedValue<number>;
  itemHeight: number;
  color: string;
  fontSize: number;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollY.value / itemHeight - index);
    return {
      opacity: interpolate(distance, [0, 1, 2, 3], [1, 0.55, 0.28, 0.12], Extrapolation.CLAMP),
      transform: [
        { perspective: 600 },
        { rotateX: `${interpolate(scrollY.value / itemHeight - index, [-3, 0, 3], [52, 0, -52], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(distance, [0, 1, 2], [1, 0.86, 0.74], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View style={[{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text
        allowFontScaling={false}
        style={{ color, fontFamily: fontFamily.semibold, fontSize, fontVariant: ['tabular-nums'] }}
      >
        {label}
      </Text>
    </Animated.View>
  );
});

export type WheelColumnProps = {
  labels: readonly string[];
  /** Controlled selected index. */
  index: number;
  /** Fires once the wheel settles on a row (not on every tick). */
  onIndexChange: (index: number) => void;
  itemHeight: number;
  visibleCount: number;
  minWidth?: number;
  fontSize?: number;
  testID?: string;
};

export function WheelColumn({
  labels,
  index,
  onIndexChange,
  itemHeight,
  visibleCount,
  minWidth = 56,
  fontSize = typeScale.title,
  testID,
}: WheelColumnProps) {
  const theme = useTheme();
  const { reduce } = useMotion();
  const ref = useRef<Animated.ScrollView>(null);
  const padding = itemHeight * Math.floor(visibleCount / 2);
  const scrollY = useSharedValue(index * itemHeight);
  const lastTick = useSharedValue(index);
  const settledIndex = useRef(index);
  const momentum = useRef(false);
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHaptic = useRef(0);

  // External value changes (initial load, typed entry, VoiceOver adjust) move the wheel.
  useEffect(() => {
    if (index === settledIndex.current) return;
    settledIndex.current = index;
    lastTick.value = index;
    ref.current?.scrollTo({ y: index * itemHeight, animated: !reduce });
  }, [index, itemHeight, lastTick, reduce]);

  const tick = useCallback(() => {
    const now = Date.now();
    if (now - lastHaptic.current < HAPTIC_MIN_INTERVAL_MS) return;
    lastHaptic.current = now;
    tapSelection(reduce);
  }, [reduce]);

  const settle = useCallback(
    (next: number) => {
      if (dragTimer.current !== null) {
        clearTimeout(dragTimer.current);
        dragTimer.current = null;
      }
      momentum.current = false;
      if (next === settledIndex.current) return;
      settledIndex.current = next;
      onIndexChange(next);
    },
    [onIndexChange],
  );

  const endDrag = useCallback(
    (next: number) => {
      // A slow release can snap without a momentum phase; commit if none starts shortly.
      if (dragTimer.current !== null) clearTimeout(dragTimer.current);
      dragTimer.current = setTimeout(() => {
        if (!momentum.current) settle(next);
      }, 220);
    },
    [settle],
  );

  const beginMomentum = useCallback(() => {
    momentum.current = true;
  }, []);

  useEffect(
    () => () => {
      if (dragTimer.current !== null) clearTimeout(dragTimer.current);
    },
    [],
  );

  const count = labels.length;
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const next = Math.min(count - 1, Math.max(0, Math.round(event.contentOffset.y / itemHeight)));
      if (next !== lastTick.value) {
        lastTick.value = next;
        scheduleOnRN(tick);
      }
    },
    onEndDrag: (event) => {
      scheduleOnRN(endDrag, Math.min(count - 1, Math.max(0, Math.round(event.contentOffset.y / itemHeight))));
    },
    onMomentumBegin: () => {
      scheduleOnRN(beginMomentum);
    },
    onMomentumEnd: (event) => {
      scheduleOnRN(settle, Math.min(count - 1, Math.max(0, Math.round(event.contentOffset.y / itemHeight))));
    },
  });

  return (
    <View testID={testID} style={{ height: itemHeight * visibleCount, minWidth }}>
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        nestedScrollEnabled
        contentOffset={{ x: 0, y: snapIndex(index * itemHeight, itemHeight, count) * itemHeight }}
        contentContainerStyle={{ paddingVertical: padding }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {labels.map((label, i) => (
          <Row key={`${i}-${label}`} label={label} index={i} scrollY={scrollY} itemHeight={itemHeight} color={theme.text} fontSize={fontSize} />
        ))}
      </Animated.ScrollView>
    </View>
  );
}
