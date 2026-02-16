-- AlterTable
ALTER TABLE "CAFirm" ADD COLUMN     "contactPersonEmail" TEXT,
ADD COLUMN     "contactPersonName" TEXT,
ADD COLUMN     "contactPersonPhone" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "profileImage" TEXT;

-- AlterTable
ALTER TABLE "FirmDocument" ALTER COLUMN "fileSize" SET DATA TYPE BIGINT;

-- CreateIndex
CREATE INDEX "FirmPaymentDistribution_caId_idx" ON "FirmPaymentDistribution"("caId");

-- AddForeignKey
ALTER TABLE "FirmPaymentDistribution" ADD CONSTRAINT "FirmPaymentDistribution_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================
-- CUSTOM CONSTRAINTS FOR DATA INTEGRITY
-- ==========================================

-- CRITICAL FIX #1: Single Active Firm Per CA
-- Ensures a CA can belong to ONLY ONE active firm at a time
CREATE UNIQUE INDEX "unique_active_ca_membership" ON "FirmMembership" ("caId")
WHERE "isActive" = true;

-- CRITICAL FIX #2: Rating Range Constraints (1-5 stars)
ALTER TABLE "FirmReview"
ADD CONSTRAINT "rating_range" CHECK ("rating" >= 1 AND "rating" <= 5),
ADD CONSTRAINT "professionalism_range" CHECK ("professionalismRating" IS NULL OR ("professionalismRating" >= 1 AND "professionalismRating" <= 5)),
ADD CONSTRAINT "communication_range" CHECK ("communicationRating" IS NULL OR ("communicationRating" >= 1 AND "communicationRating" <= 5)),
ADD CONSTRAINT "timeliness_range" CHECK ("timelinessRating" IS NULL OR ("timelinessRating" >= 1 AND "timelinessRating" <= 5)),
ADD CONSTRAINT "value_range" CHECK ("valueForMoneyRating" IS NULL OR ("valueForMoneyRating" >= 1 AND "valueForMoneyRating" <= 5));

-- Also apply to existing Review model if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_rating_range'
  ) THEN
    ALTER TABLE "Review"
    ADD CONSTRAINT "review_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5);
  END IF;
END $$;

-- CRITICAL FIX #3: Auto-Assignment Score Range (0-100)
ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "auto_assignment_score_range" CHECK ("autoAssignmentScore" IS NULL OR ("autoAssignmentScore" >= 0 AND "autoAssignmentScore" <= 100));

-- CRITICAL FIX #4: Minimum CA Required (must be >= 2)
ALTER TABLE "CAFirm"
ADD CONSTRAINT "minimum_ca_required_range" CHECK ("minimumCARequired" >= 2);

-- CRITICAL FIX #5: Established Year Validation (realistic range)
ALTER TABLE "CAFirm"
ADD CONSTRAINT "established_year_realistic" CHECK ("establishedYear" >= 1900 AND "establishedYear" <= EXTRACT(YEAR FROM CURRENT_DATE));

-- CRITICAL FIX #6: Commission Percent Range Constraints (0-100%)
ALTER TABLE "FirmMembership"
ADD CONSTRAINT "commission_percent_range" CHECK ("commissionPercent" IS NULL OR ("commissionPercent" >= 0 AND "commissionPercent" <= 100));

ALTER TABLE "IndependentWorkRequest"
ADD CONSTRAINT "firm_commission_range" CHECK ("firmCommissionPercent" IS NULL OR ("firmCommissionPercent" >= 0 AND "firmCommissionPercent" <= 100));

ALTER TABLE "FirmPaymentDistribution"
ADD CONSTRAINT "platform_fee_range" CHECK ("platformFeePercent" >= 0 AND "platformFeePercent" <= 100),
ADD CONSTRAINT "firm_commission_range_dist" CHECK ("firmCommissionPercent" >= 0 AND "firmCommissionPercent" <= 100);

ALTER TABLE "CAFirm"
ADD CONSTRAINT "platform_fee_percent_range" CHECK ("platformFeePercent" >= 0 AND "platformFeePercent" <= 100);

-- CRITICAL FIX #7: Payment Amount Validations
ALTER TABLE "Payment"
ADD CONSTRAINT "payment_platform_fee_positive" CHECK ("platformFee" IS NULL OR "platformFee" >= 0),
ADD CONSTRAINT "payment_amounts_positive" CHECK ("amount" >= 0 AND ("caAmount" IS NULL OR "caAmount" >= 0) AND ("firmAmount" IS NULL OR "firmAmount" >= 0));
