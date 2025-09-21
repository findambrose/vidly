# ShortsForge Automated Publishing Implementation Guide

## Overview

This implementation extends the existing ShortsForge video generation workflow with automated publishing capabilities for TikTok and YouTube. The system handles user preferences, social media account connections, and robust error handling.

## Architecture

### Core Components

1. **Enhanced Webhook Trigger** - Now accepts `publishAction` parameter
2. **Social Connections Check** - Validates user's connected platforms
3. **Publishing Router** - Routes based on user's publishing preference
4. **Platform-Specific Branches** - Dedicated handling for each platform
5. **Error Handling** - Comprehensive failure management
6. **Database Updates** - Status tracking throughout the process

## Payload Structure

### Frontend Request Format
```json
{
  "userId": "uuid-string",
  "trendId": "uuid-string",
  "publishAction": "none" | "tiktok" | "youtube" | "both"
}
```

### Expected Response
```json
{
  "success": true,
  "message": "Video generation started",
  "publishAction": "tiktok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Database Schema Requirements

### social_connections Table
```sql
CREATE TABLE social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL, -- 'tiktok' | 'youtube'
  access_token text NOT NULL, -- Encrypted
  refresh_token text, -- Encrypted (YouTube only)
  expires_at timestamptz NOT NULL,
  platform_username text,
  platform_user_id text,
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### user_videos Table Extensions
```sql
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS publishing_action text;
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS publishing_status text;
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS tiktok_url text;
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS platform_post_id text;
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS publish_error text;
ALTER TABLE user_videos ADD COLUMN IF NOT EXISTS published_at timestamptz;
```

## Publishing Flow Logic

### 1. Webhook Processing
- Receives payload with `publishAction`
- Validates required parameters (`userId`, `trendId`)
- Immediately responds to prevent timeout
- Continues processing in background

### 2. Video Generation (Existing)
- Follows existing workflow path
- Generates script, voiceover, and renders video
- Stores video in Supabase Storage
- Updates `user_videos` table with completion status

### 3. Social Connections Check
```javascript
// Query active connections for user
const connections = await supabase
  .from('social_connections')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .gt('expires_at', new Date().toISOString());
```

### 4. Publishing Router Logic
```javascript
const publishAction = webhookData.publishAction || 'none';

switch (publishAction) {
  case 'none':
    // Update status to 'download_only'
    break;
  case 'tiktok':
    // Route to TikTok branch
    break;
  case 'youtube':
    // Route to YouTube branch
    break;
  case 'both':
    // Split to parallel branches
    break;
}
```

## Platform-Specific Implementation

### TikTok Publishing Branch

#### Step 1: Token Validation
```javascript
const tiktokConnection = connections.find(conn =>
  conn.platform === 'tiktok' &&
  conn.is_active &&
  new Date(conn.expires_at) > new Date()
);
```

#### Step 2: Initiate Upload
```http
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "post_info": {
    "title": "{video_title}",
    "description": "{script_text}",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "PULL_FROM_URL",
    "video_url": "{shotstack_video_url}"
  }
}
```

#### Step 3: Status Polling
```http
POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
Authorization: Bearer {access_token}

{
  "publish_id": "{publish_id_from_init}"
}
```

#### Status Handling
- `PROCESSING_UPLOAD` → Continue polling (10-second intervals)
- `PUBLISH_COMPLETE` → Update database with success
- `FAILED` → Update database with error

### YouTube Publishing Branch

#### Step 1: Token Refresh (if needed)
```http
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id={client_id}&
client_secret={client_secret}&
refresh_token={refresh_token}&
grant_type=refresh_token
```

#### Step 2: Resumable Upload
```http
POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
Authorization: Bearer {access_token}
Content-Type: application/json
X-Upload-Content-Type: video/mp4

{
  "snippet": {
    "title": "{video_title}",
    "description": "{script_text}\n\n#Shorts #Trending #Viral",
    "tags": ["shorts", "trending", "viral"],
    "categoryId": "24"
  },
  "status": {
    "privacyStatus": "public",
    "selfDeclaredMadeForKids": false
  }
}
```

#### Step 3: Upload Video Data
```http
PUT {upload_url_from_resumable_init}
Authorization: Bearer {access_token}
Content-Type: video/mp4
Content-Length: {video_size}

{video_binary_data}
```

## Error Handling Strategy

### 1. Node-Level Error Handling
All HTTP Request nodes include:
```json
{
  "onError": "continueRegularOutput",
  "retryOnFail": true,
  "maxTries": 2,
  "waitBetweenTries": 1000,
  "alwaysOutputData": true
}
```

