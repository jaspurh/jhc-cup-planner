'use client'

import { useState, useEffect } from 'react'

interface DateTimePickerProps {
  name: string
  label?: string
  defaultValue?: Date | string | null
  required?: boolean
  helpText?: string
  /** Event dates to highlight (shows which dates are valid) */
  eventDates?: { start: Date; end: Date } | null
  /** Time range to show in dropdown (default 07:00 - 22:00) */
  timeRange?: { startHour: number; endHour: number }
  /** Interval in minutes (default 5) */
  intervalMinutes?: number
}

/**
 * Generate time options in 5-minute intervals
 */
function generateTimeOptions(
  startHour: number = 7,
  endHour: number = 22,
  intervalMinutes: number = 5
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      // Stop if we're past the end hour
      if (hour === endHour && minute > 0) break
      
      const h = hour.toString().padStart(2, '0')
      const m = minute.toString().padStart(2, '0')
      const value = `${h}:${m}`
      const label = `${h}:${m}`
      options.push({ value, label })
    }
  }
  
  return options
}

/**
 * Format a date for the date input (YYYY-MM-DD)
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format time from a date (HH:MM)
 */
function formatTimeFromDate(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Round minutes to nearest interval
 */
function roundToInterval(minutes: number, interval: number): number {
  return Math.round(minutes / interval) * interval
}

export function DateTimePicker({
  name,
  label,
  defaultValue,
  required = false,
  helpText,
  eventDates,
  timeRange = { startHour: 7, endHour: 22 },
  intervalMinutes = 5,
}: DateTimePickerProps) {
  // Parse default value
  const defaultDate = defaultValue ? new Date(defaultValue) : null
  
  const [dateValue, setDateValue] = useState<string>(
    defaultDate ? formatDateForInput(defaultDate) : ''
  )
  const [timeValue, setTimeValue] = useState<string>(
    defaultDate 
      ? `${defaultDate.getHours().toString().padStart(2, '0')}:${(roundToInterval(defaultDate.getMinutes(), intervalMinutes) % 60).toString().padStart(2, '0')}`
      : '09:00'
  )
  
  // Combined value for the hidden input
  const combinedValue = dateValue && timeValue 
    ? `${dateValue}T${timeValue}` 
    : ''

  const timeOptions = generateTimeOptions(
    timeRange.startHour,
    timeRange.endHour,
    intervalMinutes
  )

  // Format event date range for display
  const eventDateHint = eventDates 
    ? `Event: ${formatDateForInput(eventDates.start)} to ${formatDateForInput(eventDates.end)}`
    : null

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="grid grid-cols-2 gap-3">
        {/* Date picker */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            min={eventDates ? formatDateForInput(eventDates.start) : undefined}
            max={eventDates ? formatDateForInput(eventDates.end) : undefined}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {/* Time picker dropdown */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Time</label>
          <select
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Hidden input with combined value for form submission */}
      <input
        type="hidden"
        name={name}
        value={combinedValue}
      />
      
      {/* Help text and event date hint */}
      <div className="space-y-1">
        {eventDateHint && (
          <p className="text-xs text-blue-600">{eventDateHint}</p>
        )}
        {helpText && (
          <p className="text-xs text-gray-500">{helpText}</p>
        )}
      </div>
    </div>
  )
}
