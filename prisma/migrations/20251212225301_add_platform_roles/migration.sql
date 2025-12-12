-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPPORT', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';
