-- Rename gapMinutesBefore to bufferTimeMinutes
ALTER TABLE "Stage" RENAME COLUMN "gapMinutesBefore" TO "bufferTimeMinutes";
