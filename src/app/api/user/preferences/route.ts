import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Publishing preferences interfaces
export interface PublishingPreferences {
  default_action: 'none' | 'tiktok' | 'youtube' | 'both';
  platforms: {
    tiktok?: {
      enabled: boolean;
      auto_publish: boolean;
      privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
    };
    youtube?: {
      enabled: boolean;
      auto_publish: boolean;
      privacy_status: 'public' | 'unlisted' | 'private';
      category_id: string;
    };
  };
}

// TypeScript interface matching the database schema
export interface UserPreferences {
  id: string;
  user_id: string;
  ai_voice_id: string;
  video_style_preference: string;
  preferred_video_length: number;
  auto_generate_enabled: boolean;
  notification_preferences: {
    email: boolean;
    push: boolean;
  };
  brand_color: string;
  preferred_font: 'sans-serif' | 'serif' | 'monospace';
  tone_of_voice: 'enthusiastic' | 'professional' | 'casual' | 'humorous';
  default_cta: string;
  content_pillars: string[];
  publishing_preferences: PublishingPreferences;
  created_at: string;
  updated_at: string;
}

// Partial interface for updates (excludes readonly fields)
export interface UserPreferencesUpdate {
  ai_voice_id?: string;
  video_style_preference?: string;
  preferred_video_length?: number;
  auto_generate_enabled?: boolean;
  notification_preferences?: {
    email: boolean;
    push: boolean;
  };
  brand_color?: string;
  preferred_font?: 'sans-serif' | 'serif' | 'monospace';
  tone_of_voice?: 'enthusiastic' | 'professional' | 'casual' | 'humorous';
  default_cta?: string;
  content_pillars?: string[];
  publishing_preferences?: PublishingPreferences;
}

/**
 * GET /api/user/preferences
 * Fetches the current user's preferences
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Try to get existing preferences first
    const { data: existingPreferences, error: selectError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('Error fetching user preferences:', selectError);
      console.error('Supabase error details:', {
        message: selectError.message,
        code: selectError.code,
        details: selectError.details,
        hint: selectError.hint,
      });

      // Check if the error is due to missing table
      if (selectError.code === 'PGRST116' || selectError.message.includes('relation "user_preferences" does not exist')) {
        return NextResponse.json(
          {
            error: 'Database schema not initialized. Please run database migrations first.',
            code: 'SCHEMA_MISSING',
            details: 'The user_preferences table does not exist. Run the Supabase migrations to create it.'
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch preferences',
          details: selectError.message
        },
        { status: 500 }
      );
    }

    // If preferences don't exist, use the database function to create them
    if (!existingPreferences) {
      const { data: createdPreferences, error: createError } = await supabase
        .rpc('get_or_create_user_preferences', { p_user_id: user.id });

      if (createError) {
        console.error('Error creating user preferences:', createError);
        return NextResponse.json(
          { error: 'Failed to create preferences' },
          { status: 500 }
        );
      }

      return NextResponse.json(createdPreferences[0]);
    }

    return NextResponse.json(existingPreferences);

  } catch (error) {
    console.error('User preferences GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/preferences
 * Updates the current user's preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let preferences: UserPreferencesUpdate;
    try {
      preferences = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Validate preferences data
    const validationError = validatePreferences(preferences);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // Ensure user preferences exist first
    const { data: existingPrefs } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingPrefs) {
      // Create preferences using the database function
      await supabase.rpc('get_or_create_user_preferences', { p_user_id: user.id });
    }

    // Update user preferences
    const { data: updatedPreferences, error: updateError } = await supabase
      .from('user_preferences')
      .update({
        ...preferences,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user preferences:', updateError);
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Preferences updated successfully',
      preferences: updatedPreferences,
    });

  } catch (error) {
    console.error('User preferences PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validates user preferences data
 */
function validatePreferences(preferences: UserPreferencesUpdate): string | null {
  // Validate preferred_font
  if (preferences.preferred_font && !['sans-serif', 'serif', 'monospace'].includes(preferences.preferred_font)) {
    return 'Invalid preferred_font. Must be one of: sans-serif, serif, monospace';
  }

  // Validate tone_of_voice
  if (preferences.tone_of_voice && !['enthusiastic', 'professional', 'casual', 'humorous'].includes(preferences.tone_of_voice)) {
    return 'Invalid tone_of_voice. Must be one of: enthusiastic, professional, casual, humorous';
  }

  // Validate brand_color (basic hex color validation)
  if (preferences.brand_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(preferences.brand_color)) {
    return 'Invalid brand_color. Must be a valid hex color (e.g., #3b82f6)';
  }

  // Validate preferred_video_length
  if (preferences.preferred_video_length && (preferences.preferred_video_length < 5 || preferences.preferred_video_length > 60)) {
    return 'Invalid preferred_video_length. Must be between 5 and 60 seconds';
  }

  // Validate content_pillars array
  if (preferences.content_pillars) {
    if (!Array.isArray(preferences.content_pillars)) {
      return 'content_pillars must be an array';
    }
    if (preferences.content_pillars.length > 10) {
      return 'content_pillars cannot have more than 10 items';
    }
    if (preferences.content_pillars.some(pillar => typeof pillar !== 'string' || pillar.trim().length === 0)) {
      return 'All content_pillars must be non-empty strings';
    }
  }

  // Validate default_cta length
  if (preferences.default_cta && preferences.default_cta.length > 100) {
    return 'default_cta cannot be longer than 100 characters';
  }

  // Validate ai_voice_id (basic format check)
  if (preferences.ai_voice_id && preferences.ai_voice_id.trim().length === 0) {
    return 'ai_voice_id cannot be empty';
  }

  // Validate publishing_preferences
  if (preferences.publishing_preferences) {
    const pubPrefs = preferences.publishing_preferences;

    // Validate default_action
    if (!['none', 'tiktok', 'youtube', 'both'].includes(pubPrefs.default_action)) {
      return 'Invalid publishing_preferences.default_action. Must be one of: none, tiktok, youtube, both';
    }

    // Validate TikTok platform settings if present
    if (pubPrefs.platforms?.tiktok) {
      const tiktok = pubPrefs.platforms.tiktok;
      if (typeof tiktok.enabled !== 'boolean' || typeof tiktok.auto_publish !== 'boolean') {
        return 'Invalid TikTok platform settings. enabled and auto_publish must be boolean';
      }
      if (!['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'].includes(tiktok.privacy_level)) {
        return 'Invalid TikTok privacy_level. Must be one of: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY';
      }
    }

    // Validate YouTube platform settings if present
    if (pubPrefs.platforms?.youtube) {
      const youtube = pubPrefs.platforms.youtube;
      if (typeof youtube.enabled !== 'boolean' || typeof youtube.auto_publish !== 'boolean') {
        return 'Invalid YouTube platform settings. enabled and auto_publish must be boolean';
      }
      if (!['public', 'unlisted', 'private'].includes(youtube.privacy_status)) {
        return 'Invalid YouTube privacy_status. Must be one of: public, unlisted, private';
      }
      if (!youtube.category_id || typeof youtube.category_id !== 'string') {
        return 'Invalid YouTube category_id. Must be a valid string';
      }
    }
  }

  return null; // No validation errors
}