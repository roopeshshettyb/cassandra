# Notification Tones - S3 Migration Fix

## What Was Wrong ❌
- Notification tone uploads were falling back to **local filesystem** storage (`/backend/uploads/notification-tones/`)
- URLs like `/uploads/notification-tones/` are not production-ready (won't work on serverless, need static file serving)
- Should be **S3-only** for scalability

## What Changed ✅

### 1. **Removed Local Fallback**
**File:** `backend/src/hotels/hotels.service.ts`
- **Before:** Try S3 → fallback to local filesystem
- **After:** Upload to S3 only (fails if S3 unavailable)
- **Reason:** Force proper S3 configuration instead of hiding issues

### 2. **Cleaned Up Imports**
Removed unused `fs/promises` and `path` imports (no longer needed)

### 3. **Fixed Error Handling**
Now provides clear error message: `"Failed to upload notification tone to S3: [error]"`

---

## Migration Steps

### Step 1: Verify S3 Configuration
Ensure your backend `.env` or environment has:
```
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=xxx
AWS_S3_REGION=xxx
AWS_S3_KEY_PREFIX=samantha/
```

### Step 2: Migrate Existing Local Files to S3 (OPTIONAL)
If you have files in `/backend/uploads/notification-tones/`, you can migrate them:

```bash
cd backend
npm run migrate:notification-tones-s3
```

This will:
- Read all `.mp3` files from local directory
- Upload each to S3 under `notification-tones/` folder
- Print S3 URLs for each file

### Step 3: Delete Local Files (After Migration)
```bash
rm -rf backend/uploads/notification-tones/
```

---

## Testing the Fix

### Test 1: Upload Custom Tone
```bash
curl -X POST http://localhost:7676/hotels/1/notification-tone \
  -F "file=@/path/to/tone.mp3" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Notification tone uploaded to S3",
  "data": {
    "id": 1,
    "customToneUrl": "https://s3.amazonaws.com/bucket/samantha/notification-tones/1-notification-tone-1711266000000.mp3",
    "notificationTone": "custom"
  }
}
```

### Test 2: Use Custom Tone
- Create a notification for the hotel
- Check that frontend plays the tone from S3 URL
- Verify no 404 errors in browser console

### Test 3: Fallback to Built-in Tones
- Set hotel tone to `"gentle_chime"` or `"alert_sound"`
- Verify frontend can play these built-in tones

---

## Architecture Now

```
User uploads MP3 → POST /hotels/:id/notification-tone
                  ↓
          Validate: type, size
                  ↓
          Upload to S3 (no local fallback)
                  ↓
          Save S3 URL in DB (hotel.customToneUrl)
                  ↓
          Frontend uses S3 URL directly
```

---

## Benefits

✅ **Production-ready** - Works on serverless/containers
✅ **Scalable** - No disk I/O on backend
✅ **Reliable** - S3 is CDN-backed for fast delivery
✅ **Secure** - Files not exposed via filesystem
✅ **Fail-safe** - Clear errors if S3 not configured

---

## If S3 Upload Fails

The endpoint now **rejects** with a clear error instead of silently saving locally:

```json
{
  "statusCode": 400,
  "message": "Failed to upload notification tone to S3: Access Denied",
  "error": "Bad Request"
}
```

**Fix S3 configuration and try again.**

---

## Cleanup

Once migration is done, you can **remove** these files:
- `backend/uploads/notification-tones/` (directory)
- Optional: `backend/src/migrations/migrate-notification-tones-to-s3.ts` (script)
