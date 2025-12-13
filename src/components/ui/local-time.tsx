'use client'

/**
 * LocalTime Component
 * 
 * Displays dates/times in the user's local timezone.
 * Uses suppressHydrationWarning to handle server/client timezone differences.
 * 
 * Use this for:
 * - Match times
 * - Schedule times
 * - Any time where the user's local timezone matters
 * 
 * For date-only displays (event dates, registration dates),
 * use the formatDate() utility instead.
 */

interface LocalTimeProps {
  date: Date | string | null | undefined
  format?: 'time' | 'date' | 'datetime' | 'relative'
  fallback?: string
  className?: string
}

export function LocalTime({ 
  date, 
  format = 'datetime',
  fallback = '-',
  className 
}: LocalTimeProps) {
  if (!date) {
    return <span className={className}>{fallback}</span>
  }

  const d = typeof date === 'string' ? new Date(date) : date

  let formatted: string

  switch (format) {
    case 'time':
      formatted = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
      break
    case 'date':
      formatted = d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      break
    case 'relative':
      formatted = formatRelative(d)
      break
    case 'datetime':
    default:
      formatted = d.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      break
  }

  // suppressHydrationWarning allows the server/client to have different values
  // This is the recommended approach for timezone-dependent content
  return (
    <span className={className} suppressHydrationWarning>
      {formatted}
    </span>
  )
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 */
function formatRelative(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (Math.abs(diffDays) >= 7) {
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, 'day')
  }

  if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, 'hour')
  }

  if (Math.abs(diffMinutes) >= 1) {
    return rtf.format(diffMinutes, 'minute')
  }

  return 'just now'
}

/**
 * LocalDateTime - shorthand for datetime format
 */
export function LocalDateTime(props: Omit<LocalTimeProps, 'format'>) {
  return <LocalTime {...props} format="datetime" />
}

/**
 * LocalDateOnly - for dates that should show in local timezone
 * (rarely needed - usually use formatDate() from utils/date.ts instead)
 */
export function LocalDateOnly(props: Omit<LocalTimeProps, 'format'>) {
  return <LocalTime {...props} format="date" />
}

/**
 * LocalTimeOnly - for times that should show in local timezone
 */
export function LocalTimeOnly(props: Omit<LocalTimeProps, 'format'>) {
  return <LocalTime {...props} format="time" />
}

/**
 * RelativeTime - shows "2 hours ago", "in 3 days", etc.
 */
export function RelativeTime(props: Omit<LocalTimeProps, 'format'>) {
  return <LocalTime {...props} format="relative" />
}
