import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  open_id: string;
}

interface TikTokUserInfo {
  data: {
    user: {
      open_id: string;
      username: string;
      display_name: string;
      avatar_url: string;
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      console.error('TikTok OAuth error:', error);
      redirect('/settings?error=oauth_denied');
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      );
    }

    // Verify CSRF state and get code verifier
    const storedState = cookieStore.get('tiktok_oauth_state')?.value;
    const storedUserId = cookieStore.get('tiktok_oauth_user')?.value;
    const codeVerifier = cookieStore.get('tiktok_code_verifier')?.value;

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
    cookieStore.delete('tiktok_oauth_state');
    cookieStore.delete('tiktok_oauth_user');
    cookieStore.delete('tiktok_code_verifier');

    // Get environment variables
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !clientSecret || !redirectUri) {
      console.error('Missing TikTok environment variables');
      return NextResponse.json(
        { error: 'TikTok integration not configured' },
        { status: 500 }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('TikTok token exchange failed:', errorText);
      redirect('/settings?error=token_exchange_failed');
    }

    const tokenData: TikTokTokenResponse = await tokenResponse.json();

    // Get user info from TikTok
    let userInfo: TikTokUserInfo | null = null;
    try {
      const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (userResponse.ok) {
        userInfo = await userResponse.json();
      }
    } catch (error) {
      console.warn('Failed to fetch TikTok user info:', error);
      // Continue without user info - it's not critical
    }

    // Initialize Supabase and store connection
    const supabase = await createClient();

    // Prepare connection data
    const connectionData = {
      user_id: storedUserId,
      platform: 'tiktok',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      platform_user_id: tokenData.open_id,
      platform_username: userInfo?.data?.user?.username || null,
      platform_display_name: userInfo?.data?.user?.display_name || null,
      scopes: tokenData.scope.split(','),
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
      console.error('Database error storing TikTok connection:', dbError);
      redirect('/settings?error=database_error');
    }

    // Success - redirect to settings with success message
    redirect('/settings?connected=tiktok');

  } catch (error) {
    // Check if this is a redirect error (expected behavior in Next.js App Router)
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      // This is an expected redirect, re-throw it
      throw error;
    }

    console.error('TikTok callback error:', error);
    redirect('/settings?error=callback_failed');
  }
}