-- Add chat_url column to prompt_sessions and supporting index
ALTER TABLE public.prompt_sessions
ADD COLUMN IF NOT EXISTS chat_url TEXT;
