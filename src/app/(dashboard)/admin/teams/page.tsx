import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminTeamsPage() {
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

  // Get all teams with their registrations and clubs
  const teams = await db.team.findMany({
    include: {
      primaryClub: {
        select: { id: true, name: true, primaryColor: true }
      },
      secondaryClub: {
        select: { id: true, name: true, primaryColor: true }
      },
      _count: {
        select: { registrations: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teams</h1>
        <p className="text-gray-500">All registered teams across tournaments</p>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No teams have been registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Teams ({teams.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {teams.map((team) => (
                <div key={team.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{team.name}</span>
                        {team.primaryClub && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: team.primaryClub.primaryColor || '#6b7280' }}
                          >
                            {team.primaryClub.name}
                          </span>
                        )}
                        {team.secondaryClub && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full border"
                            style={{ 
                              borderColor: team.secondaryClub.primaryColor || '#6b7280',
                              color: team.secondaryClub.primaryColor || '#6b7280'
                            }}
                          >
                            +{team.secondaryClub.name}
                          </span>
                        )}
                      </div>
                      {(team.contactName || team.contactEmail) && (
                        <p className="text-sm text-gray-500 mt-1">
                          {team.contactName}
                          {team.contactName && team.contactEmail && ' • '}
                          {team.contactEmail && (
                            <a href={`mailto:${team.contactEmail}`} className="text-blue-600 hover:underline">
                              {team.contactEmail}
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {team._count.registrations} tournament{team._count.registrations !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
