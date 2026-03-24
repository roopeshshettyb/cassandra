# Mobile Testing Setup Guide

## Network Configuration

### Local Machine IP
```
172.21.1.137
```

### Access URLs from Mobile Device
- **Frontend**: http://172.21.1.137:7678
- **Backend API**: http://172.21.1.137:7676

## Setup Instructions

### Step 1: Ensure Servers are Running
```bash
# Backend running on port 7676
cd backend && npm start

# Frontend running on port 7678 (in separate terminal)
cd frontend && npm start
```

### Step 2: Connect Mobile Device to Same Network
1. Mobile device must be on **same WiFi network** as development machine
2. Note the WiFi network name and password

### Step 3: Update Frontend Environment (if needed)

For development, the frontend automatically uses `window.location.origin`, which works fine.

For production build with specific backend URL:
```bash
# In frontend/.env or .env.local
REACT_APP_BACKEND_URL=http://172.21.1.137:7676
```

### Step 4: Test on Mobile Device

#### iOS (iPhone/iPad)
1. Open Safari
2. Navigate to: `http://172.21.1.137:7678`
3. Click "Add to Home Screen" to install as PWA (optional)
4. Grant notification permissions when prompted
5. Test push notifications with app open and closed

#### Android
1. Open Chrome or Firefox
2. Navigate to: `http://172.21.1.137:7678`
3. Tap menu → "Add to Home Screen" to install as PWA (optional)
4. Grant notification permissions when prompted
5. Test push notifications with app open and closed

## CORS Configuration (if needed)

If you get CORS errors, the backend has CORS enabled for all origins in development.

```typescript
// backend/src/main.ts
app.enableCors({
  origin: true, // Allow all origins in development
  credentials: true,
});
```

## Testing Notifications on Mobile

### Real-time Notifications (App Open)
1. Log in on mobile
2. Create a new request from desktop or another account
3. **Expected**: Toast notification appears + tone plays

### Push Notifications (App Closed)
1. Close the app completely (background processes too)
2. Create a new request from desktop
3. **Expected**: Push notification appears in system tray + tone plays
4. Click notification → should open app and navigate to that request

### WebSocket Connection
- Check mobile DevTools Console for:
  ```
  [Notifications] Connected
  [Notifications] Received notification: New Request
  ✅ Notification tone playing: gentle_chime
  ```

## Troubleshooting

### "Cannot reach server" error
- Verify mobile is on same WiFi as dev machine
- Verify firewall allows connections on ports 7676 & 7678
- Try pinging: `ping 172.21.1.137` from mobile device

### Notifications don't show
1. Check if notification permission is granted:
   - iOS: Settings → Samantha → Notifications
   - Android: App settings → Permissions → Notifications
2. Check browser console for permission errors
3. Verify Service Worker is registered (DevTools → Application)

### Sound doesn't play
- Mobile OS may restrict autoplay
- User must interact with page first (tap/scroll)
- Background sound restricted on some Android devices

### WebSocket connection fails
- Backend URL must match exactly (including port)
- Verify backend is accessible: `curl http://172.21.1.137:7676/health`
- Check firewall rules

## Performance Tips

1. **Reduce DevTools Overhead**: Close DevTools when not debugging
2. **Test on Real Device**: Emulators don't always reflect real behavior
3. **Test Multiple Browsers**: iOS Safari, Android Chrome, Firefox
4. **Test Battery Saver**: Some OS restrict background activity
5. **Test Connectivity**: Try with WiFi and mobile data

## Network Debugging

### Check Backend Connectivity
```bash
curl -v http://172.21.1.137:7676/health
```

### Check Frontend Connectivity
```bash
curl -v http://172.21.1.137:7678/
```

### Monitor WebSocket Connections
On mobile DevTools:
1. Open DevTools
2. Network tab
3. Filter: "socket.io"
4. Check for "101" (WebSocket upgrade) status

## Production Considerations

For production deployment:
1. Update `REACT_APP_BACKEND_URL` to actual backend domain
2. Ensure backend has proper CORS configuration
3. Use HTTPS (required for push notifications in production)
4. Use signed URLs for tone files from S3
5. Test on real devices before release
