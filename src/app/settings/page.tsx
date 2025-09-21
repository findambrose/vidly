'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { DashboardPageHeader } from '@/components/dashboard/layout/dashboard-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Palette, MessageSquare, Video, Mic, Settings as SettingsIcon, Share2 } from 'lucide-react';
import { LoadingScreen } from '@/components/dashboard/layout/loading-screen';
import { TikTokConnectionManager } from '@/components/settings/tiktok-connection-manager';
import { YouTubeConnectionManager } from '@/components/settings/youtube-connection-manager';

// Publishing preferences interfaces
interface PublishingPreferences {
  default_action: 'none' | 'tiktok' | 'youtube' | 'both';
  platforms: {
    tiktok?: {
      enabled: boolean;
      auto_publish: boolean;
      privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
    };
    youtube?: {
      enabled: boolean;
      auto_publish: boolean;
      privacy_status: 'public' | 'unlisted' | 'private';
      category_id: string;
    };
  };
}

// TypeScript interface matching the database schema
interface UserPreferences {
  id: string;
  user_id: string;
  ai_voice_id: string;
  video_style_preference: string;
  preferred_video_length: number;
  auto_generate_enabled: boolean;
  notification_preferences: {
    email: boolean;
    push: boolean;
  };
  brand_color: string;
  preferred_font: 'sans-serif' | 'serif' | 'monospace';
  tone_of_voice: 'enthusiastic' | 'professional' | 'casual' | 'humorous';
  default_cta: string;
  content_pillars: string[];
  publishing_preferences: PublishingPreferences;
  created_at: string;
  updated_at: string;
}

// Available ElevenLabs Voice IDs (hardcoded list)
const AVAILABLE_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel - American Female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi - American Female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella - American Female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni - American Male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli - American Female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh - American Male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold - American Male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam - American Male' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam - American Male' },
];

// Font options
const FONT_OPTIONS = [
  { value: 'sans-serif' as const, label: 'Sans Serif (Clean & Modern)' },
  { value: 'serif' as const, label: 'Serif (Traditional & Elegant)' },
  { value: 'monospace' as const, label: 'Monospace (Tech & Code)' },
];

// Tone options
const TONE_OPTIONS = [
  { value: 'enthusiastic' as const, label: 'Enthusiastic (High Energy)' },
  { value: 'professional' as const, label: 'Professional (Business-like)' },
  { value: 'casual' as const, label: 'Casual (Friendly & Relaxed)' },
  { value: 'humorous' as const, label: 'Humorous (Fun & Entertaining)' },
];

// Video style options
const VIDEO_STYLE_OPTIONS = [
  { value: 'modern', label: 'Modern (Clean & Contemporary)' },
  { value: 'classic', label: 'Classic (Traditional & Timeless)' },
  { value: 'minimal', label: 'Minimal (Simple & Clean)' },
  { value: 'dynamic', label: 'Dynamic (Bold & Energetic)' },
];

// Publishing action options
const PUBLISHING_ACTION_OPTIONS = [
  { value: 'none' as const, label: 'Download Only (No Publishing)', description: 'Generate videos for download without auto-publishing' },
  { value: 'tiktok' as const, label: 'TikTok Only', description: 'Automatically publish to TikTok' },
  { value: 'youtube' as const, label: 'YouTube Only', description: 'Automatically publish to YouTube' },
  { value: 'both' as const, label: 'Both Platforms', description: 'Automatically publish to TikTok and YouTube' },
];

// TikTok privacy options
const TIKTOK_PRIVACY_OPTIONS = [
  { value: 'PUBLIC_TO_EVERYONE' as const, label: 'Public (Everyone can see)' },
  { value: 'MUTUAL_FOLLOW_FRIENDS' as const, label: 'Friends Only (Mutual followers)' },
  { value: 'SELF_ONLY' as const, label: 'Private (Only you can see)' },
];

