-- CreateTable
CREATE TABLE "DocumentInvite" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "documentId" INTEGER NOT NULL,
    "invitedById" INTEGER NOT NULL,
    "acceptedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentInvite_token_key" ON "DocumentInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentInvite_documentId_email_key" ON "DocumentInvite"("documentId", "email");

-- AddForeignKey
ALTER TABLE "DocumentInvite" ADD CONSTRAINT "DocumentInvite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInvite" ADD CONSTRAINT "DocumentInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
