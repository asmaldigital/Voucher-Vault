-- SuperSave Voucher Management System
-- Run these SQL statements in your Supabase SQL Editor

-- 1. Create vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT UNIQUE NOT NULL,
  value INTEGER DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed', 'expired', 'voided')),
  batch_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_by_email TEXT
);

-- 2. Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('created', 'redeemed', 'voided', 'expired', 'imported')),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vouchers_barcode ON vouchers(barcode);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_batch_number ON vouchers(batch_number);
CREATE INDEX IF NOT EXISTS idx_vouchers_redeemed_at ON vouchers(redeemed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_voucher_id ON audit_log(voucher_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- 4. Enable Row Level Security
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for vouchers table

-- All authenticated users can read vouchers
CREATE POLICY "Authenticated users can read vouchers" ON vouchers
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert vouchers (for import functionality)
CREATE POLICY "Authenticated users can insert vouchers" ON vouchers
  FOR INSERT
  TO authenticated
  WITH CHECK (status = 'available');

-- Redemption: Only allow updating status from 'available' to 'redeemed'
-- This prevents arbitrary state changes and protects against double-redemption
CREATE POLICY "Authenticated users can redeem available vouchers" ON vouchers
  FOR UPDATE
  TO authenticated
  USING (status = 'available')
  WITH CHECK (status = 'redeemed');

-- 6. Create RLS policies for audit_log table

-- All authenticated users can read audit logs
CREATE POLICY "Authenticated users can read audit_log" ON audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert audit logs
CREATE POLICY "Authenticated users can insert audit_log" ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7. OPTIONAL: Allow admin users to void vouchers
-- Uncomment and modify if you need admin functionality
-- CREATE POLICY "Admins can void vouchers" ON vouchers
--   FOR UPDATE
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM auth.users 
--       WHERE id = auth.uid() 
--       AND raw_user_meta_data->>'role' = 'admin'
--     )
--   )
--   WITH CHECK (status IN ('voided', 'expired'));
