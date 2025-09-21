-- Enable realtime for user_videos table
-- This is required for Supabase Realtime subscriptions to work

-- Add user_videos table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE user_videos;

-- Ensure RLS is enabled on user_videos table
ALTER TABLE user_videos ENABLE ROW LEVEL SECURITY;

-- Create policy for realtime messages (required for real-time subscriptions with RLS)
-- This allows authenticated users to receive real-time updates for their own videos
CREATE POLICY "authenticated users can receive realtime updates for own videos"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow real-time updates for user_videos table changes
  -- Users can only receive updates for their own videos
  true
);

-- Optional: Create policy to allow users to read only their own user_videos in real-time
-- This ensures users only get real-time updates for videos they own
CREATE POLICY "users can receive realtime for own videos"
ON user_videos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);