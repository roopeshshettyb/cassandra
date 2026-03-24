# Push Notification Testing Guide

## System Overview

```
Guest/Staff User
      ↓
    App (Frontend)
      ↓
Service Worker (listens for push events)
      ↓
Backend (emits notifications via Socket.IO + Service Worker push)
      ↓
Hotel Staff/Owner/Guest (receives notifications)
```

## Prerequisites

✅ **Backend running** on port 7676
✅ **Frontend running** on port 7678
✅ **Service Worker registered** (check DevTools → Application → Service Workers)
✅ **Browser notifications enabled** (site has permission)

## Testing Steps

### 1. Request Notification Permission

**In Browser Console:**
```javascript
// Request notification permission
Notification.requestPermission().then(permission => {
  console.log('Notification permission:', permission);
});
```

Expected output: `permission: granted`

### 2. Verify Service Worker

**DevTools → Application → Service Workers:**
- ✅ Service Worker should show as "activated and running"
- ✅ Scope should be `/`
- ✅ Check console for `[SW] Service Worker installed/activated`

### 3. Connect to Notifications Socket

**In Browser Console:**
```javascript
// Check if notifications socket is connected
if (window.io) {
  const notifSocket = io('http://localhost:7676/notifications', {
    auth: {
      token: localStorage.getItem('token')
    }
  });

  notifSocket.on('connected', (data) => {
    console.log('✅ Connected to notifications:', data);
  });

  notifSocket.on('notification', (data) => {
    console.log('📬 Received notification:', data);
  });

  notifSocket.on('error', (error) => {
    console.error('❌ Notification error:', error);
  });
} else {
  console.warn('socket.io not loaded');
}
```

### 4. Test Notification Triggers

#### **Option A: Create a New Request**
1. Go to **Manage Requests**
2. Click **"+ New Request"**
3. Select type, hotel, guest
4. Click **"Create"**
5. **Expected:**
   - Hotel staff receives notification
   - Badge updates (if open)
   - Sound plays (if configured)
   - Service Worker shows native notification

#### **Option B: Create a New Booking**
1. Go to **Manage Bookings**
2. Click **"+ Add Booking"**
3. Select guest, hotel, dates
4. Click **"Create"**
5. **Expected:**
   - Guest AND hotel staff receive notifications
   - Multiple recipients should see it

#### **Option C: Update a Request**
1. Go to **Manage Requests**
2. Open an existing request
3. Update status/notes
4. Click **"Save"**
5. **Expected:**
   - All participants notified
   - Request creator gets notification

### 5. Test with Tab Closed

1. **Open app in one tab**
2. **Leave that tab**
3. **Switch to different tab**
4. **Create a new request** (from admin)
5. **Expected:**
   - Even though tab is in background, notification shows
   - Click notification → opens/focuses the app tab

### 6. Test Notification Tone

1. Go to **Hotel Settings → Notification Tone**
2. Select **"Gentle Chime"** or **"Alert Sound"**
3. Click **"🔊 Test Tone"** → Should hear sound ✅
4. Create a new request → Should play selected tone ✅

### 7. Test Custom Tone

1. Upload custom MP3 in Hotel Settings
2. Dropdown shows **"Custom Tone"** option
3. Click **"🔊 Test Tone"** → Should play your custom file
4. Create request → Plays your custom tone ✅

## What to Check

### Backend Logs
```
[SW] Service Worker installed
[SW] Service Worker activated
Account {id} connected to notifications
📬 Notification created for accountIds: [1, 2, 3]
```

### Frontend Console
```
✅ Connected to notifications: {message, accountId}
📬 Received notification: {title, message, link, toneUrl}
🔊 Playing tone: {URL}
✅ Tone playing successfully
```

### Network Tab
- **Socket.IO connection** established to `/notifications` namespace
- **Ping/pong** messages every 30 seconds (heartbeat)
- **No errors** in Network tab

### DevTools → Application → Service Workers
```
/service-worker.js
Status: activated and running
Scope: /
Last updated: [timestamp]
```

## Troubleshooting

### Notifications Not Showing?

1. **Check permission:**
   ```javascript
   console.log(Notification.permission); // should be 'granted'
   ```

2. **Check Service Worker:**
   - DevTools → Application → Service Workers
   - Should show "activated and running"

3. **Check Socket Connection:**
   - Open DevTools Console
   - Should see `✅ Connected to notifications`

4. **Check backend logs:**
   ```bash
   # Watch backend logs
   npm run start:debug
   ```

### Sound Not Playing?

1. **Browser autoplay policy:**
   - Click on page first (required by browser)
   - Then trigger notification

2. **Muted browser tab:**
   - Unmute the tab (speaker icon in URL bar)

3. **No tone configured:**
   - Go to Hotel Settings → select a tone

### Notification Sound in Tone Settings?

1. Hard refresh: `Ctrl+Shift+R`
2. Go to Hotel Settings
3. Click **"🔊 Test Tone"** → should hear sound
4. If not, check console for errors

## Production Checklist

Before deploying:

- [ ] Service Worker at `/public/service-worker.js` (not subdirectory)
- [ ] Notification permissions requested on first visit
- [ ] Hotel tones configured
- [ ] Socket.IO connection authenticated with JWT
- [ ] Error logging (not console logs)
- [ ] Service Worker tested with app closed
- [ ] Multiple recipients tested
- [ ] Custom tones tested

## References

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/notification)
- [Socket.IO Documentation](https://socket.io/docs/)
