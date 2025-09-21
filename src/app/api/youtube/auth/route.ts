import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Generate a random code verifier for PKCE
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate code challenge from verifier using SHA256
function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function GET(_request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient();

    if (!supabase || !supabase.auth) {
      console.error('Failed to create Supabase client');
      return NextResponse.json(
        { error: 'Internal server error - Supabase not configured' },
        { status: 500 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get environment variables
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error('Missing YouTube environment variables:', {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri
      });
      return NextResponse.json(
        { error: 'YouTube integration not configured' },
        { status: 500 }
      );
    }

    console.log('YouTube OAuth initialization for user:', user.id);

    // Generate CSRF state parameter (random string)
    const state = crypto.randomBytes(16).toString('hex');

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    console.log('Generated PKCE parameters:', {
      codeVerifier: codeVerifier.substring(0, 10) + '...',
      codeChallenge: codeChallenge.substring(0, 10) + '...'
    });

    // Store state and code verifier in httpOnly cookies for security
    const cookieStore = await cookies();

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 600, // 10 minutes
      path: '/'
    };

    console.log('Setting cookies with options:', cookieOptions);

    cookieStore.set('youtube_oauth_state', state, cookieOptions);
    cookieStore.set('youtube_code_verifier', codeVerifier, cookieOptions);
    cookieStore.set('youtube_oauth_user', user.id, cookieOptions);

    // Verify cookies were set
    console.log('Cookies set:', {
      state: cookieStore.get('youtube_oauth_state')?.value?.substring(0, 8) + '...',
      verifier: cookieStore.get('youtube_code_verifier')?.value?.substring(0, 8) + '...',
      userId: cookieStore.get('youtube_oauth_user')?.value
    });

    // Construct YouTube OAuth URL according to Google OAuth2 documentation
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly');
    authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
    authUrl.searchParams.set('prompt', 'consent'); // Force consent screen to get refresh token
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('Redirecting to YouTube OAuth URL:', authUrl.toString());

    // Use NextResponse.redirect() for API routes
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('YouTube auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate YouTube authentication', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}