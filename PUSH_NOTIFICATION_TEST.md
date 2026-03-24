# Push Notification Testing Guide

## ✅ Prerequisites

- [ ] Backend running on `localhost:7676`
- [ ] Frontend running on `localhost:7678`
- [ ] Browser: Chrome, Firefox, or Edge (Safari has limited support)
- [ ] Logged in as hotel staff/owner account

---

## 🧪 Test Steps

### Step 1: Enable Notifications Permission
```
1. Open DevTools (F12)
2. Go to Console tab
3. Check for permission prompt when page loads
4. Click "Allow" when prompted
```

### Step 2: Verify Service Worker Registration
```
DevTools → Application → Service Workers
Should show:
✅ /service-worker.js - Status: activated and running
```

### Step 3: Create Test Notification
```
1. Go to "Manage Requests" or "Manage Bookings"
2. Create a new request/booking
3. You should hear the tone immediately (if app is open)
```

### Step 4: Test Push Notification (App Closed)
```
1. Close the browser/tab completely
2. Create another request/booking from a different device/admin account
3. Re-open the browser
4. You should see a push notification + hear tone
```

### Step 5: Check Browser Console Logs
```
DevTools → Console tab should show:
✅ [Notifications] Connected
✅ [Notifications] Received notification: New Request
✅ [SW] Push notification shown: New Request
✅ ✅ Notification tone playing: gentle_chime
```

---

## 🔍 Debugging

### If tone doesn't play:

**Check 1: Network tab**
```
DevTools → Network
Filter: "gentle_chime.mp3" or "alert_sound.mp3"
Expected: 206 status (file loaded)
```

**Check 2: Console errors**
```
Look for:
❌ NotAllowedError = Browser blocked autoplay (user must interact)
❌ NotSupportedError = Audio format not supported
❌ 404 = Tone file not found
```

**Check 3: Autoplay policy**
- Click anywhere on page to enable autoplay
- Try notification again
- If it works now = autoplay policy issue

### If push notification doesn't show:

**Check 1: Notification permission**
```
DevTools → Application → Manifest
Check: "notifications" permission = granted
```

**Check 2: Service Worker status**
```
DevTools → Application → Service Workers
Should show: "activated and running"
If not: refresh page
```

**Check 3: Notification in system**
```
Windows: Check system notification tray
Mac: Check notification center
If not there = browser blocked push notification
```

### If socket not connecting:

**Check 1: Console log**
```
Should show: [Notifications] Connected
If shows: Connection error → backend may be offline
```

**Check 2: Network tab**
```
Filter: "socket.io"
Should show WebSocket connection (101 status)
If not: backend may not be running
```

---

## ✅ Success Criteria

All of these should work:

- [ ] Real-time tone plays when notification received (app open)
- [ ] Push notification appears when app is closed
- [ ] Push notification tone plays in background
- [ ] Tone file loads successfully (206 status in network)
- [ ] Console shows no errors related to notifications
- [ ] Socket.IO connects successfully
- [ ] Service Worker is active

---

## 📊 Expected Console Output

When everything works:

```
[Notifications] Connected
✅ Notification tone playing: gentle_chime
[Notifications] Received notification: New Request
[SW] Push notification shown: New Request
```

---

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| No tone heard (app open) | Autoplay blocked | Click page + try again |
| Push notification not shown | Permission denied | Check notification settings |
| Tone file 404 | Path wrong | Check `/assets/tones/` folder |
| Service Worker not active | Cache issue | Hard refresh (Ctrl+Shift+R) |
| Socket disconnects | Backend offline | Restart backend |
| NotAllowedError in console | Autoplay policy | User must interact with page first |

---

## 🎯 What to Test

### Scenarios:

1. **Single notification** → Tone plays once
2. **Multiple notifications** → Tone plays for each
3. **App closed** → Push notification + tone
4. **Custom tone** → Plays uploaded MP3
5. **Different tone selected** → Plays correct tone
6. **Notification dismissed** → Can receive another

---

## 📱 Mobile Testing

For iOS/Android:
1. Install PWA (Add to Home Screen)
2. Grant notification permission
3. Create test notification
4. App should show notification in system
5. Tone may not play on mobile (autoplay restricted)

---

## ✨ If All Tests Pass

Push notifications are **working correctly**! 🎉

You can now:
- ✅ Deploy to production
- ✅ Test with real users
- ✅ Monitor notification delivery
- ✅ Set different tones per hotel

