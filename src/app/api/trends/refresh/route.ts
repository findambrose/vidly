import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/server';
import { getSerperClient } from '@/utils/serper/client';

/**
 * POST /api/trends/refresh
 * Fetches fresh trending topics from Serper.dev and updates the database
 */
export async function POST(request: NextRequest) {
  try {
    // Get Supabase client with admin privileges
    const supabase = createServiceRoleClient();

    // Get Serper client
    const serperClient = getSerperClient();

    // Fetch trending topics from Serper
    console.log('Fetching trending topics from Serper.dev...');
    const trendingTopics = await serperClient.getTrendingTopics();

    if (trendingTopics.length === 0) {
      return NextResponse.json(
        { error: 'No trending topics found' },
        { status: 404 }
      );
    }

    // Disable existing trends first
    const { error: disableError } = await supabase
      .from('trends')
      .update({ is_active: false })
      .eq('source', 'serper');

    if (disableError) {
      console.error('Error disabling existing trends:', disableError);
      // Continue anyway - we'll still insert new trends
    }

    // Insert new trending topics into database
    const trendsToInsert = trendingTopics.map(topic => ({
      title: topic.title,
      description: topic.description,
      category: topic.category,
      hashtags: topic.hashtags,
      trending_score: topic.trending_score,
      region: topic.region,
      source: topic.source,
      metadata: topic.metadata || {},
      is_active: true
    }));

    const { data: insertedTrends, error: insertError } = await supabase
      .from('trends')
      .insert(trendsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting trends:', insertError);
      return NextResponse.json(
        { error: 'Failed to save trending topics', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`Successfully inserted ${insertedTrends?.length || 0} trending topics`);

    // Return success response with statistics
    return NextResponse.json({
      success: true,
      message: `Successfully refreshed ${insertedTrends?.length || 0} trending topics`,
      trendsCount: insertedTrends?.length || 0,
      categories: [...new Set(trendingTopics.map(t => t.category))],
      avgTrendingScore: Math.round(
        trendingTopics.reduce((sum, t) => sum + t.trending_score, 0) / trendingTopics.length
      )
    });

  } catch (error) {
    console.error('Error refreshing trends:', error);

    // Handle specific Serper API errors
    if (error instanceof Error) {
      if (error.message.includes('SERPER_API_KEY')) {
        return NextResponse.json(
          { error: 'Serper API key not configured. Please set SERPER_API_KEY environment variable.' },
          { status: 500 }
        );
      }

      if (error.message.includes('Serper API error')) {
        return NextResponse.json(
          { error: 'Serper API error. Please check your API key and try again.' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error while refreshing trends',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trends/refresh
 * Get information about the trends refresh endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/trends/refresh',
    method: 'POST',
    description: 'Refresh trending topics from Serper.dev',
    authentication: 'Required',
    response: {
      success: 'boolean',
      message: 'string',
      trendsCount: 'number',
      categories: 'string[]',
      avgTrendingScore: 'number'
    }
  });
}