// YouTube privacy options
const YOUTUBE_PRIVACY_OPTIONS = [
  { value: 'public' as const, label: 'Public (Everyone can see)' },
  { value: 'unlisted' as const, label: 'Unlisted (Anyone with link)' },
  { value: 'private' as const, label: 'Private (Only you can see)' },
];

// YouTube category options
const YOUTUBE_CATEGORY_OPTIONS = [
  { value: '22', label: 'People & Blogs' },
  { value: '23', label: 'Comedy' },
  { value: '24', label: 'Entertainment' },
  { value: '26', label: 'Howto & Style' },
  { value: '28', label: 'Science & Technology' },
];

export default function SettingsPage() {
  // State variables
  const [preferences, setPreferences] = useState<Partial<UserPreferences>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();

  // Fetch current user and preferences on component mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        // Get current user
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

        if (userError || !currentUser) {
          toast.error('Please log in to access settings');
          return;
        }

        // User is authenticated, continue with preferences fetch

        // Fetch user preferences
        const response = await fetch('/api/user/preferences');

        if (!response.ok) {
          const errorData = await response.json();

          // Handle specific error cases
          if (errorData.code === 'SCHEMA_MISSING') {
            toast.error('Database not set up. Please run migrations first.');
            console.error('Database schema missing:', errorData.details);
            return;
          }

          throw new Error(errorData.details || errorData.error || 'Failed to fetch preferences');
        }

        const userPreferences = await response.json();
        setPreferences(userPreferences);

      } catch (error) {
        console.error('Error initializing settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, [supabase]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save preferences');
      }

      const result = await response.json();
      setPreferences(result.preferences);
      toast.success('Settings saved successfully!');

    } catch (error) {
      console.error('Error saving preferences:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof UserPreferences, value: string | number | boolean) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle array input changes (for content_pillars)
  const handleArrayInputChange = (field: keyof UserPreferences, index: number, value: string) => {
    setPreferences(prev => ({
      ...prev,
      [field]: (prev[field] as string[])?.map((item, i) => i === index ? value : item) || [],
    }));
  };

  // Add new array item
  const handleAddArrayItem = (field: keyof UserPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [field]: [...((prev[field] as string[]) || []), ''],
    }));
  };

  // Remove array item
  const handleRemoveArrayItem = (field: keyof UserPreferences, index: number) => {
    setPreferences(prev => ({
      ...prev,
      [field]: (prev[field] as string[])?.filter((_, i) => i !== index) || [],
    }));
  };

  // Handle notification preferences changes
  const handleNotificationChange = (type: 'email' | 'push', value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      notification_preferences: {
        email: prev.notification_preferences?.email ?? false,
        push: prev.notification_preferences?.push ?? false,
        [type]: value,
      },
    }));
  };

  // Handle publishing preferences changes
  const handlePublishingPreferenceChange = (
    field: keyof PublishingPreferences,
    value: string | boolean
  ) => {
    setPreferences(prev => ({
      ...prev,
      publishing_preferences: {
        default_action: prev.publishing_preferences?.default_action ?? 'none',
        platforms: prev.publishing_preferences?.platforms ?? {},
        [field]: value,
      },
    }));
  };

  // Handle platform-specific publishing preferences
  const handlePlatformPreferenceChange = (
    platform: 'tiktok' | 'youtube',
    field: string,
    value: string | boolean
  ) => {
    setPreferences(prev => {
      const currentPrefs = prev.publishing_preferences ?? {
        default_action: 'none' as const,
        platforms: {},
      };

      return {
        ...prev,
        publishing_preferences: {
          ...currentPrefs,
          platforms: {
            ...currentPrefs.platforms,
            [platform]: {
              ...currentPrefs.platforms[platform],
              [field]: value,
            },
          },
        },
      };
    });
  };

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8">
        <DashboardPageHeader pageTitle={'Settings'} />
        <LoadingScreen />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8">
      <DashboardPageHeader pageTitle={'Settings'} />

      <div className="mb-4">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Customize your ShortsForge experience and video generation preferences
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Content</span>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Video</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Audio</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <Card>
          <CardHeader>
            <CardTitle>Visual Branding</CardTitle>
            <CardDescription>
              Customize the visual appearance of your videos with brand colors and fonts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Brand Color */}
            <div className="space-y-2">
              <Label htmlFor="brand_color">Brand Color</Label>
              <div className="flex items-center space-x-3">
                <Input
                  id="brand_color"
                  type="color"
                  value={preferences.brand_color || '#3b82f6'}
                  onChange={(e) => handleInputChange('brand_color', e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={preferences.brand_color || '#3b82f6'}
                  onChange={(e) => handleInputChange('brand_color', e.target.value)}
                  placeholder="#3b82f6"
                  className="font-mono"
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose your primary brand color for video overlays
              </p>
            </div>

            {/* Preferred Font */}
            <div className="space-y-2">
              <Label htmlFor="preferred_font">Preferred Font</Label>
              <Select
                value={preferences.preferred_font || 'sans-serif'}
                onValueChange={(value) => handleInputChange('preferred_font', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select font style" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select the font style for video text overlays
              </p>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
          <CardHeader>
            <CardTitle>Content & Style</CardTitle>
            <CardDescription>
              Define your content tone, messaging, and key themes for video generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tone of Voice */}
            <div className="space-y-2">
              <Label htmlFor="tone_of_voice">Tone of Voice</Label>
              <Select
                value={preferences.tone_of_voice || 'enthusiastic'}
                onValueChange={(value) => handleInputChange('tone_of_voice', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose the tone for AI-generated scripts
              </p>
            </div>

            {/* Default CTA */}
            <div className="space-y-2">
              <Label htmlFor="default_cta">Default Call-to-Action</Label>
              <Input
                id="default_cta"
                type="text"
                value={preferences.default_cta || ''}
                onChange={(e) => handleInputChange('default_cta', e.target.value)}
                placeholder="Like and follow for more!"
                maxLength={100}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Default call-to-action text added to videos (max 100 characters)
              </p>
            </div>

            {/* Content Pillars */}
            <div className="space-y-2">
              <Label>Content Pillars</Label>
              <div className="space-y-3">
                {(preferences.content_pillars || []).map((pillar, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={pillar}
                      onChange={(e) => handleArrayInputChange('content_pillars', index, e.target.value)}
                      placeholder="Enter content pillar"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveArrayItem('content_pillars', index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!preferences.content_pillars || preferences.content_pillars.length < 10) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddArrayItem('content_pillars')}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Content Pillar
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Define your main content themes and topics (max 10)
              </p>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="video" className="space-y-6">
            <Card>
          <CardHeader>
            <CardTitle>Video Preferences</CardTitle>
            <CardDescription>
              Configure default settings for video generation and style.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preferred Video Length */}
            <div className="space-y-2">
              <Label htmlFor="preferred_video_length">Preferred Video Length (seconds)</Label>
              <Input
                id="preferred_video_length"
                type="number"
                min="5"
                max="60"
                value={preferences.preferred_video_length || 15}
                onChange={(e) => handleInputChange('preferred_video_length', parseInt(e.target.value))}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Default length for generated videos (5-60 seconds)
              </p>
            </div>

            {/* Video Style */}
            <div className="space-y-2">
              <Label htmlFor="video_style_preference">Video Style</Label>
              <Select
                value={preferences.video_style_preference || 'modern'}
                onValueChange={(value) => handleInputChange('video_style_preference', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Visual style preference for video generation
              </p>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="audio" className="space-y-6">
            <Card>
          <CardHeader>
            <CardTitle>Audio Preferences</CardTitle>
            <CardDescription>
              Select your preferred AI voice for video narration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI Voice Selection */}
            <div className="space-y-2">
              <Label htmlFor="ai_voice_id">AI Voice Selection</Label>
              <Select
                value={preferences.ai_voice_id || '21m00Tcm4TlvDq8ikWAM'}
                onValueChange={(value) => handleInputChange('ai_voice_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose the AI voice for video narration
              </p>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            {/* Publishing Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle>Publishing Preferences</CardTitle>
                <CardDescription>
                  Set your default publishing behavior when generating new videos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default Publishing Action */}
                <div className="space-y-2">
                  <Label htmlFor="default_publishing_action">Default Publishing Action</Label>
                  <Select
                    value={preferences.publishing_preferences?.default_action || 'none'}
                    onValueChange={(value) => handlePublishingPreferenceChange('default_action', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default action" />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLISHING_ACTION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose what happens by default when you generate a new video
                  </p>
                </div>

                {/* Platform-specific settings - only show if user has connections */}
                {(preferences.publishing_preferences?.default_action === 'tiktok' ||
                  preferences.publishing_preferences?.default_action === 'both') && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">TikTok Settings</h4>

                    {/* TikTok Auto-publish */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto-publish to TikTok</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Automatically publish videos to TikTok when ready
                        </p>
                      </div>
                      <Switch
                        checked={preferences.publishing_preferences?.platforms?.tiktok?.auto_publish ?? true}
                        onCheckedChange={(checked) => handlePlatformPreferenceChange('tiktok', 'auto_publish', checked)}
                      />
                    </div>

                    {/* TikTok Privacy */}
                    <div className="space-y-2">
                      <Label htmlFor="tiktok_privacy">TikTok Privacy Level</Label>
                      <Select
                        value={preferences.publishing_preferences?.platforms?.tiktok?.privacy_level || 'PUBLIC_TO_EVERYONE'}
                        onValueChange={(value) => handlePlatformPreferenceChange('tiktok', 'privacy_level', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select privacy level" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIKTOK_PRIVACY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* YouTube Settings */}
                {(preferences.publishing_preferences?.default_action === 'youtube' ||
                  preferences.publishing_preferences?.default_action === 'both') && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">YouTube Settings</h4>

                    {/* YouTube Auto-publish */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto-publish to YouTube</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Automatically publish videos to YouTube when ready
                        </p>
                      </div>
                      <Switch
                        checked={preferences.publishing_preferences?.platforms?.youtube?.auto_publish ?? true}
                        onCheckedChange={(checked) => handlePlatformPreferenceChange('youtube', 'auto_publish', checked)}
                      />
                    </div>

                    {/* YouTube Privacy */}
                    <div className="space-y-2">
                      <Label htmlFor="youtube_privacy">YouTube Privacy Status</Label>
                      <Select
                        value={preferences.publishing_preferences?.platforms?.youtube?.privacy_status || 'public'}
                        onValueChange={(value) => handlePlatformPreferenceChange('youtube', 'privacy_status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select privacy status" />
                        </SelectTrigger>
                        <SelectContent>
                          {YOUTUBE_PRIVACY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* YouTube Category */}
                    <div className="space-y-2">
                      <Label htmlFor="youtube_category">YouTube Category</Label>
                      <Select
                        value={preferences.publishing_preferences?.platforms?.youtube?.category_id || '22'}
                        onValueChange={(value) => handlePlatformPreferenceChange('youtube', 'category_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {YOUTUBE_CATEGORY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social Platform Connections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TikTokConnectionManager />
              <YouTubeConnectionManager />
            </div>
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <Card>
          <CardHeader>
            <CardTitle>Automation & Notifications</CardTitle>
            <CardDescription>
              Configure automatic video generation and notification preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto-Generate Videos */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Generate Videos</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically generate videos from trending topics
                </p>
              </div>
              <Switch
                checked={preferences.auto_generate_enabled || false}
                onCheckedChange={(checked) => handleInputChange('auto_generate_enabled', checked)}
              />
            </div>

            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive updates about video generation via email
                </p>
              </div>
              <Switch
                checked={preferences.notification_preferences?.email || false}
                onCheckedChange={(checked) => handleNotificationChange('email', checked)}
              />
            </div>

            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive instant notifications in your browser
                </p>
              </div>
              <Switch
                checked={preferences.notification_preferences?.push || false}
                onCheckedChange={(checked) => handleNotificationChange('push', checked)}
              />
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        {/* Actions Section - Outside tabs so it's always visible */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.reload()}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}