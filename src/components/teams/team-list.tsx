'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { updateRegistrationStatus } from '@/actions/team'
import { formatDate } from '@/lib/utils/date'
import type { RegistrationStatus } from '@/types'

interface ClubInfo {
  id: string
  name: string
  primaryColor: string | null
}

interface TeamRegistration {
  id: string
  teamId: string
  teamName: string
  contactName: string | null
  contactEmail: string | null
  status: RegistrationStatus
  registeredAt: Date
  confirmedAt: Date | null
  primaryClub?: ClubInfo | null
  secondaryClub?: ClubInfo | null
}

interface TeamListProps {
  registrations: TeamRegistration[]
  tournamentId: string
  canManage?: boolean
}

export function TeamList({ registrations, canManage = true }: TeamListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleStatusChange(registrationId: string, newStatus: RegistrationStatus) {
    setLoadingId(registrationId)
    await updateRegistrationStatus(registrationId, newStatus)
    setLoadingId(null)
  }

  if (registrations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No teams registered yet</p>
        </CardContent>
      </Card>
    )
  }

  const pendingCount = registrations.filter(r => r.status === 'PENDING').length
  const confirmedCount = registrations.filter(r => r.status === 'CONFIRMED').length

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Registered Teams ({registrations.length})</CardTitle>
          <div className="flex gap-2 text-sm">
            <span className="text-green-600">{confirmedCount} confirmed</span>
            {pendingCount > 0 && (
              <span className="text-yellow-600">{pendingCount} pending</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {registrations.map((reg) => (
            <div key={reg.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{reg.teamName}</span>
                    <StatusBadge status={reg.status} />
                    {reg.primaryClub && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: reg.primaryClub.primaryColor || '#6b7280' }}
                        title={`Primary club: ${reg.primaryClub.name}`}
                      >
                        {reg.primaryClub.name}
                      </span>
                    )}
                    {reg.secondaryClub && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{ 
                          borderColor: reg.secondaryClub.primaryColor || '#6b7280',
                          color: reg.secondaryClub.primaryColor || '#6b7280'
                        }}
                        title={`Secondary club: ${reg.secondaryClub.name}`}
                      >
                        +{reg.secondaryClub.name}
                      </span>
                    )}
                  </div>
                  {(reg.contactName || reg.contactEmail) && (
                    <p className="text-sm text-gray-500 mt-1">
                      {reg.contactName}
                      {reg.contactName && reg.contactEmail && ' • '}
                      {reg.contactEmail && (
                        <a href={`mailto:${reg.contactEmail}`} className="text-blue-600 hover:underline">
                          {reg.contactEmail}
                        </a>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Registered {formatDate(reg.registeredAt)}
                    {reg.confirmedAt && ` • Confirmed ${formatDate(reg.confirmedAt)}`}
                  </p>
                </div>
                
                {canManage && (
                  <div className="flex gap-2">
                    {reg.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(reg.id, 'CONFIRMED')}
                          loading={loadingId === reg.id}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleStatusChange(reg.id, 'REJECTED')}
                          loading={loadingId === reg.id}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {reg.status === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStatusChange(reg.id, 'WITHDRAWN')}
                        loading={loadingId === reg.id}
                      >
                        Withdraw
                      </Button>
                    )}
                    {reg.status === 'WITHDRAWN' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStatusChange(reg.id, 'CONFIRMED')}
                        loading={loadingId === reg.id}
                      >
                        Reinstate
                      </Button>
                    )}
                    {reg.status === 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStatusChange(reg.id, 'PENDING')}
                        loading={loadingId === reg.id}
                      >
                        Reconsider
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
