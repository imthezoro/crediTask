-- Add is_guest column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;