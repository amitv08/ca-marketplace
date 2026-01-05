-- Enable Row Level Security for CA Marketplace
-- This provides database-level security enforcement
-- Run this migration after setting up your database

-- Enable RLS on key tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharteredAccountant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Create function to get current user ID from session
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', TRUE);
$$ LANGUAGE SQL STABLE;

-- Create function to get current user role from session
CREATE OR REPLACE FUNCTION current_user_role() RETURNS "UserRole" AS $$
  SELECT CAST(current_setting('app.current_user_role', TRUE) AS "UserRole");
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- USER TABLE POLICIES
-- ============================================================

-- Super admins can see all users
CREATE POLICY user_super_admin_all ON "User"
  FOR ALL
  TO PUBLIC
  USING (current_user_role() = 'SUPER_ADMIN');

-- Admins can see all users (read-only for regular admins)
CREATE POLICY user_admin_read ON "User"
  FOR SELECT
  TO PUBLIC
  USING (current_user_role() = 'ADMIN');

-- Users can see their own profile
CREATE POLICY user_own_profile ON "User"
  FOR ALL
  TO PUBLIC
  USING (id = current_user_id());

-- Clients can see CA profiles
CREATE POLICY user_client_see_cas ON "User"
  FOR SELECT
  TO PUBLIC
  USING (
    current_user_role() = 'CLIENT'
    AND role = 'CA'
  );

-- CAs can see their clients
CREATE POLICY user_ca_see_clients ON "User"
  FOR SELECT
  TO PUBLIC
  USING (
    current_user_role() = 'CA'
    AND EXISTS (
      SELECT 1 FROM "Client" c
      JOIN "ServiceRequest" sr ON sr."clientId" = c.id
      JOIN "CharteredAccountant" ca ON ca.id = sr."caId"
      WHERE c."userId" = "User".id
      AND ca."userId" = current_user_id()
    )
  );

-- ============================================================
-- SERVICE REQUEST POLICIES
-- ============================================================

-- Super admins can access all requests
CREATE POLICY request_super_admin_all ON "ServiceRequest"
  FOR ALL
  TO PUBLIC
  USING (current_user_role() = 'SUPER_ADMIN');

-- Admins can view all requests
CREATE POLICY request_admin_read ON "ServiceRequest"
  FOR SELECT
  TO PUBLIC
  USING (current_user_role() = 'ADMIN');

-- Clients can access their own requests
CREATE POLICY request_client_own ON "ServiceRequest"
  FOR ALL
  TO PUBLIC
  USING (
    current_user_role() = 'CLIENT'
    AND EXISTS (
      SELECT 1 FROM "Client" c
      WHERE c.id = "ServiceRequest"."clientId"
      AND c."userId" = current_user_id()
    )
  );

-- CAs can access their assigned requests
CREATE POLICY request_ca_assigned ON "ServiceRequest"
  FOR ALL
  TO PUBLIC
  USING (
    current_user_role() = 'CA'
    AND EXISTS (
      SELECT 1 FROM "CharteredAccountant" ca
      WHERE ca.id = "ServiceRequest"."caId"
      AND ca."userId" = current_user_id()
    )
  );

-- ============================================================
-- PAYMENT POLICIES
-- ============================================================

-- Super admins can access all payments
CREATE POLICY payment_super_admin_all ON "Payment"
  FOR ALL
  TO PUBLIC
  USING (current_user_role() = 'SUPER_ADMIN');

-- Admins can view all payments
CREATE POLICY payment_admin_read ON "Payment"
  FOR SELECT
  TO PUBLIC
  USING (current_user_role() = 'ADMIN');

-- Admins can release payments
CREATE POLICY payment_admin_release ON "Payment"
  FOR UPDATE
  TO PUBLIC
  USING (
    current_user_role() = 'ADMIN'
    AND "releasedToCA" = FALSE
  )
  WITH CHECK (
    current_user_role() = 'ADMIN'
  );

-- Clients can view their payments
CREATE POLICY payment_client_own ON "Payment"
  FOR SELECT
  TO PUBLIC
  USING (
    current_user_role() = 'CLIENT'
    AND EXISTS (
      SELECT 1 FROM "Client" c
      WHERE c.id = "Payment"."clientId"
      AND c."userId" = current_user_id()
    )
  );

-- CAs can view their earnings
CREATE POLICY payment_ca_own ON "Payment"
  FOR SELECT
  TO PUBLIC
  USING (
    current_user_role() = 'CA'
    AND EXISTS (
      SELECT 1 FROM "CharteredAccountant" ca
      WHERE ca.id = "Payment"."caId"
      AND ca."userId" = current_user_id()
    )
  );

-- ============================================================
-- MESSAGE POLICIES
-- ============================================================

-- Super admins and admins can see all messages
CREATE POLICY message_admin_all ON "Message"
  FOR SELECT
  TO PUBLIC
  USING (
    current_user_role() = 'SUPER_ADMIN'
    OR current_user_role() = 'ADMIN'
  );

-- Users can see messages they sent or received
CREATE POLICY message_user_own ON "Message"
  FOR ALL
  TO PUBLIC
  USING (
    "senderId" = current_user_id()
    OR "receiverId" = current_user_id()
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to set user context
CREATE OR REPLACE FUNCTION set_user_context(user_id TEXT, user_role "UserRole") RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, FALSE);
  PERFORM set_config('app.current_user_role', user_role::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to clear user context
CREATE OR REPLACE FUNCTION clear_user_context() RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', '', FALSE);
  PERFORM set_config('app.current_user_role', '', FALSE);
END;
$$ LANGUAGE plpgsql;
