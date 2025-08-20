-- Add is_admin column to user_profiles if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add status column to prompt_sessions for tracking success/failure
ALTER TABLE prompt_sessions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending'));

-- Add response_time_ms column for metrics
ALTER TABLE prompt_sessions 
ADD COLUMN IF NOT EXISTS response_time_ms INT DEFAULT 0;

-- Create daily_metrics table
CREATE TABLE IF NOT EXISTS public.daily_metrics (
  date DATE PRIMARY KEY,
  prompts_processed INT NOT NULL DEFAULT 0,
  failed_calls INT NOT NULL DEFAULT 0,
  new_signups INT NOT NULL DEFAULT 0,
  revenue_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create incidents table for system alerts
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update existing payments table to match expected schema (only if columns don't exist)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update payments status values to match new schema
UPDATE payments SET status = 'completed' WHERE status = 'succeeded';

-- Add RLS policies for incidents table (public read)
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Anyone can read incidents (for status page)
CREATE POLICY "Anyone can view incidents" ON incidents
  FOR SELECT USING (true);

-- Only admins can manage incidents
CREATE POLICY "Admins can manage incidents" ON incidents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Add RLS policies for daily_metrics (admin only)
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can access daily metrics
CREATE POLICY "Admins can access daily_metrics" ON daily_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Update function for timestamps (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at (only for new tables)
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_metrics_updated_at ON daily_metrics;
CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
