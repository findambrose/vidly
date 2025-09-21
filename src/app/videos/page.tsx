'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useVideoStatusMonitoring } from '@/hooks/useVideoStatusMonitoring';
import { useYouTubeUpload } from '@/hooks/useYouTubeUpload';
import { useTikTokUpload } from '@/hooks/useTikTokUpload';
import {
  Loader2,
  VideoIcon,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  PlayIcon,
  Plus,
  Youtube
} from 'lucide-react';
import { LoadingScreen } from '@/components/dashboard/layout/loading-screen';
import { DashboardPageHeader } from '@/components/dashboard/layout/dashboard-page-header';
import Link from 'next/link';

interface UserVideo {
  id: string;
  title: string;
  description: string;
  script_text: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'queued';
  voiceover_url: string | null;
  background_video_url: string | null;
  final_video_url: string | null;
  thumbnail_url: string | null;
  generation_started_at: string | null;
  generation_completed_at: string | null;
  error_message: string | null;
  duration_seconds: number;
  view_count: number;
  download_count: number;
  created_at: string;
  // Joined from trends table
  trend?: {
    title: string;
    category: string;
  };
}

export default function VideosPage() {
  const [loading, setLoading] = useState(true);
  const [downloadingVideos, setDownloadingVideos] = useState<Set<string>>(new Set());
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const supabase = createClient();
  const { videos, processingVideos } = useVideoStatusMonitoring();
  const { uploadToYouTube, isUploading: isUploadingYouTube, uploadProgress: youtubeProgress } = useYouTubeUpload();
  const { uploadToTikTok, isUploading: isUploadingTikTok, uploadProgress: tiktokProgress } = useTikTokUpload();

  useEffect(() => {
    // Mark as initially loaded after a reasonable delay to let real-time data load
    const timer = setTimeout(() => {
      setHasInitiallyLoaded(true);
      setLoading(false);
    }, 2000); // Increased delay to ensure real-time subscription has time to load

    return () => clearTimeout(timer);
  }, []);

  // Set loading to false immediately when we have videos
  useEffect(() => {
    if (videos.length > 0) {
      setLoading(false);
      setHasInitiallyLoaded(true);
    }
  }, [videos]);


  const handleDownload = async (videoUrl: string, title: string, videoId: string) => {
    // Prevent multiple downloads of the same video
    if (downloadingVideos.has(videoId)) {
      return;
    }

    try {
      // Add to downloading set
      setDownloadingVideos(prev => new Set(prev).add(videoId));

      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      // Update download count
      const currentVideo = videos.find(v => v.id === videoId);
      await supabase
        .from('user_videos')
        .update({ download_count: (currentVideo?.download_count || 0) + 1 })
        .eq('id', videoId);

      toast.success('Video download started!');
    } catch (error) {
      toast.error('Failed to download video');
      console.error('Download error:', error);
    } finally {
      // Remove from downloading set
      setDownloadingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status: UserVideo['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: UserVideo['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8">
        <DashboardPageHeader pageTitle={'My Videos'} />
        <LoadingScreen />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8">
      <DashboardPageHeader pageTitle={'My Videos'} />

      <div className="mb-4">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Track and manage your generated TikTok videos
        </p>
      </div>


      {videos.length === 0 && !loading && hasInitiallyLoaded ? (
        <div className="text-center py-12">
          <VideoIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No videos generated yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Head to the create page to generate your first video from trending topics.
          </p>
          <Link href="/create">
            <Button size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Generate Your First Video
            </Button>
          </Link>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="aspect-[9/16] bg-gray-100 dark:bg-gray-800 animate-pulse" />
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <TooltipProvider>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video) => (
              <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
                {/* Video Preview Section */}
                <div className="relative">
                  {video.status === 'completed' && video.final_video_url ? (
                    <div className="relative aspect-[9/16] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <video
                        src={video.final_video_url}
                        controls
                        poster={video.thumbnail_url || undefined}
                        className="w-full h-full object-cover"
                      >
                        Your browser does not support the video tag.
                      </video>
                      <div className="absolute top-2 right-2">
                        <Badge className={getStatusColor(video.status)}>
                          {getStatusIcon(video.status)}
                          <span className="ml-1 capitalize">{video.status}</span>
                        </Badge>
                      </div>
                    </div>
                  ) : video.thumbnail_url ? (
                    <div className="relative aspect-[9/16] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-300">
                        <PlayIcon className="h-16 w-16 text-white bg-black bg-opacity-50 rounded-full p-4 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge className={getStatusColor(video.status)}>
                          {getStatusIcon(video.status)}
                          <span className="ml-1 capitalize">{video.status}</span>
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[9/16] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                      <div className="text-center">
                        <VideoIcon className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No preview available</p>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge className={getStatusColor(video.status)}>
                          {getStatusIcon(video.status)}
                          <span className="ml-1 capitalize">{video.status}</span>
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  {/* Title with Tooltip */}
                  <div className="mb-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-help">
                          {video.title}
                        </h3>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{video.title}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Category */}
                    {video.trend && (
                      <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs font-medium">
                        {video.trend.category}
                      </span>
                    )}
                  </div>

                  {/* Description with Tooltip */}
                  {video.description && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-1 cursor-help">
                          {video.description}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{video.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Error Message with Tooltip */}
                  {video.status === 'failed' && video.error_message && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-red-50 dark:bg-red-900 p-2 rounded-lg mb-3 cursor-help">
                          <p className="text-xs text-red-700 dark:text-red-300 line-clamp-1">
                            Error: {video.error_message}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Error: {video.error_message}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Minimal Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {video.duration_seconds}s
                      </span>
                      <span>{video.view_count}</span>
                    </div>
                    <span>{video.download_count}</span>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(video.created_at)}
                      </span>
                    </div>

                    {video.status === 'completed' && video.final_video_url && (
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => handleDownload(video.final_video_url!, video.title, video.id)}
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs flex-1"
                          disabled={downloadingVideos.has(video.id)}
                        >
                          {downloadingVideos.has(video.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                        </Button>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => uploadToYouTube(video.id, {
                                title: video.title,
                                description: video.description,
                                privacyStatus: 'private'
                              })}
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs"
                              disabled={isUploadingYouTube}
                            >
                              {isUploadingYouTube && youtubeProgress ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Youtube className="h-3 w-3 text-red-600" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Upload to YouTube</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => uploadToTikTok(video.id, {
                                title: video.title,
                                description: video.description,
                                privacyLevel: 'SELF_ONLY'
                              })}
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs"
                              disabled={isUploadingTikTok}
                            >
                              {isUploadingTikTok && tiktokProgress ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-1.032-.084A6.411 6.411 0 0 0 3.135 17.2a6.411 6.411 0 0 0 7.009 6.378 6.548 6.548 0 0 0 .503-.034 6.411 6.411 0 0 0 6.19-6.378v-7.199a8.219 8.219 0 0 0 4.773 1.526V7.947a4.953 4.953 0 0 1-2.021-.1v-1.161z"/>
                                </svg>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Upload to TikTok</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TooltipProvider>
      )}
    </main>
  );
}