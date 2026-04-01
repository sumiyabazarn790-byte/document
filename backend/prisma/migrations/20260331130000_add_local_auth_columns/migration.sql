ALTER TABLE "users"
ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN "passwordHash" TEXT;
