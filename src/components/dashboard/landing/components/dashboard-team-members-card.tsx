'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Video, Play, Clock, CheckCircle } from 'lucide-react';
import { useVideoStatusMonitoring } from '@/hooks/useVideoStatusMonitoring';

export function DashboardTeamMembersCard() {
  const { videos } = useVideoStatusMonitoring();
  const recentVideos = videos.slice(0, 3);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
      case 'pending':
      case 'queued':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <Clock className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'pending':
        return 'Pending';
      case 'queued':
        return 'Queued';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className={'bg-background/50 backdrop-blur-[24px] border-border p-6'}>
      <CardHeader className="p-0 space-y-0">
        <CardTitle className="flex justify-between gap-2 items-center pb-6 border-border border-b">
          <div className={'flex flex-col gap-2'}>
            <span className={'text-xl font-medium'}>Recent videos</span>
            <span className={'text-base leading-4 text-secondary'}>Your latest video generations</span>
          </div>
          <Button asChild={true} size={'sm'} variant={'outline'} className={'text-sm rounded-sm border-border'}>
            <Link href={'/videos'}>
              <Video size={16} className={'text-muted-foreground'} />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className={'p-0 pt-6 flex gap-6 flex-col'}>
        {recentVideos.length === 0 ? (
          <div className="text-center py-8">
            <Video className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No videos generated yet</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/create">Create First Video</Link>
            </Button>
          </div>
        ) : (
          recentVideos.map((video) => (
            <div key={video.id} className={'flex justify-between items-center gap-2'}>
              <div className={'flex gap-4'}>
                <div className={'flex items-center justify-center px-3 py-4'}>
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <Video className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className={'flex flex-col gap-1'}>
                  <span className={'text-sm leading-4 font-medium line-clamp-1'}>{video.title}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(video.status)}
                    <span className={'text-xs text-secondary'}>{getStatusText(video.status)}</span>
                  </div>
                </div>
              </div>
              {video.status === 'completed' && video.final_video_url && (
                <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Link href="/videos">
                    <Play className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
