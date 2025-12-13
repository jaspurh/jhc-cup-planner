import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ClubForm } from '@/components/clubs/club-form'

export default async function NewClubPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clubs" className="text-sm text-blue-600 hover:underline">
          ← Back to Clubs
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add New Club</h1>
        <p className="text-gray-500">Register a new sports club in the system</p>
      </div>

      <ClubForm />
    </div>
  )
}
