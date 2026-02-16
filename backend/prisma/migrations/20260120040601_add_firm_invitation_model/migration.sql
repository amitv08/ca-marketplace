-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FirmInvitation" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "caId" TEXT,
    "email" TEXT NOT NULL,
    "role" "FirmMemberRole" NOT NULL DEFAULT 'JUNIOR_CA',
    "membershipType" "MembershipType" NOT NULL DEFAULT 'FULL_TIME',
    "invitationToken" TEXT NOT NULL,
    "message" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmInvitation_invitationToken_key" ON "FirmInvitation"("invitationToken");

-- CreateIndex
CREATE INDEX "FirmInvitation_firmId_idx" ON "FirmInvitation"("firmId");

-- CreateIndex
CREATE INDEX "FirmInvitation_caId_idx" ON "FirmInvitation"("caId");

-- CreateIndex
CREATE INDEX "FirmInvitation_invitedById_idx" ON "FirmInvitation"("invitedById");

-- CreateIndex
CREATE INDEX "FirmInvitation_email_idx" ON "FirmInvitation"("email");

-- CreateIndex
CREATE INDEX "FirmInvitation_status_idx" ON "FirmInvitation"("status");

-- CreateIndex
CREATE INDEX "FirmInvitation_invitationToken_idx" ON "FirmInvitation"("invitationToken");

-- CreateIndex
CREATE INDEX "FirmInvitation_expiresAt_idx" ON "FirmInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "FirmInvitation_firmId_status_idx" ON "FirmInvitation"("firmId", "status");

-- CreateIndex
CREATE INDEX "FirmInvitation_caId_status_idx" ON "FirmInvitation"("caId", "status");

-- CreateIndex
CREATE INDEX "FirmInvitation_email_status_idx" ON "FirmInvitation"("email", "status");

-- AddForeignKey
ALTER TABLE "FirmInvitation" ADD CONSTRAINT "FirmInvitation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmInvitation" ADD CONSTRAINT "FirmInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmInvitation" ADD CONSTRAINT "FirmInvitation_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
