'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Unlink, CheckCircle, ExternalLink } from 'lucide-react';

interface TikTokConnection {
  id: string;
  platform: string;
  platform_username: string | null;
  platform_display_name: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function TikTokConnectionManager() {
  const [connection, setConnection] = useState<TikTokConnection | null>(null);
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

    if (connected === 'tiktok') {
      toast.success('🎉 TikTok account connected successfully!', {
        description: 'Your videos will now be automatically published to TikTok.'
      });
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh connection status
      checkConnectionStatus();
    } else if (error) {
      const errorMessages: { [key: string]: string } = {
        'oauth_denied': 'TikTok connection was cancelled or denied.',
        'token_exchange_failed': 'Failed to connect to TikTok. Please try again.',
        'database_error': 'Failed to save TikTok connection. Please try again.',
        'callback_failed': 'TikTok connection failed. Please try again.'
      };

      toast.error('TikTok Connection Failed', {
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
        .eq('platform', 'tiktok')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching TikTok connection:', error);
        return;
      }

      setConnection(data || null);
    } catch (error) {
      console.error('Error checking TikTok connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Redirect to TikTok OAuth
      window.location.assign('/api/tiktok/auth');
    } catch (error) {
      console.error('Error initiating TikTok connection:', error);
      toast.error('Failed to connect TikTok', {
        description: 'Unable to start the connection process. Please try again.'
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/tiktok/disconnect', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnection(null);
      toast.success('TikTok account disconnected', {
        description: 'Your TikTok account has been disconnected successfully.'
      });
    } catch (error) {
      console.error('Error disconnecting TikTok:', error);
      toast.error('Failed to disconnect TikTok', {
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.510v-3.5a6.329 6.329 0 0 0-1.032-.084A6.411 6.411 0 0 0 3.135 17.2a6.411 6.411 0 0 0 7.009 6.378 6.548 6.548 0 0 0 .503-.034 6.411 6.411 0 0 0 6.19-6.378v-7.199a8.219 8.219 0 0 0 4.773 1.526V7.947a4.953 4.953 0 0 1-2.021-.1v-1.161z"/>
            </svg>
            TikTok
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
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.510v-3.5a6.329 6.329 0 0 0-1.032-.084A6.411 6.411 0 0 0 3.135 17.2a6.411 6.411 0 0 0 7.009 6.378 6.548 6.548 0 0 0 .503-.034 6.411 6.411 0 0 0 6.19-6.378v-7.199a8.219 8.219 0 0 0 4.773 1.526V7.947a4.953 4.953 0 0 1-2.021-.1v-1.161z"/>
          </svg>
          TikTok Integration
        </CardTitle>
        <CardDescription>
          Auto-publish videos to TikTok
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
                  <p className="font-medium">Connected to TikTok</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>@{connection.platform_username || 'Unknown'}</span>
                    {connection.platform_display_name && (
                      <span>• {connection.platform_display_name}</span>
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
                  Your TikTok connection has expired. Reconnect to continue automatic publishing.
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
                      Reconnect TikTok
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
                      <AlertDialogTitle>Disconnect TikTok Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the connection to your TikTok account. Your videos will no longer be automatically published to TikTok until you reconnect.
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
              Connect your TikTok account to auto-publish videos
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
                  Connect TikTok Account
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}