### 2. Connection Validation Errors
```javascript
if (!connection || new Date(connection.expires_at) <= new Date()) {
  await updateVideoStatus(videoId, {
    publishing_status: 'publish_failed',
    publish_error: 'Token expired or connection invalid'
  });
  return;
}
```

### 3. API Error Handling
```javascript
try {
  const response = await apiCall();
  // Handle success
} catch (error) {
  await updateVideoStatus(videoId, {
    publishing_status: 'publish_failed',
    publish_error: `API Error: ${error.message}`,
    error_details: {
      status: error.response?.status,
      data: error.response?.data
    }
  });
}
```

### 4. Database Error Recovery
- All status updates use upsert patterns
- Failed operations are logged with detailed error messages
- Retry logic for transient database issues

## Status Tracking

### Publishing Status Values
- `pending` - Initial state
- `processing` - Upload in progress
- `published` - Successfully published
- `publish_failed` - Failed to publish
- `download_only` - No publishing requested

### Database Update Pattern
```sql
UPDATE user_videos
SET
  publishing_status = $1,
  platform_post_id = $2,
  tiktok_url = $3,
  youtube_url = $4,
  published_at = $5,
  publish_error = $6
WHERE id = $7;
```

## Environment Variables Required

```env
# Google OAuth (for YouTube)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Keys (existing)
ELEVENLABS_API_KEY=your_elevenlabs_key
SHOTSTACK_API_KEY=your_shotstack_key
PEXELS_API_KEY=your_pexels_key
OPENROUTER_API_KEY=your_openrouter_key
```

## Testing Strategy

### 1. Unit Testing
- Test each platform branch individually
- Mock API responses for consistent testing
- Validate error handling paths

### 2. Integration Testing
```javascript
// Test payload examples
const testPayloads = [
  { userId: 'test-user', trendId: 'test-trend', publishAction: 'none' },
  { userId: 'test-user', trendId: 'test-trend', publishAction: 'tiktok' },
  { userId: 'test-user', trendId: 'test-trend', publishAction: 'youtube' },
  { userId: 'test-user', trendId: 'test-trend', publishAction: 'both' }
];
```

### 3. Error Scenarios
- Expired tokens
- Invalid video URLs
- API rate limits
- Network timeouts
- Invalid user connections

## Deployment Checklist

### n8n Configuration
- [ ] Import enhanced workflow
- [ ] Configure Supabase credentials
- [ ] Set up webhook endpoint
- [ ] Test webhook connectivity

### Database Setup
- [ ] Run migration scripts
- [ ] Set up RLS policies for social_connections
- [ ] Add indexes for performance
- [ ] Test connection queries

### API Integrations
- [ ] Register TikTok app and get credentials
- [ ] Set up YouTube OAuth application
- [ ] Configure webhook URLs in platforms
- [ ] Test API connectivity

### Frontend Integration
- [ ] Update video creation form
- [ ] Add publishing option UI
- [ ] Handle response states
- [ ] Implement status polling

### Monitoring
- [ ] Set up error logging
- [ ] Configure performance monitoring
- [ ] Add publishing success rate tracking
- [ ] Set up alert thresholds

## Production Considerations

### Security
- Encrypt all access tokens in database
- Use secure token refresh mechanisms
- Implement rate limiting on webhook endpoints
- Validate all user inputs

### Performance
- Implement connection pooling for database
- Use CDN for video file downloads
- Add caching for frequently accessed data
- Monitor API rate limits

### Scalability
- Consider queue system for high volume
- Implement batch processing for multiple videos
- Add horizontal scaling for n8n workers
- Plan for multi-region deployment

## Troubleshooting Guide

### Common Issues

1. **Token Expired Errors**
   - Check token expiry dates
   - Verify refresh token functionality
   - Update social_connections table

2. **Video Upload Failures**
   - Validate video URL accessibility
   - Check file size limits
   - Verify network connectivity

3. **Webhook Timeouts**
   - Ensure response is sent immediately
   - Move processing to background
   - Add proper error handling

4. **Database Connection Issues**
   - Check connection pool settings
   - Verify RLS policies
   - Monitor query performance

### Debug Mode
Enable detailed logging:
```javascript
console.log('Processing publishAction:', publishAction);
console.log('User connections:', connections);
console.log('Video data:', videoData);
```

This implementation provides a robust, scalable solution for automated social media publishing that integrates seamlessly with the existing ShortsForge workflow.