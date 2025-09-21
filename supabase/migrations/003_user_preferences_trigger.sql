-- Create function to handle new user preferences defaults
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (
    user_id,
    brand_color,
    preferred_font,
    ai_voice_id,
    tone_of_voice,
    default_cta,
    content_pillars,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    '#3b82f6', -- Default blue color
    'sans-serif',
    'pNInz6obpgDQGcFmaJgB', -- Default ElevenLabs voice ID (Adam)
    'professional',
    'Learn More',
    ARRAY['Education', 'Entertainment', 'Inspiration'],
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user preferences on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();