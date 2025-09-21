import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/utils/supabase/server';
import { getSerperClient } from '@/utils/serper/client';

/**
 * GET /api/trends
 * Get trending topics from the database
 * Query parameters:
 * - refresh: boolean - Whether to refresh from Serper.dev first
 * - category: string - Filter by category
 * - limit: number - Number of results to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldRefresh = searchParams.get('refresh') === 'true';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get Supabase client
    const supabase = await createClient();

    // Refresh trends if requested
    if (shouldRefresh) {
      console.log('🔄 Refresh requested, calling Serper API...');
      try {
        console.log('🔑 Getting Serper client...');
        const serperClient = getSerperClient();

        console.log('📡 Calling getTrendingTopics()...');
        const trendingTopics = await serperClient.getTrendingTopics();
        console.log(`✅ Serper returned ${trendingTopics.length} trending topics`);
        console.log('📋 Sample topics:', trendingTopics.slice(0, 2).map(t => ({ title: t.title, category: t.category, score: t.trending_score })));

        if (trendingTopics.length > 0) {
          console.log('🗑️ Disabling existing Serper trends...');
          const { error: disableError } = await supabase
            .from('trends')
            .update({ is_active: false })
            .eq('source', 'serper');

          if (disableError) {
            console.error('⚠️ Error disabling old trends:', disableError);
          }

          // Insert new trends
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

          console.log('💾 Inserting new trends into database...');
          const { error: insertError } = await supabase
            .from('trends')
            .insert(trendsToInsert);

          if (insertError) {
            console.error('❌ Error inserting trends:', insertError);
            throw insertError;
          }

          console.log(`✅ Successfully refreshed ${trendingTopics.length} trending topics`);
        } else {
          console.log('⚠️ No trending topics returned from Serper');
        }
      } catch (refreshError) {
        console.error('❌ Error refreshing trends:', refreshError);
        console.error('Full error:', refreshError);

        // Return error response instead of continuing silently
        const errorDetails = refreshError instanceof Error
          ? refreshError.message
          : typeof refreshError === 'string'
            ? refreshError
            : JSON.stringify(refreshError);

        return NextResponse.json(
          {
            error: 'Failed to refresh trends from Serper',
            details: errorDetails,
            fullError: refreshError,
            fallbackToExisting: true
          },
          { status: 500 }
        );
      }
    }

    // Build query
    let query = supabase
      .from('trends')
      .select('*')
      .eq('is_active', true)
      .order('trending_score', { ascending: false });

    // Apply category filter if specified
    if (category) {
      query = query.eq('category', category);
    }

    // Apply limit
    query = query.limit(limit);

    // Execute query
    const { data: trends, error: queryError } = await query;

    if (queryError) {
      console.error('Error fetching trends:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch trending topics', details: queryError.message },
        { status: 500 }
      );
    }

    // Get categories for metadata
    const { data: categories } = await supabase
      .from('trends')
      .select('category')
      .eq('is_active', true);

    const uniqueCategories = [...new Set(categories?.map(c => c.category) || [])];

    return NextResponse.json({
      trends: trends || [],
      totalCount: trends?.length || 0,
      categories: uniqueCategories,
      refreshed: shouldRefresh,
      filters: {
        category: category || null,
        limit
      }
    });

  } catch (error) {
    console.error('Error in trends API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trends
 * Manually add a trending topic
 */
export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createServiceRoleClient();

    const body = await request.json();
    const {
      title,
      description,
      category = 'general',
      hashtags = [],
      trending_score = 50
    } = body;

    // Validation
    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      );
    }

    // Insert the new trend
    const { data: newTrend, error: insertError } = await adminSupabase
      .from('trends')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category,
        hashtags: Array.isArray(hashtags) ? hashtags : [],
        trending_score: Math.max(0, Math.min(100, trending_score)), // Clamp between 0-100
        region: 'global',
        source: 'manual',
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating trend:', insertError);
      return NextResponse.json(
        { error: 'Failed to create trending topic', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trend: newTrend,
      message: 'Trending topic created successfully'
    });

  } catch (error) {
    console.error('Error creating trend:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}