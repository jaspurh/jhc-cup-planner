/**
 * Date Formatting Utilities
 * 
 * Centralized date formatting to ensure consistent output between
 * server and client (avoiding hydration mismatches).
 * 
 * MAINTAINER NOTE: All date formatting should use these functions.
 */

/**
 * Default locale for date formatting.
 * Using a fixed locale ensures consistent rendering between server and client.
 * 
 * Options:
 * - 'en-GB' for DD/MM/YYYY format
 * - 'en-US' for MM/DD/YYYY format
 * - 'da-DK' for DD.MM.YYYY format
 */
const DEFAULT_LOCALE = 'en-GB'

/**
 * Default timezone for date formatting.
 * Using UTC ensures consistent rendering regardless of server/client timezone.
 */
const DEFAULT_TIMEZONE = 'UTC'

/**
 * Format a date for display (e.g., "12 Dec 2025")
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return d.toLocaleDateString(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  })
}

/**
 * Format a date with full month name (e.g., "12 December 2025")
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return d.toLocaleDateString(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  })
}

/**
 * Format a date as short format (e.g., "12/12/2025")
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return d.toLocaleDateString(DEFAULT_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  })
}

/**
 * Format time only (e.g., "14:30")
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return d.toLocaleTimeString(DEFAULT_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIMEZONE,
  })
}

/**
 * Format date and time (e.g., "12 Dec 2025, 14:30")
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return d.toLocaleString(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIMEZONE,
  })
}

/**
 * Format a relative date (e.g., "2 days ago", "in 3 hours")
 * Falls back to absolute date if too far in past/future
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  
  // Use absolute date if more than 7 days away
  if (Math.abs(diffDays) > 7) {
    return formatDate(d)
  }
  
  // Use relative time formatter
  const rtf = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' })
  
  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, 'day')
  }
  
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, 'hour')
  }
  
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  if (Math.abs(diffMinutes) >= 1) {
    return rtf.format(diffMinutes, 'minute')
  }
  
  return 'just now'
}

/**
 * Format a date range (e.g., "12 - 14 Dec 2025" or "12 Dec - 3 Jan 2025")
 */
export function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  if (!startDate || !endDate) return '-'
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const sameYear = start.getFullYear() === end.getFullYear()
  
  if (sameMonth) {
    // Same month: "12 - 14 Dec 2025"
    return `${start.getDate()} - ${end.toLocaleDateString(DEFAULT_LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: DEFAULT_TIMEZONE,
    })}`
  }
  
  if (sameYear) {
    // Same year: "12 Dec - 3 Jan 2025"
    return `${start.toLocaleDateString(DEFAULT_LOCALE, {
      day: 'numeric',
      month: 'short',
      timeZone: DEFAULT_TIMEZONE,
    })} - ${end.toLocaleDateString(DEFAULT_LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: DEFAULT_TIMEZONE,
    })}`
  }
  
  // Different years: "12 Dec 2024 - 3 Jan 2025"
  return `${formatDate(start)} - ${formatDate(end)}`
}
