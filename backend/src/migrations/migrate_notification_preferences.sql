-- =======================================================
-- Migration: Generalize notification_preferences
-- Run this ONCE in your database before restarting backend
-- =======================================================

-- Step 1: Delete all existing per-hotel preference rows
-- (They will be recreated as a single global preference per user on next toggle)
DELETE FROM notification_preferences;

-- Step 2: Drop the old unique constraint on (account_id, hotel_id)
-- Find the constraint name first with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'notification_preferences'::regclass;
-- Then replace the name below if different:
ALTER TABLE notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_account_id_hotel_id_key;

-- Step 3: Drop the hotel_id column (Sequelize alter:true will do this too,
-- but removing the NOT NULL column explicitly avoids constraint errors)
ALTER TABLE notification_preferences
  DROP COLUMN IF EXISTS hotel_id;

-- Step 4: Add a new unique constraint on account_id alone
ALTER TABLE notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_account_id_key;

ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_account_id_key UNIQUE (account_id);

-- Done! Now restart your backend server.
