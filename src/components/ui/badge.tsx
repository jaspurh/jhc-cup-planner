import type { HTMLAttributes, ReactNode } from 'react'
import { getStatusConfig, type StatusVariant } from '@/lib/constants'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant
  children: ReactNode
}

/**
 * Badge variant CSS classes
 * Centralized here for consistency across the app
 */
const BADGE_VARIANT_CLASSES: Record<StatusVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BADGE_VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * Status badge that automatically maps status enums to appropriate colors/labels
 * Uses centralized status configuration from @/lib/constants
 */
export function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status)
  return <Badge variant={config.variant}>{config.label}</Badge>
}
