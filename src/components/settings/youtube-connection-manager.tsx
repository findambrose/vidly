'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Unlink, CheckCircle, ExternalLink, Youtube } from 'lucide-react';

interface YouTubeConnection {
  id: string;
  platform: string;
  platform_username: string | null;
  platform_display_name: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function YouTubeConnectionManager() {
  const [connection, setConnection] = useState<YouTubeConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const supabase = createClient();

  // Check for connection status on mount and when URL changes
  useEffect(() => {
    checkConnectionStatus();

    // Handle OAuth callback success/error from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');

    if (connected === 'youtube') {
      toast.success('🎉 YouTube account connected successfully!', {
        description: 'Your videos can now be uploaded to YouTube.'
      });
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh connection status
      checkConnectionStatus();
    } else if (error) {
      const errorMessages: { [key: string]: string } = {
        'oauth_denied': 'YouTube connection was cancelled or denied.',
        'token_exchange_failed': 'Failed to connect to YouTube. Please try again.',
        'database_error': 'Failed to save YouTube connection. Please try again.',
        'callback_failed': 'YouTube connection failed. Please try again.'
      };

      toast.error('YouTube Connection Failed', {
        description: errorMessages[error] || 'An unexpected error occurred.'
      });
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('platform', 'youtube')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching YouTube connection:', error);
        return;
      }

      setConnection(data || null);
    } catch (error) {
      console.error('Error checking YouTube connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Redirect to YouTube OAuth
      window.location.assign('/api/youtube/auth');
    } catch (error) {
      console.error('Error initiating YouTube connection:', error);
      toast.error('Failed to connect YouTube', {
        description: 'Unable to start the connection process. Please try again.'
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/youtube/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnection(null);
      toast.success('YouTube account disconnected', {
        description: 'Your YouTube account has been disconnected successfully.'
      });
    } catch (error) {
      console.error('Error disconnecting YouTube:', error);
      toast.error('Failed to disconnect YouTube', {
        description: 'Please try again or contact support if the issue persists.'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Youtube className="w-5 h-5 text-red-600" />
            YouTube
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Youtube className="w-5 h-5 text-red-600" />
          YouTube Integration
        </CardTitle>
        <CardDescription>
          Upload videos directly to YouTube
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Connected to YouTube</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{connection.platform_display_name || 'YouTube Channel'}</span>
                    {connection.platform_username && (
                      <span>• {connection.platform_username}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isTokenExpired(connection.expires_at) ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Connected on</p>
                <p className="font-medium">{formatDate(connection.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last used</p>
                <p className="font-medium">
                  {connection.last_used_at
                    ? formatDate(connection.last_used_at)
                    : 'Never'
                  }
                </p>
              </div>
            </div>

            {/* Token Expiration Warning */}
            {isTokenExpired(connection.expires_at) && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Connection Expired
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your YouTube connection has expired. Reconnect to continue uploading videos.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isTokenExpired(connection.expires_at) ? (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Reconnect YouTube
                    </>
                  )}
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isDisconnecting}
                      className="flex-1"
                    >
                      {isDisconnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <Unlink className="mr-2 h-4 w-4" />
                          Disconnect
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect YouTube Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the connection to your YouTube channel. You will no longer be able to upload videos directly to YouTube until you reconnect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisconnect}>
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Connect your YouTube channel to upload videos directly
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              size="sm"
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect YouTube Channel
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}