import { z } from 'zod'
import { hexColorSchema } from './event'

/**
 * Club Schemas
 * 
 * Validation schemas for club-related operations.
 */

// Club status enum
export const clubStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])

// Registration mode enum
export const registrationModeSchema = z.enum([
  'OPEN',
  'INVITE_ONLY', 
  'CLUB_ADMIN',
  'CLUB_MEMBERS'
])

// Create club schema
export const createClubSchema = z.object({
  name: z.string()
    .min(1, 'Club name is required')
    .max(50, 'Club name must be 50 characters or less'),
  fullName: z.string()
    .max(200, 'Full name must be 200 characters or less')
    .optional()
    .nullable(),
  country: z.string()
    .max(100, 'Country must be 100 characters or less')
    .optional()
    .nullable(),
  region: z.string()
    .max(100, 'Region must be 100 characters or less')
    .optional()
    .nullable(),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable(),
  primaryColor: hexColorSchema.optional().nullable(),
  secondaryColor: hexColorSchema.optional().nullable(),
})

// Update club schema
export const updateClubSchema = createClubSchema.partial().extend({
  status: clubStatusSchema.optional(),
})

// Add club admin schema
export const addClubAdminSchema = z.object({
  clubId: z.string().cuid('Invalid club ID'),
  userId: z.string().cuid('Invalid user ID'),
})

// Remove club admin schema
export const removeClubAdminSchema = z.object({
  clubId: z.string().cuid('Invalid club ID'),
  userId: z.string().cuid('Invalid user ID'),
})

// Team club affiliation schema (for registration)
export const teamClubAffiliationSchema = z.object({
  primaryClubId: z.string().cuid('Invalid club ID').optional().nullable(),
  secondaryClubId: z.string().cuid('Invalid club ID').optional().nullable(),
}).refine(
  (data) => {
    // If both are set, they must be different
    if (data.primaryClubId && data.secondaryClubId) {
      return data.primaryClubId !== data.secondaryClubId
    }
    return true
  },
  { message: 'Primary and secondary clubs must be different' }
)

// Type exports
export type CreateClubInput = z.infer<typeof createClubSchema>
export type UpdateClubInput = z.infer<typeof updateClubSchema>
export type AddClubAdminInput = z.infer<typeof addClubAdminSchema>
export type RemoveClubAdminInput = z.infer<typeof removeClubAdminSchema>
export type TeamClubAffiliationInput = z.infer<typeof teamClubAffiliationSchema>
