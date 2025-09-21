# TikTok Integration Guide for ShortsForge

This guide explains how to set up and use the automated TikTok publishing feature in ShortsForge.

## Overview

The TikTok integration allows users to:
- Connect their TikTok account via OAuth2
- Automatically publish generated videos to TikTok
- Track publishing status and manage connections
- Handle token expiration and reconnection

## Setup Instructions

### 1. TikTok Developer Account Setup

1. **Create TikTok Developer Account**
   - Visit [TikTok for Developers](https://developers.tiktok.com/)
   - Sign up with your TikTok account
   - Complete the developer verification process

2. **Create a New App**
   - Go to the TikTok Developer Console
   - Click "Create an app"
   - Fill in your app details:
     - App name: "ShortsForge"
     - App description: "Automated TikTok video publishing for content creators"
     - Category: "Content Creation"

3. **Configure OAuth Settings**
   - In your app settings, go to "Login Kit"
   - Add redirect URIs:
     - Development: `http://localhost:3000/api/tiktok/callback`
     - Production: `https://yourdomain.com/api/tiktok/callback`
   - Request the following scopes:
     - `video.upload` (required)
     - `user.info.profile` (optional)

4. **Get Credentials**
   - Copy your `Client Key` and `Client Secret`
   - Add them to your environment variables

### 2. Environment Configuration

Add the following variables to your `.env.local` file:

```bash
# TikTok OAuth Configuration
TIKTOK_CLIENT_KEY=your_client_key_here
TIKTOK_CLIENT_SECRET=your_client_secret_here
TIKTOK_REDIRECT_URI=http://localhost:3000/api/tiktok/callback
```

### 3. Database Migration

Run the database migration to create the social connections table:

```bash
supabase db push
```

This will create:
- `social_connections` table for storing OAuth tokens
- RLS policies for secure access
- Additional fields in `user_videos` for publishing status

### 4. Frontend Integration

Add the TikTokConnectionManager component to your settings page:

```tsx
import { TikTokConnectionManager } from '@/components/settings/tiktok-connection-manager';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Other settings components */}
      <TikTokConnectionManager />
    </div>
  );
}
```

### 5. n8n Workflow Integration

1. **Import the TikTok Publishing Extension**
   - Import `n8n/tiktok-publishing-extension.json` into your n8n instance
   - Connect it to your existing video generation workflow

2. **Configure Credentials**
   - Set up Supabase credentials in n8n
   - Update credential IDs in the workflow nodes

3. **Connect to Main Workflow**
   - Add the "Check TikTok Connection" node after video completion
   - Connect the success/failure paths appropriately

## How It Works

### OAuth Flow
1. User clicks "Connect TikTok Account" in settings
2. User is redirected to TikTok OAuth page
3. User grants permissions
4. TikTok redirects back with authorization code
5. Backend exchanges code for access token
6. Token is securely stored in database

### Publishing Flow
1. Video generation completes successfully
2. n8n workflow checks for active TikTok connection
3. If connected, validates token expiration
4. Initiates TikTok upload using their API
5. Polls for upload completion status
6. Updates video record with publishing status
7. Provides user feedback via real-time updates

### Token Management
- Tokens are stored encrypted in the database
- Expiration dates are tracked and validated
- Users are prompted to reconnect when tokens expire
- Last usage is tracked for analytics

## API Endpoints

### `/api/tiktok/auth` (GET)
- Initiates OAuth flow
- Redirects to TikTok authorization page
- Includes CSRF protection

### `/api/tiktok/callback` (GET)
- Handles OAuth callback
- Exchanges code for tokens
- Stores connection in database
- Redirects to settings with status

### `/api/tiktok/disconnect` (DELETE)
- Removes TikTok connection
- Requires authentication
- Provides confirmation response

## Database Schema

### `social_connections` Table
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
platform TEXT CHECK (platform IN ('tiktok', 'youtube', ...))
access_token TEXT NOT NULL
refresh_token TEXT
expires_in INTEGER
expires_at TIMESTAMPTZ
platform_user_id TEXT
platform_username TEXT
platform_display_name TEXT
scopes TEXT[]
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### `user_videos` Additional Fields
```sql
publishing_status TEXT DEFAULT 'not_published'
published_url TEXT
publish_error TEXT
published_at TIMESTAMPTZ
platform_post_id TEXT
```

## Error Handling

### Common Errors and Solutions

1. **Token Expired**
   - User sees "Connection Expired" in settings
   - Click "Reconnect TikTok" to refresh token

2. **Upload Failed**
   - Video status shows "publish_failed"
   - Error details stored in `publish_error` field
   - User can retry from video management page

3. **Network Issues**
   - Automatic retry logic in n8n workflow
   - Timeout handling for API calls
   - Graceful fallback to manual download

4. **Rate Limiting**
   - TikTok API rate limits are respected
   - Exponential backoff for retries
   - User notification for rate limit issues

## Security Features

- **CSRF Protection**: State parameter validation
- **Token Encryption**: Sensitive data is encrypted
- **RLS Policies**: Users can only access their own data
- **Secure Cookies**: HttpOnly cookies for OAuth state
- **Input Validation**: All inputs are validated and sanitized

## Testing

### Development Testing
1. Use TikTok's sandbox environment
2. Test OAuth flow with development redirect URI
3. Verify token storage and retrieval
4. Test publishing with sample videos

### Production Checklist
- [ ] TikTok app approved for production
- [ ] HTTPS redirect URIs configured
- [ ] Environment variables set correctly
- [ ] Database migrations applied
- [ ] Rate limiting configured
- [ ] Error monitoring set up

## Monitoring and Analytics

### Key Metrics to Track
- Connection success/failure rates
- Publishing success/failure rates
- Token expiration patterns
- API response times
- Error frequency by type

### Logging
- OAuth flow completion
- Publishing attempts and results
- Token refresh events
- Error conditions with context

## Troubleshooting

### Common Issues

1. **"TikTok integration not configured"**
   - Check environment variables are set
   - Verify TikTok app credentials

2. **"Failed to connect to TikTok"**
   - Check redirect URI matches exactly
   - Verify TikTok app is active and approved

3. **"Publishing failed"**
   - Check video URL is publicly accessible
   - Verify token hasn't expired
   - Check TikTok API status

4. **Real-time updates not working**
   - Verify Supabase real-time is enabled
   - Check database policies allow updates
   - Confirm subscription is active

## Future Enhancements

- Support for additional platforms (YouTube, Instagram)
- Scheduled publishing options
- Video optimization for different platforms
- Analytics dashboard for publishing metrics
- Bulk publishing capabilities
- Custom hashtag management

## Support

For issues with this integration:
1. Check the troubleshooting section above
2. Review the n8n workflow logs
3. Check Supabase database logs
4. Verify TikTok Developer Console settings
5. Contact support with specific error messages