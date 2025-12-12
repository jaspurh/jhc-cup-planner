import { z } from 'zod'

// Create venue schema
export const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required').max(100),
  address: z.string().max(200).optional(),
  eventId: z.string().cuid(),
})

export type CreateVenueInput = z.infer<typeof createVenueSchema>

// Update venue schema
export const updateVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required').max(100).optional(),
  address: z.string().max(200).nullable().optional(),
})

export type UpdateVenueInput = z.infer<typeof updateVenueSchema>

// Create pitch schema
export const createPitchSchema = z.object({
  name: z.string().min(1, 'Pitch name is required').max(50),
  tournamentId: z.string().cuid(),
  venueId: z.string().cuid().optional(),
  capacity: z.number().int().min(0).max(100000).optional(),
})

export type CreatePitchInput = z.infer<typeof createPitchSchema>

// Update pitch schema
export const updatePitchSchema = z.object({
  name: z.string().min(1, 'Pitch name is required').max(50).optional(),
  venueId: z.string().cuid().nullable().optional(),
  capacity: z.number().int().min(0).max(100000).nullable().optional(),
})

export type UpdatePitchInput = z.infer<typeof updatePitchSchema>

