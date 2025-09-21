-- Extended User Preferences Schema and Trigger Function
-- This migration adds extended user preferences fields and creates the auto-creation trigger

-- First, add the new columns to the existing user_preferences table
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#3b82f6';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS preferred_font TEXT DEFAULT 'sans-serif' CHECK (preferred_font IN ('sans-serif', 'serif', 'monospace'));
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS tone_of_voice TEXT DEFAULT 'enthusiastic' CHECK (tone_of_voice IN ('enthusiastic', 'professional', 'casual', 'humorous'));
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS default_cta TEXT DEFAULT 'Like and follow for more!';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS content_pillars TEXT[] DEFAULT ARRAY['Education', 'Entertainment', 'Inspiration'];

-- Update the handle_new_user function to include the new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_preferences (
        user_id,
        ai_voice_id,
        video_style_preference,
        preferred_video_length,
        auto_generate_enabled,
        notification_preferences,
        brand_color,
        preferred_font,
        tone_of_voice,
        default_cta,
        content_pillars
    )
    VALUES (
        NEW.id,
        '21m00Tcm4TlvDq8ikWAM', -- Default ElevenLabs voice
        'modern',
        15,
        false,
        '{"email": true, "push": false}'::jsonb,
        '#3b82f6', -- Default blue brand color
        'sans-serif',
        'enthusiastic',
        'Like and follow for more!',
        ARRAY['Education', 'Entertainment', 'Inspiration']
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- User preferences already exist, ignore
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to create user preferences for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Ensure the trigger exists (it should already exist from the previous migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create an index for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id_unique ON public.user_preferences(user_id);

-- Update RLS policies to ensure users can only access their own preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;

CREATE POLICY "Users can view their own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON public.user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Function to get or create user preferences (helpful for API)
CREATE OR REPLACE FUNCTION public.get_or_create_user_preferences(p_user_id UUID)
RETURNS SETOF public.user_preferences
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result public.user_preferences;
BEGIN
    -- Try to get existing preferences
    SELECT * INTO result
    FROM public.user_preferences
    WHERE user_id = p_user_id;

    -- If no preferences exist, create them
    IF NOT FOUND THEN
        INSERT INTO public.user_preferences (
            user_id,
            ai_voice_id,
            video_style_preference,
            preferred_video_length,
            auto_generate_enabled,
            notification_preferences,
            brand_color,
            preferred_font,
            tone_of_voice,
            default_cta,
            content_pillars
        )
        VALUES (
            p_user_id,
            '21m00Tcm4TlvDq8ikWAM',
            'modern',
            15,
            false,
            '{"email": true, "push": false}'::jsonb,
            '#3b82f6',
            'sans-serif',
            'enthusiastic',
            'Like and follow for more!',
            ARRAY['Education', 'Entertainment', 'Inspiration']
        )
        RETURNING * INTO result;
    END IF;

    RETURN NEXT result;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_user_preferences(UUID) TO authenticated;