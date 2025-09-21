-- Add publishing preferences to user_preferences table
ALTER TABLE user_preferences
ADD COLUMN publishing_preferences JSONB DEFAULT '{"default_action": "none", "platforms": {}}'::jsonb;

-- Add a comment for documentation
COMMENT ON COLUMN user_preferences.publishing_preferences IS 'User publishing preferences including default action and platform-specific settings';

-- Add a check constraint to ensure valid default_action values
ALTER TABLE user_preferences
ADD CONSTRAINT check_publishing_preferences_default_action
CHECK (
  publishing_preferences->>'default_action' IN ('none', 'tiktok', 'youtube', 'both')
);

-- Create an index on the default_action for efficient queries
CREATE INDEX idx_user_preferences_publishing_default_action
ON user_preferences ((publishing_preferences->>'default_action'));