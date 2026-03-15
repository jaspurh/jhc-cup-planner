import { PrismaClient } from '../src/generated/prisma'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin user
  const adminPasswordHash = await hash('admin123', 12)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@cupplanner.com' },
    update: {},
    create: {
      email: 'admin@cupplanner.com',
      name: 'Admin',
      passwordHash: adminPasswordHash,
      emailVerified: new Date(),
      platformRole: 'ADMIN',
    },
  })

  console.log(`✅ Created admin user: ${adminUser.email}`)

  // Create demo user
  const passwordHash = await hash('password123', 12)

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@cupplanner.com' },
    update: {},
    create: {
      email: 'demo@cupplanner.com',
      name: 'Demo Organizer',
      passwordHash,
      emailVerified: new Date(),
    },
  })

  console.log(`✅ Created demo user: ${demoUser.email}`)

  // Create demo event
  const demoEvent = await prisma.event.upsert({
    where: { slug: 'indoor-championship-2025' },
    update: {},
    create: {
      name: 'Indoor Football Championship 2025',
      description: 'Annual indoor football tournament featuring youth teams from across the region.',
      slug: 'indoor-championship-2025',
      startDate: new Date('2025-01-18T08:00:00Z'),
      endDate: new Date('2025-01-19T18:00:00Z'),
      status: 'DRAFT',
      ownerId: demoUser.id,
    },
  })

  console.log(`✅ Created demo event: ${demoEvent.name}`)

  // Create demo venue
  const demoVenue = await prisma.venue.upsert({
    where: { id: 'demo-venue-1' },
    update: {},
    create: {
      id: 'demo-venue-1',
      name: 'Sports Hall A',
      address: '123 Stadium Road',
      eventId: demoEvent.id,
    },
  })

  console.log(`✅ Created demo venue: ${demoVenue.name}`)

  // Create demo tournament (Under-9 Boys)
  const demoTournament = await prisma.tournament.upsert({
    where: { 
      eventId_slug: {
        eventId: demoEvent.id,
        slug: 'u9-boys'
      }
    },
    update: {},
    create: {
      name: 'Under-9 Boys',
      description: 'Under-9 boys tournament with group stage and knockout rounds.',
      slug: 'u9-boys',
      eventId: demoEvent.id,
      status: 'DRAFT',
      style: 'COMPETITIVE',
      format: 'GROUP_KNOCKOUT',
      matchDurationMinutes: 5,
      transitionTimeMinutes: 1,
    },
  })

  console.log(`✅ Created demo tournament: ${demoTournament.name}`)

  // Create demo pitches at event level
  const demoPitch1 = await prisma.pitch.upsert({
    where: { eventId_name: { eventId: demoEvent.id, name: 'Pitch 1' } },
    update: {},
    create: {
      name: 'Pitch 1',
      eventId: demoEvent.id,
      venueId: demoVenue.id,
      capacity: 50,
    },
  })

  const demoPitch2 = await prisma.pitch.upsert({
    where: { eventId_name: { eventId: demoEvent.id, name: 'Pitch 2' } },
    update: {},
    create: {
      name: 'Pitch 2',
      eventId: demoEvent.id,
      venueId: demoVenue.id,
      capacity: 40,
    },
  })

  // Select pitches for the demo tournament
  await prisma.tournamentPitch.upsert({
    where: { tournamentId_pitchId: { tournamentId: demoTournament.id, pitchId: demoPitch1.id } },
    update: { isActive: true },
    create: { tournamentId: demoTournament.id, pitchId: demoPitch1.id, isActive: true },
  })

  await prisma.tournamentPitch.upsert({
    where: { tournamentId_pitchId: { tournamentId: demoTournament.id, pitchId: demoPitch2.id } },
    update: { isActive: true },
    create: { tournamentId: demoTournament.id, pitchId: demoPitch2.id, isActive: true },
  })

  console.log(`✅ Created demo pitches: ${demoPitch1.name}, ${demoPitch2.name}`)

  // Assign organizer role
  await prisma.tournamentRole.upsert({
    where: {
      userId_tournamentId: {
        userId: demoUser.id,
        tournamentId: demoTournament.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      tournamentId: demoTournament.id,
      role: 'ORGANIZER',
    },
  })

  console.log(`✅ Assigned organizer role to demo user`)

  // Create some demo teams
  const teamNames = [
    'Barcelona FC',
    'Real Madrid Youth',
    'Bayern Munich Junior',
    'Manchester United Academy',
  ]

  for (const teamName of teamNames) {
    const team = await prisma.team.create({
      data: {
        name: teamName,
        contactName: `${teamName} Coach`,
        contactEmail: `${teamName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        createdById: demoUser.id,
      },
    })

    await prisma.teamRegistration.create({
      data: {
        teamId: team.id,
        tournamentId: demoTournament.id,
        status: 'CONFIRMED',
        registeredTeamName: teamName,
        confirmedAt: new Date(),
      },
    })

    console.log(`✅ Created and registered team: ${teamName}`)
  }

  console.log('')
  console.log('🎉 Seed completed successfully!')
  console.log('')
  console.log('Credentials:')
  console.log('  Admin  — admin@cupplanner.com  / admin123')
  console.log('  Demo   — demo@cupplanner.com   / password123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

