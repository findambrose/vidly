'use client';

import { Video, Clock, Download, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVideoStatusMonitoring } from '@/hooks/useVideoStatusMonitoring';
import { useEffect, useState } from 'react';

interface VideoStats {
  totalVideos: number;
  completedVideos: number;
  totalDownloads: number;
  averageProcessingTime: number;
  trendingTopics: number;
}

export function DashboardStatsCards() {
  const { videos } = useVideoStatusMonitoring();
  const [stats, setStats] = useState<VideoStats>({
    totalVideos: 0,
    completedVideos: 0,
    totalDownloads: 0,
    averageProcessingTime: 0,
    trendingTopics: 0,
  });

  useEffect(() => {
    if (videos.length > 0) {
      const completedVideos = videos.filter(v => v.status === 'completed');
      const totalDownloads = videos.reduce((sum, video) => sum + (video.download_count || 0), 0);
      
      // Calculate average processing time for completed videos
      const processingTimes = completedVideos
        .filter(v => v.generation_started_at && v.generation_completed_at)
        .map(v => {
          const start = new Date(v.generation_started_at!).getTime();
          const end = new Date(v.generation_completed_at!).getTime();
          return (end - start) / (1000 * 60); // Convert to minutes
        });
      
      const averageProcessingTime = processingTimes.length > 0 
        ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
        : 0;

      // Count unique trending topics
      const uniqueTopics = new Set(videos.filter(v => v.trend?.category).map(v => v.trend!.category)).size;

      setStats({
        totalVideos: videos.length,
        completedVideos: completedVideos.length,
        totalDownloads,
        averageProcessingTime,
        trendingTopics: uniqueTopics,
      });
    }
  }, [videos]);

  const cards = [
    {
      title: 'Videos generated',
      icon: <Video className={'text-[#4B4F4F]'} size={18} />,
      value: stats.totalVideos.toString(),
      change: stats.totalVideos === 0 ? 'Start creating your first video' : `${stats.completedVideos} completed`,
    },
    {
      title: 'Processing time',
      icon: <Clock className={'text-[#4B4F4F]'} size={18} />,
      value: `${stats.averageProcessingTime} min`,
      change: stats.averageProcessingTime === 0 ? 'No completed videos yet' : 'Average generation time',
    },
    {
      title: 'Downloads',
      icon: <Download className={'text-[#4B4F4F]'} size={18} />,
      value: stats.totalDownloads.toString(),
      change: stats.totalDownloads === 0 ? 'No downloads yet' : 'Total video downloads',
    },
    {
      title: 'Trending topics',
      icon: <TrendingUp className={'text-[#4B4F4F]'} size={18} />,
      value: stats.trendingTopics.toString(),
      change: stats.trendingTopics === 0 ? 'No topics explored' : 'Topics explored',
    },
  ];

  return (
    <div className={'grid gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2'}>
      {cards.map((card) => (
        <Card key={card.title} className={'bg-background/50 backdrop-blur-[24px] border-border p-6'}>
          <CardHeader className="p-0 space-y-0">
            <CardTitle className="flex justify-between items-center mb-6">
              <span className={'text-base leading-4'}>{card.title}</span> {card.icon}
            </CardTitle>
            <CardDescription className={'text-[32px] leading-[32px] text-primary'}>{card.value}</CardDescription>
          </CardHeader>
          <CardContent className={'p-0'}>
            <div className="text-sm leading-[14px] pt-2 text-secondary">{card.change}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
