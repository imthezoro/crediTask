-- Add device_id and ip_address columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT NULL;
