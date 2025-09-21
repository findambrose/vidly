-- Social Connections Table for OAuth Integrations
-- This migration creates the social_connections table for storing OAuth tokens

-- Create the social_connections table
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'instagram', 'twitter')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_in INTEGER, -- Token expiration time in seconds
  expires_at TIMESTAMPTZ, -- Calculated expiration timestamp
  platform_user_id TEXT, -- The user's ID on the platform
  platform_username TEXT, -- The user's username on the platform
  platform_display_name TEXT, -- The user's display name on the platform
  scopes TEXT[], -- Array of granted scopes
  token_type TEXT DEFAULT 'Bearer',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_platform UNIQUE (user_id, platform)
);

-- Enable RLS on the social_connections table
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own social connections" ON public.social_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social connections" ON public.social_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social connections" ON public.social_connections
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social connections" ON public.social_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_social_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_social_connections_updated_at();

-- Create function to calculate expires_at from expires_in
CREATE OR REPLACE FUNCTION public.calculate_token_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_in IS NOT NULL THEN
    NEW.expires_at = NOW() + INTERVAL '1 second' * NEW.expires_in;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_token_expiration_trigger
  BEFORE INSERT OR UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.calculate_token_expiration();

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_social_connections_user_platform
  ON public.social_connections(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_social_connections_platform_user_id
  ON public.social_connections(platform, platform_user_id);

-- Grant necessary permissions
GRANT ALL ON public.social_connections TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add publishing status fields to user_videos table
ALTER TABLE public.user_videos ADD COLUMN IF NOT EXISTS publishing_status TEXT DEFAULT 'not_published' CHECK (
  publishing_status IN ('not_published', 'publishing', 'published', 'publish_failed')
);

ALTER TABLE public.user_videos ADD COLUMN IF NOT EXISTS published_url TEXT;
ALTER TABLE public.user_videos ADD COLUMN IF NOT EXISTS publish_error TEXT;
ALTER TABLE public.user_videos ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.user_videos ADD COLUMN IF NOT EXISTS platform_post_id TEXT;