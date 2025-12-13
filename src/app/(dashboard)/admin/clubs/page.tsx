import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { getClubsWithDetails } from '@/actions/club'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default async function AdminClubsPage() {
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

  const result = await getClubsWithDetails()
  const clubs = result.success ? result.data || [] : []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Club Registry</h1>
          <p className="text-gray-500">Manage sports clubs and their administrators</p>
        </div>
        <Link href="/admin/clubs/new">
          <Button>Add Club</Button>
        </Link>
      </div>

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No clubs have been registered yet.</p>
            <Link href="/admin/clubs/new">
              <Button>Add First Club</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {clubs.map((club) => (
            <Card key={club.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {club.logoUrl ? (
                      <Image 
                        src={club.logoUrl} 
                        alt={club.name} 
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: club.primaryColor || '#6b7280' }}
                      >
                        {club.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{club.name}</CardTitle>
                      {club.fullName && (
                        <p className="text-sm text-gray-500">{club.fullName}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={club.status === 'ACTIVE' ? 'success' : 'default'}>
                    {club.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-6 text-sm text-gray-500">
                    {club.country && (
                      <span>{club.region ? `${club.region}, ` : ''}{club.country}</span>
                    )}
                    <span>{club._count?.primaryTeams || 0} teams</span>
                    <span>{club.administrators.length} admin{club.administrators.length !== 1 ? 's' : ''}</span>
                  </div>
                  <Link href={`/admin/clubs/${club.id}`}>
                    <Button variant="ghost" size="sm">
                      Manage →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
