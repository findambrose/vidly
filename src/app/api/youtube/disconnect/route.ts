import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(_request: NextRequest) {
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

    // Disconnect YouTube by setting is_active to false
    const { error: dbError } = await supabase
      .from('social_connections')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('platform', 'youtube');

    if (dbError) {
      console.error('Database error disconnecting YouTube:', dbError);
      return NextResponse.json(
        { error: 'Failed to disconnect YouTube account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('YouTube disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube account' },
      { status: 500 }
    );
  }
}