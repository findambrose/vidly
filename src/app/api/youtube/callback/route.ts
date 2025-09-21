import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, getUserChannelInfo } from '@/utils/youtube/client';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      console.error('YouTube OAuth error:', error);
      redirect('/settings?error=oauth_denied');
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      );
    }

    // Verify CSRF state and get code verifier
    const storedState = cookieStore.get('youtube_oauth_state')?.value;
    const storedUserId = cookieStore.get('youtube_oauth_user')?.value;
    const codeVerifier = cookieStore.get('youtube_code_verifier')?.value;

    // Debug logging
    console.log('State verification:', {
      receivedState: state,
      storedState: storedState,
      stateMatch: storedState === state,
      hasUserId: !!storedUserId,
      hasCodeVerifier: !!codeVerifier,
      allCookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
    });

    if (!storedState || !storedUserId || storedState !== state) {
      console.error('CSRF validation failed:', {
        hasStoredState: !!storedState,
        hasStoredUserId: !!storedUserId,
        statesMatch: storedState === state,
        receivedState: state,
        storedState: storedState
      });
      return NextResponse.json(
        { error: 'Invalid state parameter - CSRF protection triggered' },
        { status: 400 }
      );
    }

    if (!codeVerifier) {
      return NextResponse.json(
        { error: 'Missing code verifier - PKCE validation failed' },
        { status: 400 }
      );
    }

    // Clear OAuth cookies
    cookieStore.delete('youtube_oauth_state');
    cookieStore.delete('youtube_oauth_user');
    cookieStore.delete('youtube_code_verifier');

    // Exchange code for access token
    let tokenData;
    try {
      tokenData = await exchangeCodeForTokens(code, codeVerifier);
    } catch (error) {
      console.error('YouTube token exchange failed:', error);
      redirect('/settings?error=token_exchange_failed');
    }

    // Get user info from YouTube
    let userInfo = null;
    try {
      userInfo = await getUserChannelInfo(tokenData.access_token);
    } catch (error) {
      console.warn('Failed to fetch YouTube channel info:', error);
      // Continue without user info - it's not critical
    }

    // Initialize Supabase and store connection
    const supabase = await createClient();

    // Prepare connection data
    const connectionData = {
      user_id: storedUserId,
      platform: 'youtube',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      platform_user_id: userInfo?.id || null,
      platform_username: userInfo?.snippet?.customUrl || userInfo?.snippet?.title || null,
      platform_display_name: userInfo?.snippet?.title || null,
      scopes: tokenData.scope.split(' '),
      token_type: tokenData.token_type,
      is_active: true,
      last_used_at: new Date().toISOString()
    };

    // Insert or update social connection
    const { error: dbError } = await supabase
      .from('social_connections')
      .upsert(connectionData, {
        onConflict: 'user_id,platform',
        ignoreDuplicates: false
      });

    if (dbError) {
      console.error('Database error storing YouTube connection:', dbError);
      redirect('/settings?error=database_error');
    }

    // Success - redirect to settings with success message
    redirect('/settings?connected=youtube');

  } catch (error) {
    console.error('YouTube callback error:', error);
    redirect('/settings?error=callback_failed');
  }
}