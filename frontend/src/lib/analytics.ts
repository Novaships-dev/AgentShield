/**
 * Plausible analytics helper.
 * Domain: agentshield.one
 */

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void
  }
}

/**
 * Track a custom event with Plausible.
 * Safe to call server-side (no-ops in non-browser environments).
 */
export function track(
  event: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return
  if (!window.plausible) return
  window.plausible(event, props ? { props } : undefined)
}

// Pre-defined event names for type safety across the codebase
export const EVENTS = {
  SIGNUP_STARTED: 'Signup Started',
  SETUP_COMPLETED: 'Setup Completed',
  API_KEY_COPIED: 'API Key Copied',
  SDK_INSTALLED: 'SDK Installed',
  FIRST_EVENT_RECEIVED: 'First Event Received',
  CHECKOUT_STARTED: 'Checkout Started',
  REPORT_GENERATED: 'Report Generated',
  REPLAY_VIEWED: 'Replay Viewed',
  GUARDRAIL_CREATED: 'Guardrail Created',
  ALERT_CREATED: 'Alert Created',
  DOCS_VIEWED: 'Docs Viewed',
  HERO_CTA_CLICKED: 'Hero CTA Clicked',
  PRICING_CTA_CLICKED: 'Pricing CTA Clicked',
} as const
