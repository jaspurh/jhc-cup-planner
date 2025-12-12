import { z } from 'zod'

/**
 * Password requirements based on OWASP Authentication Cheat Sheet:
 * https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 * 
 * - Minimum 8 characters (if MFA enabled) or 15 characters (if no MFA)
 * - Maximum 64+ characters to allow passphrases
 * - NO composition rules (uppercase, lowercase, numbers, special chars)
 * - Allow ALL characters including unicode and whitespace
 * - Use password strength meter (zxcvbn) on frontend instead of rigid rules
 * - Block common/breached passwords via Pwned Passwords API (server-side)
 * 
 * Note: Using 10 char minimum as a balance (MFA planned for Phase 2)
 */

const PASSWORD_MIN_LENGTH = 10
const PASSWORD_MAX_LENGTH = 128

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  // No composition rules per OWASP - use password strength meter on frontend

export const loginSchema = z.object({
  email: z.email({ message: 'Invalid email address' }),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.email({ message: 'Invalid email address' }),
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'New password must be different from current password', path: ['newPassword'] }
)

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] }
)

export const forgotPasswordSchema = z.object({
  email: z.email({ message: 'Invalid email address' }),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
