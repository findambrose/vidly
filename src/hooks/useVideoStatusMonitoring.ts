'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

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

interface VideoStatusMonitoringResult {
  videos: UserVideo[];
  refreshVideos: () => void;
  processingVideos: UserVideo[];
  completedVideos: UserVideo[];
}

export function useVideoStatusMonitoring(): VideoStatusMonitoringResult {
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [previousVideos, setPreviousVideos] = useState<UserVideo[]>([]);
  const supabase = createClient();

  const fetchVideos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_videos')
        .select(`
          *,
          trends(title, category)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user videos:', error);
        return;
      }

      setVideos(data || []);
    } catch (error) {
      console.error('Error in fetchVideos:', error);
    }
  }, [supabase]);

  // Check for status changes and show notifications
  useEffect(() => {
    if (previousVideos.length === 0) {
      setPreviousVideos(videos);
      return;
    }

    videos.forEach((currentVideo) => {
      const previousVideo = previousVideos.find(pv => pv.id === currentVideo.id);

      if (previousVideo && previousVideo.status !== currentVideo.status) {
        // Status changed, show notification
        if (currentVideo.status === 'completed') {
          toast.success(`🎉 Video Ready! "${currentVideo.title}"`, {
            duration: 5000,
            action: currentVideo.final_video_url ? {
              label: 'View Video',
              onClick: () => window.location.href = '/videos'
            } : undefined
          });
        } else if (currentVideo.status === 'failed') {
          const errorMessage = currentVideo.error_message
            ? `❌ Video Generation Failed: "${currentVideo.title}" - ${currentVideo.error_message}`
            : `❌ Video Generation Failed: "${currentVideo.title}"`;

          toast.error(errorMessage, {
            duration: 7000,
            action: {
              label: 'View Details',
              onClick: () => window.location.href = '/videos'
            }
          });
        } else if (currentVideo.status === 'processing' || currentVideo.status === 'queued') {
          toast.info(`⏳ Video Processing Started: "${currentVideo.title}"`, {
            duration: 3000
          });
        }
      }
    });

    setPreviousVideos(videos);
  }, [videos, previousVideos]);

  // Set up real-time subscription
  useEffect(() => {
    const setupRealtime = async () => {
      await fetchVideos();

      // Set authentication for realtime - CRITICAL for RLS
      await supabase.realtime.setAuth();

      const channel = supabase
        .channel('user_videos_monitoring', {
          config: {
            private: true // Required for RLS policies to work
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_videos',
          },
          (payload) => {
            console.log('Real-time video update:', payload);
            fetchVideos(); // Refresh the videos when changes occur
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;

    setupRealtime().then((cleanupFn) => {
      cleanup = cleanupFn;
    }).catch((error) => {
      console.error('Failed to setup realtime:', error);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [fetchVideos, supabase]);

  const processingVideos = videos.filter(v =>
    v.status === 'processing' || v.status === 'pending' || v.status === 'queued'
  );

  const completedVideos = videos.filter(v => v.status === 'completed');

  return {
    videos,
    refreshVideos: fetchVideos,
    processingVideos,
    completedVideos
  };
}