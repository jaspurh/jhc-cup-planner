-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "dependsOnMatchIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
