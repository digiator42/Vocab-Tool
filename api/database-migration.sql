-- Multi-User Sync System Database Migration
-- Run this SQL in your Supabase SQL Editor

-- Add password_hash column to flashcards_sync table
ALTER TABLE flashcards_sync 
ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- Create index for faster lookups by password hash
CREATE INDEX IF NOT EXISTS idx_password_hash ON flashcards_sync(password_hash);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN flashcards_sync.password_hash IS 'SHA-256 hash of user password, used for user identification and data isolation';

-- Note: You can remove the SYNC_PASSWORD environment variable from your Vercel project settings
-- after confirming the new system works correctly.
