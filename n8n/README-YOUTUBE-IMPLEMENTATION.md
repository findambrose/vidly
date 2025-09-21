# YouTube Node Implementation Guide

## Overview

The ShortsForge publishing workflow has been updated to use the official n8n YouTube node instead of custom JavaScript simulation code. This provides production-ready video uploading capabilities with proper OAuth2 authentication.

## Key Changes Made

### ✅ **Replaced Custom Code with Official Nodes**

**Before (Custom JavaScript Simulation):**
```javascript
// Simulated YouTube upload with fake video IDs
const uploadResponse = {
  id: 'simulated_video_id_' + Date.now(),
  // ... fake response
};
```

**After (Official n8n YouTube Node):**
```json
{
  "type": "n8n-nodes-base.youTube",
  "parameters": {
    "resource": "video",
    "operation": "upload",
    "title": "{{ video_title }}",
    "description": "{{ video_description }}",
    "tags": "shorts,trending,viral",
    "categoryId": "22",
    "privacyStatus": "public",
    "binaryData": true
  }
}
```

### ✅ **Added Video Download Node**

New HTTP Request node to download video files from Shotstack URLs before uploading:
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": "{{ video_url }}",
    "options": {
      "response": {
        "responseFormat": "file"
      }
    }
  }
}
```

### ✅ **Updated Data Flow**

**New YouTube Publishing Flow:**
1. `Prepare YouTube Data` → Extract video metadata and connection info
2. `Download Video File` → Download video from Shotstack URL as binary data
3. `Upload to YouTube` → Upload video using official YouTube node
4. `Check YouTube Success` → Validate upload using real YouTube response
5. `Update Success/Failed` → Update database with actual YouTube video ID and URL

## Required Setup

### 1. **YouTube OAuth2 Credentials**

Create credentials in n8n with these settings:
- **Type**: YouTube OAuth2 API
- **Name**: `YouTube OAuth2 API`
- **Client ID**: From Google Developers Console
- **Client Secret**: From Google Developers Console
- **Scope**: `https://www.googleapis.com/auth/youtube.upload`

### 2. **Google Developers Console Setup**

1. Enable YouTube Data API v3
2. Create OAuth2 credentials (Web application type)
3. Add authorized redirect URIs:
   - `https://your-n8n-instance.com/rest/oauth2-credential/callback`
   - `http://localhost:5678/rest/oauth2-credential/callback` (for local testing)

### 3. **Environment Variables**

Add to your n8n environment:
```env
# Required for large video file handling
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
N8N_PAYLOAD_SIZE_MAX=16777216
```

### 4. **Social Connections Table**

Ensure your `social_connections` table includes:
```sql
-- YouTube connection fields
platform VARCHAR(50) -- 'youtube'
access_token TEXT
refresh_token TEXT
expires_at TIMESTAMP
platform_username VARCHAR(255) -- Channel ID
is_active BOOLEAN
```

## Updated Response Handling

### **YouTube Success Response:**
```json
{
  "id": "actual_youtube_video_id",
  "snippet": {
    "title": "Video Title",
    "description": "Video Description",
    "channelId": "channel_id"
  },
  "status": {
    "uploadStatus": "uploaded",
    "privacyStatus": "public"
  }
}
```

### **Database Updates:**
- `youtube_url`: `https://youtube.com/watch?v={video_id}`
- `platform_post_id`: Actual YouTube video ID
- `publishing_status`: `published` or `publish_failed`

## Benefits of This Implementation

### ✅ **Production Ready**
- Real video uploads to YouTube (not simulation)
- Proper OAuth2 authentication flow
- Automatic token refresh handling

### ✅ **Better Error Handling**
- Detailed YouTube API error messages
- Proper status codes and responses
- Binary data validation

### ✅ **Enhanced Features**
- Video thumbnails and metadata
- Category and privacy settings
- Tag management
- Proper video formatting

### ✅ **Scalability**
- Handles large video files properly
- Resumable upload support (built into YouTube node)
- Rate limiting compliance

## Troubleshooting

### **Common Issues:**

1. **413 Payload Too Large**
   - Increase `N8N_PAYLOAD_SIZE_MAX`
   - Set `N8N_DEFAULT_BINARY_DATA_MODE=filesystem`

2. **OAuth2 Authentication Failed**
   - Verify Google Console redirect URIs
   - Check client ID/secret configuration
   - Ensure YouTube Data API v3 is enabled

3. **Video Upload Failed**
   - Check video file format (MP4 recommended)
   - Verify video file size limits
   - Confirm YouTube quota limits

4. **Invalid Binary Data**
   - Ensure video download completed successfully
   - Check `responseFormat: "file"` in download node
   - Verify `binaryData: true` in YouTube node

### **Testing Steps:**

1. Test video download from Shotstack URL
2. Verify YouTube OAuth2 connection in n8n
3. Upload a small test video first
4. Check YouTube channel for uploaded video
5. Verify database updates are correct

## Migration Notes

- **No Breaking Changes**: Existing TikTok publishing continues to work
- **Backward Compatible**: Database schema unchanged
- **Environment Setup**: Requires new OAuth2 credentials
- **Testing Required**: Test with small videos first

This implementation transforms the YouTube publishing from a prototype simulation into a fully functional production system ready for real-world use.