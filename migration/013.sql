-- 013_audit_logs_table.sql
-- Purpose: Create general audit logs table for tracking various system actions

BEGIN;

-- Create audit_logs table for general audit purposes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    user_email TEXT,
    is_guest BOOLEAN DEFAULT FALSE,
    performed_by UUID,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow service role to read/write audit logs (admin access only)
CREATE POLICY "Service role can manage audit logs" ON audit_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'General audit log for tracking various system actions and events';
COMMENT ON COLUMN audit_logs.user_id IS 'UUID of the user who performed or was affected by the action';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (e.g., deletion, login, signup, profile_update, etc.)';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected (e.g., user_profile, prompt_session, payment, etc.)';
COMMENT ON COLUMN audit_logs.entity_id IS 'UUID of the specific entity affected';
COMMENT ON COLUMN audit_logs.details IS 'Additional details about the action in JSON format';
COMMENT ON COLUMN audit_logs.user_email IS 'Email of the user for reference';
COMMENT ON COLUMN audit_logs.is_guest IS 'Whether this was a guest account';
COMMENT ON COLUMN audit_logs.performed_by IS 'UUID of who performed the action (may differ from user_id for admin actions)';
COMMENT ON COLUMN audit_logs.performed_at IS 'When the action was performed';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address from which the action was performed';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string for web requests';

COMMIT;
