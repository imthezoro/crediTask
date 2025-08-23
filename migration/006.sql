-- Add device_id and ip_address columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT NULL;

-- Create index on device_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_device_id ON user_profiles(device_id);

-- Create index on ip_address for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_ip_address ON user_profiles(ip_address);