import { useState } from 'react';
import { toast } from 'sonner';

interface UploadOptions {
  title?: string;
  description?: string;
  tags?: string[];
  privacyStatus?: 'private' | 'public' | 'unlisted';
}

interface UploadResult {
  success: boolean;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  error?: string;
}

export function useYouTubeUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const uploadToYouTube = async (videoId: string, options?: UploadOptions): Promise<UploadResult> => {
    setIsUploading(true);
    setUploadProgress('Preparing upload...');

    try {
      // Prepare request body
      const requestBody = {
        videoId,
        title: options?.title,
        description: options?.description,
        tags: options?.tags,
        privacyStatus: options?.privacyStatus || 'private'
      };

      setUploadProgress('Uploading to YouTube...');

      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadProgress('Upload completed!');

      toast.success('🎉 Video uploaded to YouTube!', {
        description: 'Your video has been successfully uploaded to your YouTube channel.',
        action: {
          label: 'View on YouTube',
          onClick: () => window.open(result.youtubeUrl, '_blank'),
        },
      });

      return {
        success: true,
        youtubeVideoId: result.youtubeVideoId,
        youtubeUrl: result.youtubeUrl,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      setUploadProgress(null);

      // Handle specific error cases
      if (errorMessage.includes('not connected')) {
        toast.error('YouTube Not Connected', {
          description: 'Please connect your YouTube account in Settings first.',
          action: {
            label: 'Go to Settings',
            onClick: () => window.location.href = '/settings?tab=integrations',
          },
        });
      } else if (errorMessage.includes('reconnect')) {
        toast.error('YouTube Connection Expired', {
          description: 'Your YouTube connection has expired. Please reconnect your account.',
          action: {
            label: 'Reconnect',
            onClick: () => window.location.href = '/settings?tab=integrations',
          },
        });
      } else {
        toast.error('Upload Failed', {
          description: errorMessage,
        });
      }

      return {
        success: false,
        error: errorMessage,
      };

    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 2000);
    }
  };

  return {
    uploadToYouTube,
    isUploading,
    uploadProgress,
  };
}