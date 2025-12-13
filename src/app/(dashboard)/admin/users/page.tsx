import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils/date'

export default async function AdminUsersPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Check if user is admin
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true }
  })

  if (user?.platformRole !== 'ADMIN') {
    redirect('/dashboard')
  }

  // Get all users
  const users = await db.user.findMany({
    include: {
      _count: {
        select: { 
          ownedEvents: true,
          clubAdministrations: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const roleVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'danger'
      case 'SUPPORT': return 'warning'
      default: return 'default'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-gray-500">Manage platform users and their roles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name || 'Unnamed'}</span>
                      <Badge variant={roleVariant(u.platformRole)}>
                        {u.platformRole}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Joined {formatDate(u.createdAt)}
                      {u._count.ownedEvents > 0 && ` • ${u._count.ownedEvents} event${u._count.ownedEvents !== 1 ? 's' : ''}`}
                      {u._count.clubAdministrations > 0 && ` • Admin of ${u._count.clubAdministrations} club${u._count.clubAdministrations !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    {u.id.slice(0, 8)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
