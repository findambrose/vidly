-- ShortsForge MVP Database Schema
-- This migration creates the core tables for the ShortsForge application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- User Preferences Table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    ai_voice_id TEXT DEFAULT '21m00Tcm4TlvDq8ikWAM', -- Default ElevenLabs voice
    video_style_preference TEXT DEFAULT 'modern',
    preferred_video_length INTEGER DEFAULT 15, -- seconds
    auto_generate_enabled BOOLEAN DEFAULT false,
    notification_preferences JSONB DEFAULT '{"email": true, "push": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create trigger for user_preferences updated_at
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trends Table (for storing aggregated trending topics)
CREATE TABLE IF NOT EXISTS public.trends (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    source TEXT, -- e.g., 'twitter', 'tiktok', 'manual'
    hashtags TEXT[], -- array of relevant hashtags
    trending_score INTEGER DEFAULT 0, -- popularity score
    region TEXT DEFAULT 'global', -- trending region
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb, -- additional data
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create trigger for trends updated_at
CREATE TRIGGER update_trends_updated_at
    BEFORE UPDATE ON public.trends
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User Videos Table (core table for tracking video generation)
CREATE TABLE IF NOT EXISTS public.user_videos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trend_id UUID REFERENCES public.trends(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    script_text TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

    -- File URLs
    voiceover_url TEXT,
    background_video_url TEXT,
    final_video_url TEXT,
    thumbnail_url TEXT,

    -- Generation metadata
    generation_started_at TIMESTAMPTZ,
    generation_completed_at TIMESTAMPTZ,
    error_message TEXT,
    generation_settings JSONB DEFAULT '{}'::jsonb,

    -- Video specifications
    duration_seconds INTEGER DEFAULT 15,
    resolution TEXT DEFAULT '1080x1920', -- TikTok format
    aspect_ratio TEXT DEFAULT '9:16',

    -- Analytics and engagement
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create trigger for user_videos updated_at
CREATE TRIGGER update_user_videos_updated_at
    BEFORE UPDATE ON public.user_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_trends_is_active ON public.trends(is_active);
CREATE INDEX IF NOT EXISTS idx_trends_trending_score ON public.trends(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_trends_category ON public.trends(category);
CREATE INDEX IF NOT EXISTS idx_user_videos_user_id ON public.user_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_status ON public.user_videos(status);
CREATE INDEX IF NOT EXISTS idx_user_videos_trend_id ON public.user_videos(trend_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_created_at ON public.user_videos(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

-- Policies for user_preferences
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for trends (public read, admin write)
CREATE POLICY "Anyone can view active trends" ON public.trends
    FOR SELECT USING (is_active = true);

-- Policies for user_videos
CREATE POLICY "Users can view their own videos" ON public.user_videos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos" ON public.user_videos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" ON public.user_videos
    FOR UPDATE USING (auth.uid() = user_id);

-- Insert some sample trending topics for testing
INSERT INTO public.trends (title, description, category, hashtags, trending_score, source) VALUES
    ('AI Technology Breakthroughs', 'Latest developments in artificial intelligence and machine learning', 'technology', ARRAY['#AI', '#Technology', '#Innovation'], 95, 'manual'),
    ('Sustainable Living Tips', 'Eco-friendly lifestyle changes and environmental awareness', 'lifestyle', ARRAY['#Sustainability', '#EcoFriendly', '#GreenLiving'], 87, 'manual'),
    ('Remote Work Productivity', 'Tips and tools for effective remote work and digital nomad lifestyle', 'business', ARRAY['#RemoteWork', '#Productivity', '#WorkFromHome'], 82, 'manual'),
    ('Mental Health Awareness', 'Promoting mental wellness and breaking stigma around mental health', 'health', ARRAY['#MentalHealth', '#Wellness', '#SelfCare'], 78, 'manual'),
    ('Cryptocurrency Updates', 'Latest news and trends in digital currencies and blockchain', 'finance', ARRAY['#Crypto', '#Blockchain', '#DigitalCurrency'], 73, 'manual'),
    ('Fitness Motivation', 'Home workouts, fitness challenges, and healthy lifestyle inspiration', 'health', ARRAY['#Fitness', '#Workout', '#HealthyLife'], 69, 'manual');

-- Create a function to automatically create user preferences when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

-- Create trigger to automatically create user preferences
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();