-- AlterTable
ALTER TABLE "FirmDocument" ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "FirmMembership" ADD COLUMN     "responsibilities" TEXT;

-- AlterTable
ALTER TABLE "FirmMembershipHistory" ADD COLUMN     "performedBy" TEXT,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
