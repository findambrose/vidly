import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserYouTubeConnection, ensureValidAccessToken, uploadVideoToYouTube } from '@/utils/youtube/client';

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
    const { videoId, title, description, tags, privacyStatus = 'private' } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get user's YouTube connection
    let connection;
    try {
      connection = await getUserYouTubeConnection(user.id);
    } catch (error) {
      return NextResponse.json(
        { error: 'YouTube account not connected. Please connect your YouTube account first.' },
        { status: 400 }
      );
    }

    // Ensure access token is valid
    let accessToken;
    try {
      accessToken = await ensureValidAccessToken(connection);
    } catch (error) {
      console.error('Failed to refresh YouTube token:', error);
      return NextResponse.json(
        { error: 'Failed to authenticate with YouTube. Please reconnect your account.' },
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

    if (!videoData.video_url) {
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
      // Download video file
      const videoResponse = await fetch(videoData.video_url);
      if (!videoResponse.ok) {
        throw new Error('Failed to download video file');
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

      // Prepare video metadata
      const videoMetadata = {
        snippet: {
          title: title || videoData.title || 'Untitled Video',
          description: description || videoData.description || '',
          tags: tags || [],
          categoryId: '22', // People & Blogs category
        },
        status: {
          privacyStatus: privacyStatus as 'private' | 'public' | 'unlisted',
          embeddable: true,
          license: 'youtube' as const,
        },
      };

      // Upload to YouTube
      const uploadResult = await uploadVideoToYouTube(
        accessToken,
        videoMetadata,
        videoBuffer
      );

      // Update video record with YouTube info
      const { error: updateError } = await supabase
        .from('user_videos')
        .update({
          publishing_status: 'published',
          published_url: `https://www.youtube.com/watch?v=${uploadResult.id}`,
          platform_post_id: uploadResult.id,
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
        youtubeVideoId: uploadResult.id,
        youtubeUrl: `https://www.youtube.com/watch?v=${uploadResult.id}`,
        uploadResult
      });

    } catch (error) {
      console.error('YouTube upload failed:', error);

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
        { error: 'Failed to upload video to YouTube', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('YouTube upload route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}