'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Loader2, TrendingUp, Hash, MapPin, Calendar, RefreshCw, CheckCircle, Clock, AlertCircle, VideoIcon } from 'lucide-react';
import { LoadingScreen } from '@/components/dashboard/layout/loading-screen';
import { DashboardPageHeader } from '@/components/dashboard/layout/dashboard-page-header';
import { useTrendVideoStatus } from '@/hooks/useTrendVideoStatus';
import { useVideoStatusMonitoring } from '@/hooks/useVideoStatusMonitoring';
import Link from 'next/link';

interface Trend {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
  hashtags: string[];
  trending_score: number;
  region: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export default function CreatePage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const { trendVideoStatus, isGenerating, hasVideo, getVideoStatus } = useTrendVideoStatus();

  // Add video status monitoring for real-time notifications
  const { refreshVideos: refreshVideoStatus } = useVideoStatusMonitoring();

  // Clear local generating state when video status changes
  useEffect(() => {
    const currentGenerating = Array.from(generatingVideos);
    currentGenerating.forEach(trendId => {
      const status = getVideoStatus(trendId);
      console.log(`Trend ${trendId} status update: ${status}`);
      // If status is no longer null and not pending, remove from generating state
      if (status && status !== 'pending') {
        console.log(`Removing trend ${trendId} from generating state, status: ${status}`);
        setGeneratingVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(trendId);
          return newSet;
        });
      }
    });
  }, [trendVideoStatus, generatingVideos, getVideoStatus]);

  // Debug: Log real-time status changes
  useEffect(() => {
    console.log('Trend video status updated:', trendVideoStatus);
  }, [trendVideoStatus]);

  // Debug log to see current trends state
  console.log('Current trends state:', trends, 'Length:', trends.length);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async (refresh: boolean = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        console.log('Fetching fresh trends from Serper...');

        // Call our trends API with refresh=true to get fresh data from Serper
        const response = await fetch('/api/trends?refresh=true&limit=20');
        const result = await response.json();

        console.log('API Response:', result);

        if (!response.ok) {
          throw new Error(result.error || 'Failed to refresh trends');
        }

        console.log('Setting trends:', result.trends);
        setTrends(result.trends || []);
        toast.success(`Refreshed ${result.trendsCount || result.trends?.length || 0} trending topics from Serper.dev!`);
      } else {
        console.log('Fetching trends from Supabase...');
        // Use Supabase directly for regular fetches
        const { data, error } = await supabase
          .from('trends')
          .select('*')
          .eq('is_active', true)
          .order('trending_score', { ascending: false })
          .limit(20);

        if (error) {
          toast.error('Failed to load trends');
          console.error('Error fetching trends:', error);
          return;
        }

        console.log('Supabase data:', data);
        setTrends(data || []);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load trends';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTrendAction = async (trendId: string, action: string) => {
    if (action === 'view') {
      // Navigate to videos page
      window.location.href = '/videos';
      return;
    }

    if (action === 'generate' || action === 'retry') {
      // Add to generating set to show loading state
      setGeneratingVideos(prev => new Set(prev).add(trendId));

      try {
        const response = await fetch('/api/generate-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trendId }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 409) {
            toast.error(result.error, {
              action: {
                label: 'View Video',
                onClick: () => window.location.href = '/videos'
              }
            });
            return;
          }
          throw new Error(result.error || 'Failed to generate video');
        }

        toast.success(`Video generation started for "${result.trendTitle}"!`, {
          action: {
            label: 'View Progress',
            onClick: () => window.location.href = '/videos'
          }
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate video';
        toast.error(errorMessage);
        console.error('Error generating video:', error);
      } finally {
        // Remove from generating set
        setGeneratingVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(trendId);
          return newSet;
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      technology: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      lifestyle: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      business: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      health: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      finance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      entertainment: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
      case 'queued':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'processing':
      case 'queued':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const getButtonState = (trendId: string) => {
    const videoStatus = getVideoStatus(trendId);
    const isLocallyGenerating = generatingVideos.has(trendId);
    const isCurrentlyGenerating = isLocallyGenerating || isGenerating(trendId);

    // Priority 1: If we're locally generating (just clicked), show generating state
    if (isLocallyGenerating) {
      return {
        disabled: true,
        text: 'Generating',
        variant: 'secondary' as const,
        icon: <Loader2 className="h-4 w-4 mr-2 animate-spin" />,
        action: 'generating'
      };
    }

    // Priority 2: If video is completed, show view button
    if (videoStatus === 'completed') {
      return {
        disabled: false,
        text: 'View Video',
        variant: 'outline' as const,
        icon: <VideoIcon className="h-4 w-4 mr-2" />,
        action: 'view'
      };
    }

    // Priority 3: If video is processing in database, show generating state
    if (isCurrentlyGenerating) {
      return {
        disabled: true,
        text: 'Processing',
        variant: 'secondary' as const,
        icon: <Loader2 className="h-4 w-4 mr-2 animate-spin" />,
        action: 'generating'
      };
    }

    // Priority 4: If video failed, show retry button
    if (videoStatus === 'failed') {
      return {
        disabled: false,
        text: 'Try Again',
        variant: 'default' as const,
        icon: <RefreshCw className="h-4 w-4 mr-2" />,
        action: 'retry'
      };
    }

    // Default: Show generate button
    return {
      disabled: false,
      text: 'Generate Video',
      variant: 'default' as const,
      icon: <TrendingUp className="h-4 w-4 mr-2" />,
      action: 'generate'
    };
  };

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8">
        <DashboardPageHeader pageTitle={'Create'} />
        <LoadingScreen />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8">
      <DashboardPageHeader pageTitle={'Create'} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Choose a trending topic to generate your next viral TikTok video
          </p>
        </div>
        <Button
          onClick={() => fetchTrends(true)}
          disabled={refreshing || loading}
          variant="outline"
          size="sm"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      {trends.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No trends available
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Check back later for new trending topics to create videos from.
          </p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {trends.map((trend) => (
              <Card key={trend.id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                          trend.category
                        )}`}
                      >
                        {trend.category}
                      </span>
                      {/* Video Status Badge */}
                      {hasVideo(trend.id) && (
                        <Badge className={getStatusColor(getVideoStatus(trend.id)!)}>
                          {getStatusIcon(getVideoStatus(trend.id)!)}
                          <span className="ml-1 capitalize">{getVideoStatus(trend.id)}</span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      {trend.trending_score}
                    </div>
                  </div>
                  
                  {/* Title with Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CardTitle className="text-xl font-semibold leading-tight line-clamp-2 cursor-help">
                        {trend.title}
                      </CardTitle>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{trend.title}</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Description with Tooltip */}
                  {trend.description && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 cursor-help">
                          {trend.description}
                        </CardDescription>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{trend.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-3">
                  {/* Hashtags */}
                  {trend.hashtags && trend.hashtags.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1">
                      <Hash className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {trend.hashtags.slice(0, 3).map((hashtag, index) => (
                          <Tooltip key={index}>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-help">
                                {hashtag}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click to explore #{hashtag}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {trend.hashtags.length > 3 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-gray-500 cursor-help">
                                +{trend.hashtags.length - 3} more
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-xs">
                                <p className="font-medium mb-1">All hashtags:</p>
                                <p className="text-xs">{trend.hashtags.join(', ')}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Region and Date */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {trend.region}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(trend.created_at)}
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                {(() => {
                  const buttonState = getButtonState(trend.id);
                  return (
                    <Button
                      onClick={() => handleTrendAction(trend.id, buttonState.action)}
                      disabled={buttonState.disabled}
                      variant={buttonState.variant}
                      className="w-full"
                      size="sm"
                    >
                      {buttonState.icon}
                      {buttonState.text}
                    </Button>
                  );
                })()}
              </CardFooter>
            </Card>
          ))}
        </div>
        </TooltipProvider>
      )}
    </main>
  );
}