import { z } from 'zod'

// Event status enum
export const eventStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'])

// Create event schema
export const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100, 'Event name is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
)

export type CreateEventInput = z.infer<typeof createEventSchema>

// Update event schema
export const updateEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100, 'Event name is too long').optional(),
  description: z.string().max(2000, 'Description is too long').nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: eventStatusSchema.optional(),
})

export type UpdateEventInput = z.infer<typeof updateEventSchema>

// Event ID param
export const eventIdSchema = z.object({
  eventId: z.string().cuid(),
})

