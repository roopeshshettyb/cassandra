# Notification System Features - Testing Guide

## ✅ Feature 1: Toast Notifications

The notification system now shows **toast notifications** using the existing react-toastify configuration.

### How it works:
1. When a real-time notification arrives via Socket.IO
2. A toast message appears at top-right corner
3. Toast auto-closes after 3 seconds
4. Shows the notification message + plays tone

### To Test:
1. **Account A**: Log in on browser
2. **Account B**: Create a new request/booking (different device/account)
3. **Account A**: Should see:
   - ✅ Toast notification appears with message
   - ✅ Tone plays immediately
   - ✅ Toast auto-dismisses after 3s

### Code Location:
- [App.js:103-120](frontend/src/App.js#L103-L120) - Toast effect hook
- Uses existing `toast.info()` from react-toastify

---

## ✅ Feature 2: Specific Resource Navigation

Clicking on notifications now opens the **specific request/booking**, not a list of all requests.

### Previous Behavior:
```
New Request → /requests (shows all requests)
New Booking → /bookings (shows all bookings)
```

### New Behavior:
```
New Request → /requests/123 (opens specific request)
New Booking → /bookings/456?tab=overview (opens specific booking)
New Message → /requests/789 (opens specific request with message)
```

### To Test (Real-time notification):
1. **Account A**: Open requests page on browser
2. **Account B**: Create new request from different account
3. **Account A**: Click toast notification
   - ✅ Should navigate to `/requests/{id}`
   - ✅ Should show that specific request details

### To Test (Push notification):
1. **Account A**: Close app completely
2. **Account B**: Create new request
3. **Account A**: Click system push notification
   - ✅ Should open app
   - ✅ Should navigate to `/requests/{id}`
   - ✅ Service Worker uses same link

### Code Locations:
- [notification.factory.ts:39](backend/src/notifications/notification.factory.ts#L39) - Request links
- [notification.factory.ts:74](backend/src/notifications/notification.factory.ts#L74) - Booking links
- [handlers.js:105](frontend/src/service-worker/handlers.js#L105) - Service Worker uses link

---

## ✅ Feature 3: Mobile Testing with Local IP

The system now supports mobile testing via local network IP with automatic CORS configuration.

### Local Machine IP: `172.21.1.137`

### Access from Mobile Device:
```
Frontend: http://172.21.1.137:7678
Backend:  http://172.21.1.137:7676
```

### Mobile Setup:
1. Mobile device on same WiFi network
2. No additional configuration needed (CORS auto-configured for dev)
3. Works for:
   - Real-time notifications (app open)
   - Push notifications (app closed)
   - WebSocket connections
   - File uploads/downloads

### To Test on iOS:
```
1. Safari → http://172.21.1.137:7678
2. Log in
3. Grant notification permission
4. Create test notification from another device
5. Verify toast + push notifications work
6. Optional: Add to Home Screen (install PWA)
```

### To Test on Android:
```
1. Chrome → http://172.21.1.137:7678
2. Log in
3. Grant notification permission
4. Create test notification from another device
5. Verify toast + push notifications work
6. Optional: Menu → Add to Home Screen (install PWA)
```

### CORS Configuration:
- **Development**: Allows localhost + local IPs (172.21.x.x)
- **Production**: Allows only configured frontend URL

### Code Location:
- [main.ts:13-21](backend/src/main.ts#L13-L21) - CORS configuration

---

## 🧪 Complete Test Scenario

### Setup:
- 2 devices on same WiFi
- Device A: Desktop browser or iPhone at `http://172.21.1.137:7678`
- Device B: Desktop browser to create notifications

### Test Flow:
1. **Device A**: Log in → Grant notification permission
2. **Device B**: Create new request (assign to different user)
3. **Device A**: Verify:
   - ✅ Toast notification appears with message
   - ✅ Tone plays
   - ✅ Can click toast/notification to open specific request
4. **Device A**: Close app completely
5. **Device B**: Create another request
6. **Device A**: Verify:
   - ✅ Push notification appears in system tray
   - ✅ Tone plays in background
   - ✅ Clicking opens app with correct request

### Success Criteria:
- [ ] Toast appears for real-time notifications
- [ ] Tone plays with toast
- [ ] Navigation works (correct request/booking opened)
- [ ] Push notifications work when app closed
- [ ] Mobile device can access via local IP
- [ ] WebSocket connection stable
- [ ] No console errors

---

## 🔧 Troubleshooting

### Toast not appearing:
```
Check:
1. DevTools → Console for errors
2. React-toastify is imported and configured
3. Notification received successfully (check Socket logs)
4. Try refreshing page
```

### Wrong resource opens on click:
```
Check:
1. Notification link includes ID: /requests/123
2. Frontend router supports that path
3. Browser DevTools → Network → check request
```

### Mobile can't connect to local IP:
```
Check:
1. Mobile on same WiFi as dev machine
2. Firewall allows ports 7676 & 7678
3. IP address is correct: 172.21.1.137
4. Backend/frontend running
5. Try: ping 172.21.1.137 from mobile browser address bar
```

### Push notification doesn't show on mobile:
```
Check:
1. Notification permission granted (Settings app)
2. Service Worker registered (DevTools → Application)
3. Close app completely (not background)
4. Check mobile system tray
5. Battery saver mode might restrict notifications
```

---

## 📊 Expected Console Output

### Real-time notification:
```
[Notifications] Connected
[Notifications] Received notification: New Request
✅ Notification tone playing: gentle_chime
```

### Service Worker push:
```
[SW] Registered
[SW] Registered: ServiceWorkerRegistration {...}
[SW] Push event received: {title, message, id, link}
[SW] Notification tone playing: [tone url]
[SW] Push notification shown: New Request
```

---

## 📱 Mobile PWA Features

After installing as PWA:
- Standalone app icon on home screen
- Fullscreen mode (no browser UI)
- Offline support (cached assets)
- Push notifications still work
- Same notification features as web

---

## Next Steps

1. ✅ Test on real mobile devices
2. ✅ Verify all three features work together
3. ✅ Test on different browsers (Safari, Chrome, Firefox)
4. ✅ Test with slow network (DevTools throttling)
5. ✅ Test with battery saver enabled
6. ✅ Test rapid-fire notifications
7. Ready for production deployment!
