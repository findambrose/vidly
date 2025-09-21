import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const { videoId, title, description, tags, privacyLevel = 'SELF_ONLY' } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get user's TikTok connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'tiktok')
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'TikTok account not connected. Please connect your TikTok account first.' },
        { status: 400 }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      return NextResponse.json(
        { error: 'TikTok connection has expired. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Get video file from database
    const { data: videoData, error: videoError } = await supabase
      .from('user_videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single();

    if (videoError || !videoData) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    if (!videoData.final_video_url) {
      return NextResponse.json(
        { error: 'Video file not available for upload' },
        { status: 400 }
      );
    }

    // Update video status to publishing
    await supabase
      .from('user_videos')
      .update({
        publishing_status: 'publishing',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    try {
      // TikTok API upload process
      const uploadUrl = await initiateTikTokUpload(connection.access_token);

      // Download video file
      const videoResponse = await fetch(videoData.final_video_url);
      if (!videoResponse.ok) {
        throw new Error('Failed to download video file');
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

      // Upload video to TikTok
      const uploadResult = await uploadVideoToTikTok(
        uploadUrl,
        videoBuffer,
        connection.access_token,
        {
          title: title || videoData.title || 'Untitled Video',
          description: description || videoData.description || '',
          privacy_level: privacyLevel,
        }
      );

      // Update video record with TikTok info
      const { error: updateError } = await supabase
        .from('user_videos')
        .update({
          publishing_status: 'published',
          published_url: uploadResult.share_url || null,
          platform_post_id: uploadResult.publish_id || null,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      if (updateError) {
        console.error('Failed to update video record:', updateError);
        // Don't fail the request since upload succeeded
      }

      // Update last used timestamp for connection
      await supabase
        .from('social_connections')
        .update({
          last_used_at: new Date().toISOString()
        })
        .eq('id', connection.id);

      return NextResponse.json({
        success: true,
        tiktokPostId: uploadResult.publish_id,
        shareUrl: uploadResult.share_url,
        uploadResult
      });

    } catch (error) {
      console.error('TikTok upload failed:', error);

      // Update video status to failed
      await supabase
        .from('user_videos')
        .update({
          publishing_status: 'publish_failed',
          publish_error: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);

      return NextResponse.json(
        { error: 'Failed to upload video to TikTok', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('TikTok upload route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to initiate TikTok upload
async function initiateTikTokUpload(accessToken: string): Promise<string> {
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: 0, // Will be updated with actual size
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initiate TikTok upload: ${errorText}`);
  }

  const data = await response.json();
  return data.data.upload_url;
}

// Helper function to upload video to TikTok
async function uploadVideoToTikTok(
  uploadUrl: string,
  videoBuffer: Buffer,
  accessToken: string,
  metadata: {
    title: string;
    description: string;
    privacy_level: string;
  }
): Promise<any> {
  // Upload video file
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload video to TikTok: ${errorText}`);
  }

  // Publish the video
  const publishResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: metadata.title,
        description: metadata.description,
        privacy_level: metadata.privacy_level,
      },
      source_info: {
        source: 'FILE_UPLOAD',
      }
    }),
  });

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text();
    throw new Error(`Failed to publish video on TikTok: ${errorText}`);
  }

  return publishResponse.json();
}