/** Content height of the tab bar before the home-indicator padding is added inside it. */
export const TAB_BAR_BODY = 48;

/**
 * Space a tab screen must keep clear at the bottom.
 * Once the bar has laid out, its height already includes the home-indicator padding,
 * so the inset is not added a second time. Before layout, reserve the body plus the inset.
 */
export function tabBarClearance(bottomInset: number, measuredHeight: number): number {
  if (measuredHeight > 0) return measuredHeight;
  return TAB_BAR_BODY + Math.max(0, bottomInset);
}
