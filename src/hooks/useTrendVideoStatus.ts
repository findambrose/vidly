'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

interface TrendVideoStatus {
  [trendId: string]: {
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'queued';
    videoId: string;
    title?: string;
    created_at: string;
  };
}

interface TrendVideoStatusResult {
  trendVideoStatus: TrendVideoStatus;
  refreshStatus: () => void;
  isGenerating: (trendId: string) => boolean;
  hasVideo: (trendId: string) => boolean;
  getVideoStatus: (trendId: string) => string | null;
}

export function useTrendVideoStatus(): TrendVideoStatusResult {
  const [trendVideoStatus, setTrendVideoStatus] = useState<TrendVideoStatus>({});
  const supabase = createClient();

  const fetchTrendVideoStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_videos')
        .select('id, trend_id, status, title, created_at')
        .not('trend_id', 'is', null);

      if (error) {
        console.error('Error fetching trend video status:', error);
        return;
      }

      const statusMap: TrendVideoStatus = {};
      data?.forEach((video) => {
        if (video.trend_id) {
          statusMap[video.trend_id] = {
            status: video.status as 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'queued',
            videoId: video.id,
            title: video.title,
            created_at: video.created_at
          };
        }
      });

      setTrendVideoStatus(statusMap);
    } catch (error) {
      console.error('Error in fetchTrendVideoStatus:', error);
    }
  }, [supabase]);

  // Set up real-time subscription
  useEffect(() => {
    const setupRealtime = async () => {
      await fetchTrendVideoStatus();

      // Set authentication for realtime - CRITICAL for RLS
      await supabase.realtime.setAuth();

      const channel = supabase
        .channel('trend_video_status', {
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
            console.log('Real-time trend video status update:', payload);
            fetchTrendVideoStatus(); // Refresh when video status changes
          }
        )
        .subscribe((status) => {
          console.log('Trend video status realtime subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;

    setupRealtime().then((cleanupFn) => {
      cleanup = cleanupFn;
    }).catch((error) => {
      console.error('Failed to setup trend video status realtime:', error);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [fetchTrendVideoStatus, supabase]);

  const isGenerating = useCallback((trendId: string): boolean => {
    const status = trendVideoStatus[trendId]?.status;
    return status === 'pending' || status === 'processing' || status === 'queued';
  }, [trendVideoStatus]);

  const hasVideo = useCallback((trendId: string): boolean => {
    return !!trendVideoStatus[trendId];
  }, [trendVideoStatus]);

  const getVideoStatus = useCallback((trendId: string): string | null => {
    return trendVideoStatus[trendId]?.status || null;
  }, [trendVideoStatus]);

  return {
    trendVideoStatus,
    refreshStatus: fetchTrendVideoStatus,
    isGenerating,
    hasVideo,
    getVideoStatus
  };
}