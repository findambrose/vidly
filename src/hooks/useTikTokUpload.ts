import { useState } from 'react';
import { toast } from 'sonner';

interface UploadOptions {
  title?: string;
  description?: string;
  tags?: string[];
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIEND' | 'SELF_ONLY';
}

interface UploadResult {
  success: boolean;
  tiktokPostId?: string;
  shareUrl?: string;
  error?: string;
}

export function useTikTokUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const uploadToTikTok = async (videoId: string, options?: UploadOptions): Promise<UploadResult> => {
    setIsUploading(true);
    setUploadProgress('Preparing upload...');

    try {
      // Prepare request body
      const requestBody = {
        videoId,
        title: options?.title,
        description: options?.description,
        tags: options?.tags,
        privacyLevel: options?.privacyLevel || 'SELF_ONLY'
      };

      setUploadProgress('Uploading to TikTok...');

      const response = await fetch('/api/tiktok/upload', {
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

      toast.success('🎉 Video uploaded to TikTok!', {
        description: 'Your video has been successfully uploaded to your TikTok account.',
        action: result.shareUrl ? {
          label: 'View on TikTok',
          onClick: () => window.open(result.shareUrl, '_blank'),
        } : undefined,
      });

      return {
        success: true,
        tiktokPostId: result.tiktokPostId,
        shareUrl: result.shareUrl,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      setUploadProgress(null);

      // Handle specific error cases
      if (errorMessage.includes('not connected')) {
        toast.error('TikTok Not Connected', {
          description: 'Please connect your TikTok account in Settings first.',
          action: {
            label: 'Go to Settings',
            onClick: () => window.location.href = '/settings?tab=integrations',
          },
        });
      } else if (errorMessage.includes('expired')) {
        toast.error('TikTok Connection Expired', {
          description: 'Your TikTok connection has expired. Please reconnect your account.',
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
    uploadToTikTok,
    isUploading,
    uploadProgress,
  };
}