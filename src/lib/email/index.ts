/**
 * Email Service
 * 
 * This module provides email sending functionality.
 * Currently uses console logging as a placeholder.
 * 
 * TODO: Integrate with an email provider (Resend, SendGrid, etc.)
 * 
 * MAINTAINER NOTE: All email-related code should be in this folder.
 */

import { logger } from '@/lib/logger'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendInvitationEmailOptions {
  to: string
  recipientName?: string
  tournamentName: string
  eventName: string
  invitationToken: string
  message?: string
  expiresAt: Date
}

/**
 * Send a generic email
 * 
 * TODO: Replace with actual email provider integration
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // In development, just log the email
    if (process.env.NODE_ENV === 'development') {
      logger.info('Email would be sent', {
        to: options.to,
        subject: options.subject,
        // Don't log full HTML content
      })
      console.log('\n📧 EMAIL PREVIEW:')
      console.log('To:', options.to)
      console.log('Subject:', options.subject)
      console.log('---')
      console.log(options.text || 'See HTML content')
      console.log('---\n')
      
      return { success: true }
    }

    // TODO: Production email sending
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'Cup Planner <noreply@cupplanner.com>',
    //   to: options.to,
    //   subject: options.subject,
    //   html: options.html,
    // })

    logger.warn('Email sending not configured for production')
    return { success: false, error: 'Email sending not configured' }
  } catch (error) {
    logger.error('Failed to send email', { error, to: options.to })
    return { success: false, error: 'Failed to send email' }
  }
}

/**
 * Send a tournament invitation email
 */
export async function sendInvitationEmail(options: SendInvitationEmailOptions): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const registrationUrl = `${baseUrl}/register/${options.invitationToken}`
  
  const greeting = options.recipientName 
    ? `Hello ${options.recipientName},` 
    : 'Hello,'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tournament Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0066cc, #004499); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="margin-top: 0;">${greeting}</p>
          
          <p>You've been invited to register a team for:</p>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="margin: 0 0 5px 0; color: #111827;">${options.tournamentName}</h2>
            <p style="margin: 0; color: #6b7280;">${options.eventName}</p>
          </div>
          
          ${options.message ? `
            <div style="background: #eff6ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #1e40af;">${options.message}</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" 
               style="display: inline-block; background: #0066cc; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Register Your Team
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280;">
            This invitation expires on ${options.expiresAt.toLocaleDateString()}.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${registrationUrl}" style="color: #0066cc; word-break: break-all;">${registrationUrl}</a>
          </p>
        </div>
      </body>
    </html>
  `

  const text = `
${greeting}

You've been invited to register a team for ${options.tournamentName} at ${options.eventName}.

${options.message ? `Message from organizer: ${options.message}\n` : ''}

Register your team here: ${registrationUrl}

This invitation expires on ${options.expiresAt.toLocaleDateString()}.
  `.trim()

  return sendEmail({
    to: options.to,
    subject: `Invitation: ${options.tournamentName} - ${options.eventName}`,
    html,
    text,
  })
}
