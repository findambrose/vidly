import { createClient } from '@/utils/supabase/server';

export interface YouTubeTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface YouTubeUserInfo {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
}

export interface YouTubeVideoUploadRequest {
  snippet: {
    title: string;
    description: string;
    tags?: string[];
    categoryId?: string;
    defaultLanguage?: string;
  };
  status: {
    privacyStatus: 'private' | 'public' | 'unlisted';
    embeddable?: boolean;
    license?: 'youtube' | 'creativeCommon';
  };
  recordingDetails?: {
    recordingDate?: string;
  };
}

export interface YouTubeVideoUploadResponse {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    channelTitle: string;
    tags?: string[];
    categoryId: string;
  };
  status: {
    uploadStatus: string;
    privacyStatus: string;
    license: string;
    embeddable: boolean;
    publicStatsViewable: boolean;
  };
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<YouTubeTokenResponse> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('YouTube OAuth environment variables not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YouTube token exchange failed: ${errorText}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<YouTubeTokenResponse> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('YouTube OAuth environment variables not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YouTube token refresh failed: ${errorText}`);
  }

  return response.json();
}

/**
 * Get user's YouTube channel information
 */
export async function getUserChannelInfo(accessToken: string): Promise<YouTubeUserInfo> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get YouTube channel info: ${errorText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('No YouTube channel found for this user');
  }

  return data.items[0];
}

/**
 * Upload video to YouTube
 */
export async function uploadVideoToYouTube(
  accessToken: string,
  videoData: YouTubeVideoUploadRequest,
  videoBuffer: Buffer
): Promise<YouTubeVideoUploadResponse> {
  // First, initiate the resumable upload
  const initiateResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': videoBuffer.length.toString(),
      },
      body: JSON.stringify(videoData),
    }
  );

  if (!initiateResponse.ok) {
    const errorText = await initiateResponse.text();
    throw new Error(`Failed to initiate YouTube upload: ${errorText}`);
  }

  const uploadUrl = initiateResponse.headers.get('location');
  if (!uploadUrl) {
    throw new Error('No upload URL returned from YouTube');
  }

  // Upload the video content
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/*',
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`YouTube video upload failed: ${errorText}`);
  }

  return uploadResponse.json();
}

/**
 * Get YouTube connection for a user from database
 */
export async function getUserYouTubeConnection(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'youtube')
    .eq('is_active', true)
    .single();

  if (error) {
    throw new Error(`Failed to get YouTube connection: ${error.message}`);
  }

  return data;
}

/**
 * Check if access token is expired and refresh if needed
 */
export async function ensureValidAccessToken(connection: any) {
  // Check if token is expired (with 5-minute buffer)
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

  if (expiresAt.getTime() - now.getTime() > bufferTime) {
    // Token is still valid
    return connection.access_token;
  }

  // Token is expired or about to expire, refresh it
  const newTokens = await refreshAccessToken(connection.refresh_token);

  // Update the connection in database
  const supabase = await createClient();
  const { error } = await supabase
    .from('social_connections')
    .update({
      access_token: newTokens.access_token,
      expires_in: newTokens.expires_in,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  if (error) {
    throw new Error(`Failed to update YouTube connection: ${error.message}`);
  }

  return newTokens.access_token;
}