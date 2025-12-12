import { z } from 'zod'

// Invitation status enum
export const invitationStatusSchema = z.enum(['PENDING', 'SENT', 'OPENED', 'REGISTERED', 'EXPIRED', 'CANCELLED'])

// Create invitation schema (single)
export const createInvitationSchema = z.object({
  tournamentId: z.cuid(),
  contactEmail: z.email({ message: 'Invalid email address' }),
  contactName: z.string().max(100).optional(),
  teamName: z.string().max(100).optional(),
  message: z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>

// Bulk invitation schema
export const bulkInvitationSchema = z.object({
  tournamentId: z.cuid(),
  invitations: z.array(z.object({
    contactEmail: z.email({ message: 'Invalid email address' }),
    contactName: z.string().max(100).optional(),
    teamName: z.string().max(100).optional(),
  })).min(1, 'At least one invitation is required').max(100, 'Maximum 100 invitations at once'),
  message: z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
})

export type BulkInvitationInput = z.infer<typeof bulkInvitationSchema>

// CSV import row schema
export const csvInvitationRowSchema = z.object({
  email: z.email({ message: 'Invalid email address' }),
  name: z.string().max(100).optional(),
  team: z.string().max(100).optional(),
})

// Resend invitation schema
export const resendInvitationSchema = z.object({
  invitationId: z.cuid(),
  extendDays: z.number().int().min(1).max(90).default(7),
})

export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>

// Cancel invitation schema
export const cancelInvitationSchema = z.object({
  invitationId: z.cuid(),
})

export type CancelInvitationInput = z.infer<typeof cancelInvitationSchema>

// Register via invitation schema
export const registerViaInvitationSchema = z.object({
  token: z.string().min(1, 'Invalid invitation token'),
  teamName: z.string().min(1, 'Team name is required').max(100),
  contactName: z.string().min(1, 'Contact name is required').max(100),
  contactEmail: z.email({ message: 'Invalid email address' }),
  contactPhone: z.string().max(20).optional(),
})

export type RegisterViaInvitationInput = z.infer<typeof registerViaInvitationSchema>

