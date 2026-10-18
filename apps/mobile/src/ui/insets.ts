/** Content height of the tab bar before the home-indicator padding is added inside it. */
export const TAB_BAR_BODY = 64;

/**
 * Space a tab screen must keep clear at the bottom.
 * Once the bar has laid out, its height already includes the home-indicator padding,
 * so the inset is not added a second time. Before layout, reserve the body plus the inset.
 * Extra gap covers the floating bar's `bottom` offset so "Today's summary" is not clipped.
 */
export function tabBarClearance(bottomInset: number, measuredHeight: number): number {
  if (measuredHeight > 0) return measuredHeight + 8;
  return TAB_BAR_BODY + Math.max(0, bottomInset) + 8;
}
