import Link from 'next/link'
import { getMyEvents } from '@/actions/event'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const result = await getMyEvents()
  
  if (!result.success) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{result.error}</p>
      </div>
    )
  }

  const events = result.data || []

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your events and tournaments</p>
        </div>
        <Link href="/events/new">
          <Button>Create Event</Button>
        </Link>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events yet</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first event</p>
            <Link href="/events/new">
              <Button>Create Event</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{event.name}</CardTitle>
                    <StatusBadge status={event.status} />
                  </div>
                  <CardDescription>
                    {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-500">
                    <span className="font-medium text-gray-900">{event.tournaments.length}</span> tournaments
                  </div>
                  {event.tournaments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {event.tournaments.slice(0, 3).map((t) => (
                        <span 
                          key={t.id} 
                          className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-600"
                        >
                          {t.name}
                        </span>
                      ))}
                      {event.tournaments.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{event.tournaments.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
