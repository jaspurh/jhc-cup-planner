import { z } from 'zod'

// Team member role enum
export const teamMemberRoleSchema = z.enum(['CAPTAIN', 'COACH', 'PLAYER'])

// Registration status enum
export const registrationStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'WITHDRAWN', 'REJECTED'])

// Create team schema
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name is too long'),
  contactName: z.string().max(100).optional(),
  contactEmail: z.email({ message: 'Invalid email address' }).optional(),
  contactPhone: z.string().max(20).optional(),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>

// Update team schema
export const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name is too long').optional(),
  contactName: z.string().max(100).nullable().optional(),
  contactEmail: z.email({ message: 'Invalid email address' }).nullable().optional(),
  contactPhone: z.string().max(20).nullable().optional(),
})

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>

// Register team to tournament
export const registerTeamSchema = z.object({
  teamId: z.cuid(),
  tournamentId: z.cuid(),
})

export type RegisterTeamInput = z.infer<typeof registerTeamSchema>

// Quick registration (create team and register in one step)
export const quickRegisterTeamSchema = z.object({
  tournamentId: z.cuid(),
  teamName: z.string().min(1, 'Team name is required').max(100),
  contactName: z.string().min(1, 'Contact name is required').max(100),
  contactEmail: z.email({ message: 'Invalid email address' }),
  contactPhone: z.string().max(20).optional(),
})

export type QuickRegisterTeamInput = z.infer<typeof quickRegisterTeamSchema>

// Update registration status
export const updateRegistrationStatusSchema = z.object({
  registrationId: z.cuid(),
  status: registrationStatusSchema,
})

export type UpdateRegistrationStatusInput = z.infer<typeof updateRegistrationStatusSchema>

// Add team member
export const addTeamMemberSchema = z.object({
  teamId: z.cuid(),
  userId: z.cuid(),
  role: teamMemberRoleSchema.default('PLAYER'),
})

export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>

