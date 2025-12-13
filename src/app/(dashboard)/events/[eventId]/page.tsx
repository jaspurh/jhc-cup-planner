import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent } from '@/actions/event'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { formatTournamentFormat, formatTournamentStyle } from '@/lib/constants'
import { formatDateRange } from '@/lib/utils/date'
import { LocalTimeOnly } from '@/components/ui/local-time'

interface EventPageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventId } = await params
  const result = await getEvent(eventId)
  
  if (!result.success || !result.data) {
    notFound()
  }

  const event = result.data

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/events" className="hover:text-gray-700">Events</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{event.name}</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-gray-500 mt-1">
            {formatDateRange(event.startDate, event.endDate)}
          </p>
          {event.description && (
            <p className="text-gray-600 mt-2">{event.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${event.id}/tournaments/new`}>
            <Button>Add Tournament</Button>
          </Link>
          <Link href={`/events/${event.id}/settings`}>
            <Button variant="secondary">Settings</Button>
          </Link>
        </div>
      </div>

      {/* Tournaments */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tournaments</h2>
        
        {event.tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments yet</h3>
              <p className="text-gray-500 mb-4">Add tournaments to this event</p>
              <Link href={`/events/${event.id}/tournaments/new`}>
                <Button>Add Tournament</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {event.tournaments.map((tournament) => (
              <Link 
                key={tournament.id} 
                href={`/events/${event.id}/tournaments/${tournament.id}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{tournament.name}</CardTitle>
                      <StatusBadge status={tournament.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Format</span>
                        <span className="text-gray-900">{formatTournamentFormat(tournament.format)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Style</span>
                        <span className="text-gray-900">{formatTournamentStyle(tournament.style)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Teams</span>
                        <span className="text-gray-900">{tournament.teamCount}</span>
                      </div>
                      {tournament.startTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Start</span>
                          <span className="text-gray-900">
                            <LocalTimeOnly date={tournament.startTime} />
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
