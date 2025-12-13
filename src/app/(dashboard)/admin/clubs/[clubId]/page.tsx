import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getClub } from '@/actions/club'
import { ClubForm } from '@/components/clubs/club-form'
import { ClubAdminManager } from '@/components/clubs/club-admin-manager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ClubDetailPageProps {
  params: Promise<{ clubId: string }>
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { clubId } = await params
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

  const result = await getClub(clubId)
  
  if (!result.success || !result.data) {
    notFound()
  }

  const club = result.data

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clubs" className="text-sm text-blue-600 hover:underline">
          ← Back to Clubs
        </Link>
        <h1 className="text-2xl font-bold mt-2">Manage {club.name}</h1>
        <p className="text-gray-500">{club.fullName || 'Club details and administrators'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ClubForm club={club} />
        </div>

        <div className="space-y-6">
          <ClubAdminManager club={club} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Primary Teams</dt>
                  <dd className="font-medium">{club._count?.primaryTeams || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Secondary Teams</dt>
                  <dd className="font-medium">{club._count?.secondaryTeams || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Administrators</dt>
                  <dd className="font-medium">{club.administrators.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
