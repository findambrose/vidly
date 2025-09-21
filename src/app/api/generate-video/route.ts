import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { trendId } = body;

    if (!trendId) {
      return NextResponse.json(
        { error: 'trendId is required', success: false },
        { status: 400 }
      );
    }

    // Check user's subscription status with Paddle (pseudo-code as requested)
    // TODO: Implement actual Paddle subscription check
    const hasActiveSubscription = await checkUserSubscription(user.id);

    if (!hasActiveSubscription) {
      return NextResponse.json(
        { error: 'Active subscription required', success: false },
        { status: 403 }
      );
    }

    // Check user's video generation limits
    const { data: userVideos, error: videosError } = await supabase
      .from('user_videos')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (videosError) {
      console.error('Error checking user videos:', videosError);
      return NextResponse.json(
        { error: 'Failed to check video limits', success: false },
        { status: 500 }
      );
    }

    // Enforce daily limits (adjust as needed)
    const dailyLimit = 1000;
    if (userVideos && userVideos.length >= dailyLimit) {
      return NextResponse.json(
        { error: 'Daily video generation limit reached', success: false },
        { status: 429 }
      );
    }

    // Verify the trend exists and is active
    const { data: trend, error: trendError } = await supabase
      .from('trends')
      .select('id, title, is_active')
      .eq('id', trendId)
      .eq('is_active', true)
      .single();

    if (trendError || !trend) {
      return NextResponse.json(
        { error: 'Trend not found or inactive', success: false },
        { status: 404 }
      );
    }

    // Check for existing video for this trend by this user
    const { data: existingVideo, error: existingVideoError } = await supabase
      .from('user_videos')
      .select('id, status, title')
      .eq('user_id', user.id)
      .eq('trend_id', trendId)
      .single();

    if (existingVideoError && existingVideoError.code !== 'PGRST116') {
      console.error('Error checking existing videos:', existingVideoError);
      return NextResponse.json(
        { error: 'Failed to check existing videos', success: false },
        { status: 500 }
      );
    }

    // If video exists and is processing or completed, prevent duplicate
    if (existingVideo) {
      if (existingVideo.status === 'processing' || existingVideo.status === 'queued') {
        return NextResponse.json(
          {
            error: 'Video is already being generated for this trend',
            success: false,
            existingVideoId: existingVideo.id,
            status: existingVideo.status
          },
          { status: 409 }
        );
      }

      if (existingVideo.status === 'completed') {
        return NextResponse.json(
          {
            error: 'Video already exists for this trend',
            success: false,
            existingVideoId: existingVideo.id,
            status: existingVideo.status
          },
          { status: 409 }
        );
      }

      // If status is 'failed' or 'cancelled', allow regeneration
      if (existingVideo.status === 'failed' || existingVideo.status === 'cancelled') {
        console.log(`Allowing regeneration for failed/cancelled video: ${existingVideo.id}`);
      }
    }

    // Get user's publishing preferences
    const { data: userPreferences, error: prefsError } = await supabase
      .from('user_preferences')
      .select('publishing_preferences')
      .eq('user_id', user.id)
      .maybeSingle();

    if (prefsError) {
      console.error('Error fetching user preferences:', prefsError);
      // Continue with default behavior (none) if we can't fetch preferences
    }

    // Extract publishing action from user preferences
    const publishAction = userPreferences?.publishing_preferences?.default_action || 'none';

    // Send request to n8n webhook
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.error('N8N_WEBHOOK_URL environment variable not set');
      return NextResponse.json(
        { error: 'Video generation service unavailable', success: false },
        { status: 503 }
      );
    }

    const webhookPayload = {
      userId: user.id,
      trendId: trendId,
      publishAction: publishAction,
    };

    // Debug logging before webhook call
    console.log('=== N8N WEBHOOK DEBUG START ===');
    console.log('Webhook URL:', n8nWebhookUrl);
    console.log('Payload:', JSON.stringify(webhookPayload, null, 2));
    console.log('About to call n8n webhook...');

    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    // Debug logging after webhook response
    console.log('=== N8N WEBHOOK RESPONSE DEBUG ===');
    console.log('Response status:', webhookResponse.status);
    console.log('Response statusText:', webhookResponse.statusText);
    console.log('Response headers:', Object.fromEntries(webhookResponse.headers.entries()));

    if (!webhookResponse.ok) {
      console.error('=== N8N WEBHOOK ERROR ===');
      console.error('Status:', webhookResponse.status);
      console.error('StatusText:', webhookResponse.statusText);

      // Try to get error body if available
      try {
        const errorText = await webhookResponse.text();
        console.error('Error body:', errorText);
      } catch (e) {
        console.error('Could not read error body:', e);
      }

      console.log('=== N8N WEBHOOK DEBUG END ===');
      return NextResponse.json(
        { error: 'Failed to start video generation', success: false },
        { status: 502 }
      );
    }

    const webhookResult = await webhookResponse.json();
    console.log('=== N8N WEBHOOK SUCCESS ===');
    console.log('Webhook result:', JSON.stringify(webhookResult, null, 2));
    console.log('=== N8N WEBHOOK DEBUG END ===');

    // Return success response
    return NextResponse.json({
      message: 'Video generation started',
      success: true,
      trendTitle: trend.title,
    });

  } catch (error) {
    console.error('Video generation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

// Pseudo-code for Paddle subscription check
// Replace this with actual Paddle API integration
async function checkUserSubscription(userId: string): Promise<boolean> {
  // TODO: Implement actual Paddle subscription verification
  // This should check if the user has an active subscription
  // using Paddle's API or your local subscription cache

  // For now, return true for development
  // In production, implement proper subscription checking:

  /*
  try {
    const paddle = getPaddleInstance();
    const subscriptions = await paddle.subscriptions.list({
      customerId: userId,
      status: ['active', 'trialing']
    });

    return subscriptions.data.length > 0;
  } catch (error) {
    console.error('Paddle subscription check error:', error);
    return false;
  }
  */

  return true; // Development mode - allow all users
}