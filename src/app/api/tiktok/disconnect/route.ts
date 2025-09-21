import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(_request: NextRequest) {
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

    // Delete the TikTok connection for this user
    const { error: deleteError } = await supabase
      .from('social_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'tiktok');

    if (deleteError) {
      console.error('Error disconnecting TikTok:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect TikTok account' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'TikTok account disconnected successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('TikTok disconnect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}