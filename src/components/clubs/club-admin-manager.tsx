'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { addClubAdmin, removeClubAdmin } from '@/actions/club'
import type { ClubWithAdmins } from '@/types'

interface ClubAdminManagerProps {
  club: ClubWithAdmins
}

export function ClubAdminManager({ club }: ClubAdminManagerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // For now, we need the user ID. In a real implementation,
    // we'd look up the user by email first.
    // This is a simplified version that expects user ID input.
    
    const result = await addClubAdmin({
      clubId: club.id,
      userId: email, // In real impl, this would be looked up by email
    })

    setLoading(false)

    if (result.success) {
      setEmail('')
      router.refresh()
    } else {
      setError(result.error || 'Failed to add administrator')
    }
  }

  async function handleRemoveAdmin(userId: string) {
    if (!confirm('Are you sure you want to remove this administrator?')) {
      return
    }

    const result = await removeClubAdmin({
      clubId: club.id,
      userId,
    })

    if (result.success) {
      router.refresh()
    } else {
      setError(result.error || 'Failed to remove administrator')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Administrators</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-2 bg-red-50 text-red-600 rounded text-sm">
            {error}
          </div>
        )}

        {/* Current Admins */}
        {club.administrators.length === 0 ? (
          <p className="text-sm text-gray-500">No administrators assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {club.administrators.map((admin) => (
              <li 
                key={admin.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm">{admin.user.name || 'Unnamed'}</p>
                  <p className="text-xs text-gray-500">{admin.user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveAdmin(admin.userId)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Admin Form */}
        <form onSubmit={handleAddAdmin} className="pt-4 border-t">
          <p className="text-sm text-gray-500 mb-2">Add administrator by user ID:</p>
          <div className="flex gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="User ID"
              className="flex-1"
              required
            />
            <Button type="submit" size="sm" loading={loading}>
              Add
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Enter the user ID of the person to make an administrator.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
