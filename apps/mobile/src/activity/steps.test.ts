import { describe, expect, it } from 'vitest';
import { averageSteps, estimateDistanceKm, goalProgress, goalStreak, lastDays, startOfLocalDay, strideMeters } from './steps';

describe('day ranges', () => {
  it('uses local midnight boundaries and ends today at now', () => {
    const now = new Date(2026, 9, 14, 15, 30);
    const ranges = lastDays(now, 3);
    expect(ranges).toHaveLength(3);
    expect(ranges[0]?.start.getTime()).toBe(new Date(2026, 9, 12).getTime());
    expect(ranges[0]?.end.getTime()).toBe(new Date(2026, 9, 13).getTime());
    expect(ranges[2]?.start.getTime()).toBe(new Date(2026, 9, 14).getTime());
    expect(ranges[2]?.end.getTime()).toBe(now.getTime());
  });

  it('handles month boundaries', () => {
    expect(startOfLocalDay(new Date(2026, 10, 1, 9), 1).getTime()).toBe(new Date(2026, 9, 31).getTime());
  });
});

describe('distance estimate', () => {
  it('uses a default stride without height and a height-based stride with it', () => {
    expect(strideMeters()).toBe(0.78);
    expect(estimateDistanceKm(10_000)).toBe(7.8);
    expect(estimateDistanceKm(10_000, 180)).toBe(7.45);
    expect(estimateDistanceKm(0)).toBe(0);
    expect(strideMeters(400)).toBe(0.78);
  });
});

describe('goal helpers', () => {
  it('clamps progress', () => {
    expect(goalProgress(4000, 8000)).toBe(0.5);
    expect(goalProgress(20_000, 8000)).toBe(1);
    expect(goalProgress(100, 0)).toBe(0);
  });

  it('counts a streak without letting an unfinished today break it', () => {
    expect(goalStreak([9000, 9000, 3000], 8000)).toBe(2);
    expect(goalStreak([9000, 3000, 9000], 8000)).toBe(1);
    expect(goalStreak([1000, 2000], 8000)).toBe(0);
  });

  it('averages', () => {
    expect(averageSteps([1000, 2000, 3000])).toBe(2000);
    expect(averageSteps([])).toBe(0);
  });
});
