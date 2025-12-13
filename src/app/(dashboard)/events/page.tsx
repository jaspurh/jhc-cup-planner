import Link from 'next/link'
import { getMyEvents } from '@/actions/event'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { formatDateRange } from '@/lib/utils/date'

export default async function EventsPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1">All your events and tournaments</p>
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
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link 
                        href={`/events/${event.id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {event.name}
                      </Link>
                      <StatusBadge status={event.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDateRange(event.startDate, event.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {event.tournaments.length} tournaments
                    </p>
                    <p className="text-sm text-gray-500">
                      {event.tournaments.reduce((acc, t) => acc + t.teamCount, 0)} teams
                    </p>
                  </div>
                  <Link href={`/events/${event.id}`} className="ml-4">
                    <Button variant="secondary" size="sm">View</Button>
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
