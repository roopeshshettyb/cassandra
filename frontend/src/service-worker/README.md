# Service Worker Module

Organized source code for the Service Worker. This folder contains modular, maintainable source code that corresponds to the actual `public/service-worker.js` file.

## Structure

```
service-worker/
├── index.js          # Central export point
├── handlers.js       # Push, click, and close event handlers
├── lifecycle.js      # Install and activate lifecycle events
└── README.md         # This file
```

## Files

### `handlers.js`
Event handlers for:
- **Push events** - Shows notifications to user (even when app closed)
- **Click events** - Focuses app window or opens new one when notification clicked
- **Close events** - Tracks dismissed notifications (for analytics)

### `lifecycle.js`
Service Worker lifecycle:
- **Install** - Runs when SW first registers
- **Activate** - Runs when SW becomes active

## Important Note

⚠️ **The actual `public/service-worker.js` must remain at the public root** to have proper scope `/`. This is a technical requirement of Service Workers.

The code in this folder is organized for maintainability. When updates are needed:
1. Modify the source files in `src/service-worker/`
2. Copy the changes to `public/service-worker.js`
3. This ensures the production file is always at the correct location

## Testing

To test the Service Worker:
1. Open DevTools → Application tab → Service Workers
2. Check the registration status and scope
3. Use Console to see `[SW]` prefixed logs

## Reference

- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Service Worker Scope](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
