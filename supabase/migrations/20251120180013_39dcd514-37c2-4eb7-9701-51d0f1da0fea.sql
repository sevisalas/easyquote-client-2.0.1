-- Add theme selection column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_theme TEXT DEFAULT 'default';

-- Add comment
COMMENT ON COLUMN profiles.selected_theme IS 'Selected theme name for the user (default, ocean, forest, sunset, midnight)';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_selected_theme ON profiles(selected_theme);