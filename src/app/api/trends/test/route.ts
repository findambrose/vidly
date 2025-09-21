import { NextResponse } from 'next/server';
import { getSerperClient } from '@/utils/serper/client';

/**
 * GET /api/trends/test
 * Test the Serper API integration
 */
export async function GET() {
  try {
    // Check if API key is configured
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey || apiKey === 'your-serper-api-key-here') {
      return NextResponse.json({
        success: false,
        error: 'SERPER_API_KEY not configured',
        message: 'Please set your Serper API key in the .env file'
      }, { status: 500 });
    }

    // Test basic search functionality
    const serperClient = getSerperClient();

    console.log('Testing Serper API with a simple search...');
    const testResults = await serperClient.search({
      query: 'trending topics 2024',
      numResults: 3
    });

    console.log('Serper API test successful');

    // Test trending topics extraction
    console.log('Testing trending topics extraction...');
    const trendingTopics = await serperClient.getTrendingTopics(['technology', 'lifestyle']);

    return NextResponse.json({
      success: true,
      message: 'Serper API integration working correctly',
      testData: {
        searchResults: testResults.organic?.length || 0,
        extractedTrends: trendingTopics.length,
        sampleTrends: trendingTopics.slice(0, 3).map(t => ({
          title: t.title,
          category: t.category,
          score: t.trending_score
        }))
      }
    });

  } catch (error) {
    console.error('Serper API test failed:', error);

    let errorMessage = 'Unknown error';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Invalid Serper API key. Please check your API key.';
        statusCode = 401;
      } else if (error.message.includes('429')) {
        errorMessage = 'Serper API rate limit exceeded. Please try again later.';
        statusCode = 429;
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Serper API test failed',
      details: errorMessage
    }, { status: statusCode });
  }
}