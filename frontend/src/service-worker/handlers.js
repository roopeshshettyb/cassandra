/**
 * Service Worker Event Handlers
 * Manages push, click, and close events for notifications
 */

/**
 * Handles incoming push notifications from backend
 * Shows system notification to user (visible even when app is closed)
 */
export function setupPushHandler() {
  self.addEventListener('push', (event) => {
    if (!event.data) {
      console.warn('[SW] Push event received but no data');
      return;
    }

    event.waitUntil((async () => {
      try {
        const data = event.data.json();
        const { title, message, id, link, toneUrl } = data;

        // Show native system notification
        await self.registration.showNotification(title, {
          body: message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `notification-${id}`, // Replace older notifications with same tag
          requireInteraction: false, // Auto-dismiss after a few seconds
          data: { link, toneUrl },
        });

        // Play notification tone if available
        if (toneUrl && toneUrl !== 'none') {
          playNotificationTone(toneUrl);
        }

        console.log('[SW] Push notification shown:', { title, message, id, toneUrl });
      } catch (error) {
        console.error('[SW] Failed to show push notification:', error);
      }
    })());
  });
}

/**
 * Play notification tone in service worker context (loops until dismissed)
 * @param {string} toneUrl - URL to the tone file (S3 signed URL or local path)
 */
function playNotificationTone(toneUrl) {
  try {
    // Create an Audio context to play the tone
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.9; // Louder for notifications
    audio.src = toneUrl;
    audio.loop = true; // Loop until dismissed

    // Set max timeout (5 minutes) to prevent infinite playback if dismissed fails
    const timeoutId = setTimeout(() => {
      audio.pause();
      audio.src = '';
      console.log('[SW] Notification tone stopped (timeout)');
    }, 300000); // 5 minutes max

    audio.play()
      .then(() => {
        console.log('[SW] Notification tone playing (looped):', toneUrl);
        // Store timeout ID for potential cleanup
        self.notificationAudioTimeout = timeoutId;
      })
      .catch((err) => {
        console.warn('[SW] Could not play notification tone:', err.message);
        clearTimeout(timeoutId);
      });
  } catch (error) {
    console.warn('[SW] Failed to play notification tone:', error.message);
  }
}

/**
 * Handles user clicking on notification
 * Either focuses existing app window or opens new one
 */
export function setupClickHandler() {
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const link = event.notification.data?.link;
    if (!link) {
      console.warn('[SW] Notification clicked but no link provided');
      return;
    }

    event.waitUntil((async () => {
      try {
        const clientList = await clients.matchAll({ type: 'window' });
        const matchingClient = findMatchingClient(clientList, link);

        if (matchingClient && 'focus' in matchingClient) {
          console.log('[SW] Focusing existing window:', link);
          return matchingClient.focus();
        }

        // No matching window, open new one
        console.log('[SW] Opening new window:', link);
        return clients.openWindow(link);
      } catch (error) {
        console.error('[SW] Failed to handle notification click:', error);
      }
    })());
  });
}

/**
 * Handles when user dismisses a notification
 * Can be used for analytics or cleanup
 */
export function setupCloseHandler() {
  self.addEventListener('notificationclose', (event) => {
    const notificationId = event.notification.data?.id;
    if (notificationId) {
      console.log('[SW] Notification dismissed:', notificationId);
      // TODO: Send analytics event if needed
    }
  });
}

/**
 * Find existing window with matching URL pathname
 * @param {Client[]} clientList - List of open windows/tabs
 * @param {string} targetLink - Target URL to match
 * @returns {Client|null} Matching client or null
 */
function findMatchingClient(clientList, targetLink) {
  try {
    const targetPath = new URL(targetLink).pathname;

    for (const client of clientList) {
      const clientPath = new URL(client.url).pathname;
      if (clientPath === targetPath) {
        return client;
      }
    }
  } catch (error) {
    console.error('[SW] Error matching client URLs:', error);
  }

  return null;
}
