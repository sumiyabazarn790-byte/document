-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'google', 'hybrid');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('view', 'edit');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted');

-- AlterTable
ALTER TABLE "users"
ALTER COLUMN "authProvider" DROP DEFAULT,
ALTER COLUMN "authProvider" TYPE "AuthProvider" USING ("authProvider"::text::"AuthProvider"),
ALTER COLUMN "authProvider" SET DEFAULT 'local';

-- Normalize legacy role values before converting to enums
UPDATE "DocumentMember"
SET "role" = CASE
  WHEN "role" = 'editor' THEN 'edit'
  WHEN "role" = 'viewer' THEN 'view'
  ELSE "role"
END;

UPDATE "DocumentInvite"
SET "role" = CASE
  WHEN "role" = 'editor' THEN 'edit'
  WHEN "role" = 'viewer' THEN 'view'
  ELSE "role"
END;

-- AlterTable
ALTER TABLE "DocumentMember"
ALTER COLUMN "role" TYPE "MemberRole" USING ("role"::text::"MemberRole");

-- AlterTable
ALTER TABLE "DocumentInvite"
ALTER COLUMN "role" TYPE "MemberRole" USING ("role"::text::"MemberRole"),
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "InviteStatus" USING ("status"::text::"InviteStatus"),
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AddForeignKey
ALTER TABLE "DocumentInvite"
ADD CONSTRAINT "DocumentInvite_acceptedById_fkey"
FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
