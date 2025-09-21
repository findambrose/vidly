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
    // Debug environment variables
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Check if user is authenticated
    const supabase = await createClient();
    console.log('Supabase client created:', !!supabase);
    console.log('Supabase auth exists:', !!supabase?.auth);

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
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !redirectUri) {
      console.error('Missing TikTok environment variables:', {
        hasClientKey: !!clientKey,
        hasRedirectUri: !!redirectUri
      });
      return NextResponse.json(
        { error: 'TikTok integration not configured' },
        { status: 500 }
      );
    }

    console.log('TikTok OAuth initialization for user:', user.id);

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

    // For ngrok, always use secure cookies since it's HTTPS
    const isNgrok = redirectUri.includes('ngrok');
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || isNgrok,
      sameSite: 'lax' as const,
      maxAge: 600, // 10 minutes
      path: '/'
    };

    console.log('Setting cookies with options:', cookieOptions);

    cookieStore.set('tiktok_oauth_state', state, cookieOptions);
    cookieStore.set('tiktok_code_verifier', codeVerifier, cookieOptions);
    cookieStore.set('tiktok_oauth_user', user.id, cookieOptions);

    // Verify cookies were set
    console.log('Cookies set:', {
      state: cookieStore.get('tiktok_oauth_state')?.value?.substring(0, 8) + '...',
      verifier: cookieStore.get('tiktok_code_verifier')?.value?.substring(0, 8) + '...',
      userId: cookieStore.get('tiktok_oauth_user')?.value
    });

    // Construct TikTok OAuth URL according to TikTok documentation
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.set('client_key', clientKey);
    authUrl.searchParams.set('scope', 'user.info.basic,video.upload,video.publish'); // Added video.publish for content posting
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('Redirecting to TikTok OAuth URL:', authUrl.toString());

    // Use NextResponse.redirect() for API routes
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('TikTok auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate TikTok authentication', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}