'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { resendInvitation, cancelInvitation } from '@/actions/invitation'
import { formatDate } from '@/lib/utils/date'
import type { InvitationStatus } from '@/types'

interface Invitation {
  id: string
  token: string
  contactEmail: string
  contactName: string | null
  teamName: string | null
  status: InvitationStatus
  sentAt: Date
  expiresAt: Date
}

interface InvitationListProps {
  invitations: Invitation[]
  tournamentId: string
}

export function InvitationList({ invitations }: InvitationListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleResend(invitationId: string) {
    setLoadingId(invitationId)
    await resendInvitation(invitationId)
    setLoadingId(null)
  }

  async function handleCancel(invitationId: string) {
    setLoadingId(invitationId)
    await cancelInvitation(invitationId)
    setLoadingId(null)
  }

  if (invitations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-500">No invitations sent yet</p>
        </CardContent>
      </Card>
    )
  }

  const pendingCount = invitations.filter(i => 
    ['PENDING', 'SENT', 'OPENED'].includes(i.status)
  ).length

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Invitations ({invitations.length})</CardTitle>
          {pendingCount > 0 && (
            <span className="text-sm text-yellow-600">{pendingCount} awaiting response</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {invitations.map((inv) => {
            const isExpired = new Date(inv.expiresAt) < new Date() && 
              !['REGISTERED', 'CANCELLED'].includes(inv.status)
            const canResend = ['PENDING', 'SENT', 'OPENED'].includes(inv.status) && !isExpired
            const canCancel = ['PENDING', 'SENT', 'OPENED'].includes(inv.status)

            return (
              <div key={inv.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{inv.contactEmail}</span>
                      <StatusBadge status={isExpired ? 'EXPIRED' : inv.status} />
                    </div>
                    {(inv.contactName || inv.teamName) && (
                      <p className="text-sm text-gray-500 mt-1">
                        {inv.contactName}
                        {inv.contactName && inv.teamName && ' • '}
                        {inv.teamName && <span className="italic">{inv.teamName}</span>}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Sent {formatDate(inv.sentAt)}
                      {!isExpired && ['PENDING', 'SENT', 'OPENED'].includes(inv.status) && (
                        <> • Expires {formatDate(inv.expiresAt)}</>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {canResend && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleResend(inv.id)}
                        loading={loadingId === inv.id}
                      >
                        Resend
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancel(inv.id)}
                        loading={loadingId === inv.id}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
