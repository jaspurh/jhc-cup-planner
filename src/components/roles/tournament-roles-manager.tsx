'use client'

import { useState, useTransition } from 'react'
import { assignTournamentRole, removeTournamentRole, type TournamentRoleMember } from '@/actions/roles'
import { TournamentRoleType } from '@/generated/prisma'
import { Button } from '@/components/ui/button'

const ROLE_LABELS: Record<TournamentRoleType, string> = {
  ORGANIZER: 'Organizer',
  CONTACT_PERSON: 'Contact Person',
  VIEWER: 'Viewer',
}

const ROLE_DESCRIPTIONS: Record<TournamentRoleType, string> = {
  ORGANIZER: 'Full control — stages, schedule, results, roles',
  CONTACT_PERSON: 'Day-to-day ops — enter results, reschedule, manage teams',
  VIEWER: 'Read-only access',
}

const ROLE_BADGE: Record<TournamentRoleType, string> = {
  ORGANIZER: 'bg-blue-100 text-blue-800',
  CONTACT_PERSON: 'bg-green-100 text-green-700',
  VIEWER: 'bg-gray-100 text-gray-600',
}

interface Props {
  tournamentId: string
  initialMembers: TournamentRoleMember[]
}

export function TournamentRolesManager({ tournamentId, initialMembers }: Props) {
  const [members, setMembers] = useState<TournamentRoleMember[]>(initialMembers)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TournamentRoleType>(TournamentRoleType.CONTACT_PERSON)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAssign = () => {
    if (!email.trim()) return
    setError(null)

    startTransition(async () => {
      const result = await assignTournamentRole(tournamentId, email.trim(), role)
      if (!result.success) {
        setError(result.error ?? 'Failed to assign role')
        return
      }
      // Upsert into the local list
      setMembers(prev => {
        const existing = prev.findIndex(m => m.userId === result.data!.userId)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = result.data!
          return updated
        }
        return [...prev, result.data!]
      })
      setEmail('')
    })
  }

  const handleRemove = (member: TournamentRoleMember) => {
    setError(null)
    startTransition(async () => {
      const result = await removeTournamentRole(tournamentId, member.id)
      if (!result.success) {
        setError(result.error ?? 'Failed to remove role')
        return
      }
      setMembers(prev => prev.filter(m => m.id !== member.id))
    })
  }

  return (
    <div className="space-y-4">
      {/* Current members */}
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {members.map(member => (
          <div key={member.id} className="flex items-center justify-between px-4 py-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">
                {(member.userName ?? member.userEmail)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {member.userName ?? member.userEmail}
                </p>
                {member.userName && (
                  <p className="text-xs text-gray-500 truncate">{member.userEmail}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[member.role]}`}>
                {ROLE_LABELS[member.role]}
              </span>
              {member.isEventOwner ? (
                <span className="text-xs text-gray-400 italic">Event owner</span>
              ) : (
                <button
                  onClick={() => handleRemove(member)}
                  disabled={isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            No team members yet
          </div>
        )}
      </div>

      {/* Add member form */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Add team member</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAssign()}
            disabled={isPending}
            className="flex-1 min-w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as TournamentRoleType)}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {Object.values(TournamentRoleType).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <Button
            onClick={handleAssign}
            disabled={isPending || !email.trim()}
            size="sm"
          >
            {isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
        {role && (
          <p className="text-xs text-gray-500 mt-2">{ROLE_DESCRIPTIONS[role]}</p>
        )}
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
      </div>
    </div>
  )
}
