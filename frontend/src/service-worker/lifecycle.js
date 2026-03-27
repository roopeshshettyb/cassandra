/**
 * Service Worker Lifecycle Events
 * Manages install and activate phases of the service worker
 */

/**
 * Install event - runs once when SW is first registered
 * Good place for pre-caching if needed in future
 */
export function setupInstallHandler() {
  self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting()); // Activate immediately
  });
}

/**
 * Activate event - runs when SW becomes active
 * Good place for cleanup of old caches if needed
 */
export function setupActivateHandler() {
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); // Claim all clients immediately
  });
}
