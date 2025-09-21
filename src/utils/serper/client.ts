/**
 * Serper.dev API client for fetching trending topics and search results
 */

export interface SerperSearchParams {
  query: string;
  numResults?: number;
  gl?: string; // Country code (e.g., "us", "uk")
  hl?: string; // Language code (e.g., "en", "es")
  autocorrect?: boolean;
  type?: 'search';
}

export interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerperKnowledgeGraph {
  title: string;
  type: string;
  website?: string;
  description: string;
  attributes?: Record<string, string>;
}

export interface SerperResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    autocorrect: boolean;
    type: string;
  };
  knowledgeGraph?: SerperKnowledgeGraph;
  organic: SerperSearchResult[];
  peopleAlsoAsk?: Array<{
    question: string;
    snippet: string;
    link: string;
  }>;
  relatedSearches?: Array<{
    query: string;
  }>;
}

export interface TrendingTopic {
  title: string;
  description: string;
  category: string;
  hashtags: string[];
  trending_score: number;
  region: string;
  source: string;
  metadata?: Record<string, unknown>;
}

class SerperClient {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Perform a search using Serper API
   */
  async search(params: SerperSearchParams): Promise<SerperResponse> {
    const {
      query,
      numResults = 10,
      gl = 'us',
      hl = 'en',
      autocorrect = true,
      type = 'search'
    } = params;

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
        gl,
        hl,
        autocorrect,
        type
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get trending topics by searching for trending keywords and analyzing results
   */
  async getTrendingTopics(categories: string[] = ['technology', 'lifestyle', 'business', 'health', 'finance', 'entertainment']): Promise<TrendingTopic[]> {
    const trendingQueries = [
      'trending now 2024',
      'viral topics today',
      'popular hashtags',
      'trending news',
      'social media trends',
      'tiktok trends 2024'
    ];

    const allTopics: TrendingTopic[] = [];

    // Search for trending topics
    for (const query of trendingQueries) {
      try {
        const results = await this.search({
          query,
          numResults: 10,
          gl: 'us',
          hl: 'en'
        });

        // Extract trending topics from search results
        const topics = this.extractTrendingTopics(results, categories);
        allTopics.push(...topics);
      } catch (error) {
        console.error(`Error searching for ${query}:`, error);
        // Continue with other queries if one fails
      }
    }

    // Remove duplicates and return top trending topics
    const uniqueTopics = this.removeDuplicateTopics(allTopics);
    return uniqueTopics.slice(0, 20); // Return top 20 trends
  }

  /**
   * Extract trending topics from search results
   */
  private extractTrendingTopics(results: SerperResponse, categories: string[]): TrendingTopic[] {
    const topics: TrendingTopic[] = [];

    // Process organic results
    results.organic.forEach((result, index) => {
      const category = this.categorizeContent(result.title + ' ' + result.snippet, categories);
      const hashtags = this.extractHashtags(result.snippet);

      topics.push({
        title: this.cleanTitle(result.title),
        description: result.snippet,
        category,
        hashtags,
        trending_score: Math.max(100 - (index * 5), 20), // Higher score for higher positions
        region: results.searchParameters.gl || 'us',
        source: 'serper',
        metadata: {
          originalUrl: result.link,
          position: result.position,
          searchQuery: results.searchParameters.q
        }
      });
    });

    // Process "People Also Ask" questions as trends
    if (results.peopleAlsoAsk) {
      results.peopleAlsoAsk.forEach((paa, index) => {
        const category = this.categorizeContent(paa.question + ' ' + paa.snippet, categories);
        const hashtags = this.extractHashtags(paa.snippet);

        topics.push({
          title: paa.question,
          description: paa.snippet,
          category,
          hashtags,
          trending_score: Math.max(80 - (index * 3), 15),
          region: results.searchParameters.gl || 'us',
          source: 'serper',
          metadata: {
            originalUrl: paa.link,
            type: 'people_also_ask',
            searchQuery: results.searchParameters.q
          }
        });
      });
    }

    return topics;
  }

  /**
   * Categorize content based on keywords
   */
  private categorizeContent(content: string, categories: string[]): string {
    const lowerContent = content.toLowerCase();

    const categoryKeywords = {
      technology: ['ai', 'tech', 'software', 'app', 'digital', 'coding', 'programming', 'computer', 'innovation'],
      lifestyle: ['lifestyle', 'fashion', 'travel', 'food', 'home', 'style', 'living', 'culture'],
      business: ['business', 'startup', 'entrepreneur', 'marketing', 'finance', 'economy', 'career', 'work'],
      health: ['health', 'fitness', 'wellness', 'medical', 'mental', 'exercise', 'diet', 'healthcare'],
      finance: ['finance', 'money', 'investment', 'crypto', 'bitcoin', 'stock', 'trading', 'economy'],
      entertainment: ['entertainment', 'movie', 'music', 'celebrity', 'gaming', 'sports', 'tv', 'show']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (categories.includes(category)) {
        for (const keyword of keywords) {
          if (lowerContent.includes(keyword)) {
            return category;
          }
        }
      }
    }

    return 'general';
  }

  /**
   * Extract hashtags from text
   */
  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex) || [];

    // If no hashtags found, generate them from keywords
    if (matches.length === 0) {
      const keywords = this.extractKeywords(text);
      return keywords.slice(0, 3).map(keyword => `#${keyword.replace(/\s+/g, '')}`);
    }

    return matches.slice(0, 5); // Return max 5 hashtags
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const commonWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'will', 'be', 'by', 'of', 'with', 'for', 'in', 'an', 'or', 'that', 'this', 'it', 'from', 'not', 'can', 'have', 'has', 'had', 'you', 'your', 'we', 'our', 'they', 'their'];

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word));

    // Count word frequency
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Sort by frequency and return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Clean title for better presentation
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/^\d+\.\s*/, '') // Remove leading numbers
      .replace(/\s*-\s*.*$/, '') // Remove trailing descriptions after dash
      .trim();
  }

  /**
   * Remove duplicate topics based on title similarity
   */
  private removeDuplicateTopics(topics: TrendingTopic[]): TrendingTopic[] {
    const unique: TrendingTopic[] = [];
    const seenTitles = new Set<string>();

    for (const topic of topics) {
      const normalizedTitle = topic.title.toLowerCase().trim();

      // Check for similar titles
      const isDuplicate = Array.from(seenTitles).some(seen => {
        const similarity = this.calculateSimilarity(normalizedTitle, seen);
        return similarity > 0.8; // 80% similarity threshold
      });

      if (!isDuplicate) {
        seenTitles.add(normalizedTitle);
        unique.push(topic);
      }
    }

    return unique.sort((a, b) => b.trending_score - a.trending_score);
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}

// Export singleton instance
let serperClient: SerperClient | null = null;

export function getSerperClient(): SerperClient {
  if (!serperClient) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('SERPER_API_KEY environment variable is required');
    }
    serperClient = new SerperClient(apiKey);
  }
  return serperClient;
}

export { SerperClient };