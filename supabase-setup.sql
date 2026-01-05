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

-- 7. Create user_profiles table for role management
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 8. Create index for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- 9. Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 10. RLS policies for user_profiles

-- All authenticated users can read user profiles
CREATE POLICY "Authenticated users can read user_profiles" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert new user profiles
CREATE POLICY "Admins can insert user_profiles" ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Only admins can update user profiles
CREATE POLICY "Admins can update user_profiles" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Only admins can delete user profiles
CREATE POLICY "Admins can delete user_profiles" ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 11. Allow admins to void vouchers
CREATE POLICY "Admins can void vouchers" ON vouchers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (status IN ('voided', 'expired'));

-- 12. Function to automatically create user profile on signup
-- Run this after creating the table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'editor'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Trigger to call the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
