-- CreateEnum
CREATE TYPE "RegistrationMode" AS ENUM ('OPEN', 'INVITE_ONLY', 'CLUB_ADMIN', 'CLUB_MEMBERS');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "primaryClubId" TEXT,
ADD COLUMN     "secondaryClubId" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "registrationMode" "RegistrationMode" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT,
    "country" TEXT,
    "region" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "status" "ClubStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubAdmin" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Club_name_idx" ON "Club"("name");

-- CreateIndex
CREATE INDEX "Club_status_idx" ON "Club"("status");

-- CreateIndex
CREATE INDEX "ClubAdmin_clubId_idx" ON "ClubAdmin"("clubId");

-- CreateIndex
CREATE INDEX "ClubAdmin_userId_idx" ON "ClubAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubAdmin_clubId_userId_key" ON "ClubAdmin"("clubId", "userId");

-- CreateIndex
CREATE INDEX "Team_primaryClubId_idx" ON "Team"("primaryClubId");

-- CreateIndex
CREATE INDEX "Team_secondaryClubId_idx" ON "Team"("secondaryClubId");

-- AddForeignKey
ALTER TABLE "ClubAdmin" ADD CONSTRAINT "ClubAdmin_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAdmin" ADD CONSTRAINT "ClubAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_primaryClubId_fkey" FOREIGN KEY ("primaryClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_secondaryClubId_fkey" FOREIGN KEY ("secondaryClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
