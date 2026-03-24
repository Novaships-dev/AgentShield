/**
 * Format a USD amount for display.
 * e.g. 0.001234 → "$0.0012"  |  1234.5 → "$1,234.50"
 */
export function formatCurrency(value: number, decimals = 4): string {
  if (value === 0) return '$0.00'
  if (value < 0.01) {
    return `$${value.toFixed(decimals)}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a timestamp for display.
 * e.g. "Mar 24, 2026 14:32"
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Format a number of tokens for display.
 * e.g. 1234567 → "1.2M"
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
